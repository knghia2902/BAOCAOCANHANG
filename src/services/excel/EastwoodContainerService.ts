import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';
import { WeighbridgeService, type Vessel } from '@/services/weighbridge/WeighbridgeService';
import {
    stripAccents,
    parseToIsoDate,
    parseToTimeStr,
    computeReportDate,
    formatIsoToDmy,
    normalizeWeightToKg,
    normalizeWarehouseId,
    isEastwoodCustomer,
    resolveVesselNameFromBarge,
    type RawWeighbridgeRow
} from '@/services/excel/WarehouseInventoryService';
import type {
    EastwoodContainerFlowType,
    EastwoodContainerEvent,
    EastwoodContainerStatus,
    EastwoodContainerStatusRow,
    EastwoodContainerDailyReportRow,
    EastwoodContainerYardSummary
} from '@/types/excel';

const LOCAL_EVENTS_KEY = 'eastwood_container_events';
const CONTAINER_ISO_RE = /[A-Z]{4}\s*\d{7}/g;

function normalizeContainerToken(raw: string): string {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Extract 1 or more container numbers from a note/cell string.
 * Supports multi-container notes separated by '/', ',', ';', whitespace (e.g. "WHLU2904564/TTLU2975023").
 */
export function extractContainerNumbers(rawText: string | undefined | null): string[] {
    if (!rawText) return [];
    const upper = String(rawText).toUpperCase().trim();
    if (!upper) return [];

    const found: string[] = [];
    const seen = new Set<string>();

    // Pass 1: Match standard ISO 6346 container numbers (4 letters + 7 digits, optional space)
    const matches = upper.match(CONTAINER_ISO_RE);
    if (matches) {
        for (const m of matches) {
            const norm = normalizeContainerToken(m);
            if (norm.length === 11 && !seen.has(norm)) {
                seen.add(norm);
                found.push(norm);
            }
        }
    }

    if (found.length > 0) return found;

    // Pass 2: Fallback for slightly non-standard container codes separated by '/' (e.g. 4 letters + 6..7 digits)
    const parts = upper.split(/[\/,;|\n]+/);
    for (const part of parts) {
        const norm = normalizeContainerToken(part);
        if (/^[A-Z]{4}\d{6,8}$/.test(norm) && !seen.has(norm)) {
            seen.add(norm);
            found.push(norm);
        }
    }

    return found;
}

/**
 * Detect whether the container has wooden boards ("Có ván" / "Không ván")
 * from either Loai Salan (for Hạ Cont) or Tai Xe (for Load Cont).
 */
export function detectBoardType(rawText: string | undefined | null): 'Có ván' | 'Không ván' | '' {
    if (!rawText) return '';
    const clean = stripAccents(String(rawText)).toUpperCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (/\b(KHONG\s*VAN|KO\s*VAN|K\s*VAN)\b/.test(clean)) return 'Không ván';
    if (/\b(CO\s*VAN|VAN)\b/.test(clean)) return 'Có ván';
    return '';
}

/**
 * Determine if a raw weighbridge row belongs to Eastwood's container workflow:
 * - HA_CONT: Nhap + Loai Salan contains "HẠ CONT" (or "BÃI CONT")
 * - TRA_CONT: Xuat + Loai Salan contains "LẤY CONT RỖNG" / "TRẢ CONT" / "CONT RỖNG"
 * - LOAD_CONT: Xuat + Tai Xe contains "VÁN" / "CÓ VÁN" / "KHÔNG VÁN" OR Ghi Chu has ISO container number (and not Kho 1..4 / not TRA_CONT)
 * Strictly scoped to Eastwood customer only.
 */
export function detectEastwoodContainerFlow(row: RawWeighbridgeRow): EastwoodContainerFlowType | null {
    if (!row || !isEastwoodCustomer(row.khachHang)) return null;

    const dir = stripAccents(row.xuatNhap || '').toUpperCase().trim();
    const salan = stripAccents(row.loaiSalan || '').toUpperCase().trim();
    const driver = stripAccents(row.taiXe || '').toUpperCase().trim();
    const conts = extractContainerNumbers(row.ghiChu);
    const boardFromDriver = detectBoardType(row.taiXe);

    // 1. TRẢ CONT RỖNG (Container OUT)
    if (
        salan.includes('LAY CONT RONG') ||
        salan.includes('TRA CONT') ||
        salan.includes('CONT RONG')
    ) {
        return 'TRA_CONT';
    }

    // 2. HẠ CONT HÀNG (Container IN)
    if (dir.includes('NHAP')) {
        if (salan.includes('HA CONT') || salan.includes('BAI CONT')) {
            return 'HA_CONT';
        }
        // Fallback: Nhap without Kho 1..4 but Ghi Chu explicitly contains ISO container number(s)
        if (!normalizeWarehouseId(row.loaiSalan) && conts.length > 0) {
            return 'HA_CONT';
        }
        return null;
    }

    // 3. LOAD CONT LÊN SÀ LAN (Container LOAD)
    if (dir.includes('XUAT')) {
        // If explicitly exported from KHO 1..4, it's bulk warehouse export, not container
        if (normalizeWarehouseId(row.taiXe) || normalizeWarehouseId(row.loaiSalan)) {
            return null;
        }
        if (boardFromDriver !== '' || conts.length > 0) {
            return 'LOAD_CONT';
        }
        if (driver.includes('CONT')) {
            return 'LOAD_CONT';
        }
    }

    return null;
}

function buildEventId(
    flowType: EastwoodContainerFlowType,
    soPhieu: string,
    containerNo: string,
    actualDate: string,
    weighOutTime: string,
    plateNumber: string
): string {
    const cleanSp = String(soPhieu || '').trim().toUpperCase().replace(/[^A-Z0-9/_-]/g, '');
    const cleanCont = normalizeContainerToken(containerNo);
    if (cleanSp) {
        return `${flowType}_${cleanSp}_${cleanCont}`;
    }
    const cleanPlate = String(plateNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${flowType}_${cleanPlate}_${cleanCont}_${actualDate}_${weighOutTime || '00:00:00'}`;
}

function splitPlateAndRomooc(rawPlate: string): { plateNumber: string; romoocNo: string } {
    const s = String(rawPlate || '').trim();
    if (!s) return { plateNumber: '', romoocNo: '' };
    if (s.includes('/')) {
        const parts = s.split('/');
        return {
            plateNumber: (parts[0] || '').trim(),
            romoocNo: parts.slice(1).join('/').trim()
        };
    }
    return { plateNumber: s, romoocNo: '' };
}

/**
 * Classify a single raw weighbridge row into 0, 1, or multiple EastwoodContainerEvent records
 * (splits multi-container tickets like "WHLU2904564/TTLU2975023" into separate container rows).
 */
export function classifyEastwoodContainerRow(
    row: RawWeighbridgeRow,
    vessels: Vessel[] = []
): EastwoodContainerEvent[] {
    const flowType = detectEastwoodContainerFlow(row);
    if (!flowType) return [];

    const actualDate = parseToIsoDate(row.ngay2 || row.ngay1);
    const weighOutTime = parseToTimeStr(row.gio2 || row.gio1) || '00:00:00';
    if (!actualDate) return [];

    const reportDate = computeReportDate(actualDate, weighOutTime, true) || actualDate;
    const weighInDate = parseToIsoDate(row.ngay1) || actualDate;
    const weighInTime = parseToTimeStr(row.gio1);
    const eventDatetime = `${actualDate}T${weighOutTime}`;

    const grossKg = normalizeWeightToKg(row.kl1);
    const tareKg = normalizeWeightToKg(row.kl2);
    let netKg = normalizeWeightToKg(row.klHang);
    if (netKg <= 0 && flowType !== 'TRA_CONT' && grossKg > 0 && tareKg > 0) {
        netKg = Math.abs(grossKg - tareKg);
    }
    if (flowType !== 'TRA_CONT' && netKg <= 0) {
        return [];
    }

    const containers = extractContainerNumbers(row.ghiChu);
    const effectiveContainers = containers.length > 0
        ? containers
        : [String(row.ghiChu || '').trim().toUpperCase() || `UNKNOWN_${row.soPhieu || actualDate}`];

    const count = effectiveContainers.length;
    const soPhieu = String(row.soPhieu || '').trim();
    const maLenh = String(row.maLenh || '').trim();
    const { plateNumber, romoocNo } = splitPlateAndRomooc(row.soXe);

    const boardType: 'Có ván' | 'Không ván' | '' =
        flowType === 'HA_CONT'
            ? detectBoardType(row.loaiSalan) || detectBoardType(row.taiXe)
            : flowType === 'LOAD_CONT'
                ? detectBoardType(row.taiXe) || detectBoardType(row.loaiSalan)
                : '';

    const bargeInfo = flowType === 'LOAD_CONT' ? String(row.loaiSalan || '').trim() : '';
    const vesselName = flowType === 'LOAD_CONT'
        ? (String(row.nguonTau || '').trim() || resolveVesselNameFromBarge(bargeInfo, maLenh, vessels))
        : '';

    const sourceFactory = flowType === 'HA_CONT' ? String(row.taiXe || '').trim() : '';
    const warehouseNote = flowType === 'HA_CONT' ? String(row.loaiSalan || '').trim() : '';

    const events: EastwoodContainerEvent[] = [];
    let remainingNet = netKg;

    effectiveContainers.forEach((contNo, idx) => {
        let contNetKg = 0;
        if (flowType === 'TRA_CONT') {
            contNetKg = 0;
        } else if (count === 1) {
            contNetKg = netKg;
        } else if (idx === count - 1) {
            contNetKg = Math.max(0, remainingNet);
        } else {
            contNetKg = Math.round(netKg / count);
            remainingNet -= contNetKg;
        }

        const id = buildEventId(flowType, soPhieu, contNo, actualDate, weighOutTime, plateNumber);
        events.push({
            id,
            flowType,
            containerNo: contNo,
            soPhieu,
            maLenh,
            plateNumber,
            romoocNo,
            sealNo: '',
            boardType,
            grossWeightKg: count === 1 ? grossKg : Math.round(grossKg / count),
            tareWeightKg: count === 1 ? tareKg : Math.round(tareKg / count),
            netWeightKg: contNetKg,
            actualDate,
            reportDate,
            weighInDate,
            weighInTime,
            weighOutDate: actualDate,
            weighOutTime,
            eventDatetime,
            bargeInfo,
            vesselName,
            sourceFactory,
            warehouseNote,
            remark: '',
            rawNote: String(row.ghiChu || '').trim(),
            customerName: String(row.khachHang || 'EASTWOOD').trim() || 'EASTWOOD',
            cargoType: String(row.loaiHang || 'Viên Nén Gỗ').trim()
        });
    });

    return events;
}

/**
 * Compute Container Status Table (Sheet TRẠNG THÁI) using ACTUAL datetime (`eventDatetime`).
 * Matches the Excel MAXIFS logic: compares latest Hạ Cont vs latest Load Cont vs latest Trả Cont.
 */
export function computeContainerStatuses(
    events: EastwoodContainerEvent[]
): { rows: EastwoodContainerStatusRow[]; summary: EastwoodContainerYardSummary } {
    const byCont = new Map<string, EastwoodContainerEvent[]>();
    for (const ev of events) {
        const key = normalizeContainerToken(ev.containerNo);
        if (!key) continue;
        const list = byCont.get(key);
        if (list) list.push(ev);
        else byCont.set(key, [ev]);
    }

    const rows: EastwoodContainerStatusRow[] = [];
    let loadedCount = 0;
    let emptyCount = 0;
    let returnedCount = 0;

    for (const [contNo, list] of byCont.entries()) {
        // Sort ascending by actual eventDatetime
        const sorted = [...list].sort((a, b) => (a.eventDatetime || '').localeCompare(b.eventDatetime || ''));

        let latestHa: EastwoodContainerEvent | null = null;
        let latestLoad: EastwoodContainerEvent | null = null;
        let latestTra: EastwoodContainerEvent | null = null;
        let haCount = 0;

        for (const ev of sorted) {
            if (ev.flowType === 'HA_CONT') {
                latestHa = ev;
                haCount++;
            } else if (ev.flowType === 'LOAD_CONT') {
                latestLoad = ev;
            } else if (ev.flowType === 'TRA_CONT') {
                latestTra = ev;
            }
        }

        const dtHa = latestHa?.eventDatetime || '';
        const dtLoad = latestLoad?.eventDatetime || '';
        const dtTra = latestTra?.eventDatetime || '';

        // Compare latest actual datetime among the 3 flows
        // Tie-break priority if exact same timestamp: TRA_CONT > LOAD_CONT > HA_CONT
        let latestEv: EastwoodContainerEvent = sorted[sorted.length - 1]!;
        let status: EastwoodContainerStatus = 'LOADED';
        let statusLabel = 'Cont có hàng';

        if (dtTra && dtTra >= dtLoad && dtTra >= dtHa) {
            status = 'RETURNED';
            statusLabel = 'Đã hoàn tất';
            latestEv = latestTra!;
            returnedCount++;
        } else if (dtLoad && dtLoad >= dtHa && dtLoad >= dtTra) {
            status = 'EMPTY_YARD';
            statusLabel = 'Đang nằm bãi (đã xá)';
            latestEv = latestLoad!;
            emptyCount++;
        } else {
            status = 'LOADED';
            statusLabel = 'Cont có hàng';
            latestEv = latestHa || sorted[sorted.length - 1]!;
            loadedCount++;
        }

        // Detect minor sequence anomalies for operator visibility
        let hasWarning = false;
        let warningText = '';
        if (status === 'EMPTY_YARD' && !dtHa) {
            hasWarning = true;
            warningText = 'Đã Load nhưng chưa có phiếu Hạ Cont';
        } else if (status === 'RETURNED' && dtHa && (!dtLoad || dtLoad < dtHa)) {
            hasWarning = true;
            warningText = 'Trả cont rỗng khi chưa ghi nhận Load Cont';
        }

        const latestBoard =
            latestEv.boardType ||
            latestLoad?.boardType ||
            latestHa?.boardType ||
            '';

        rows.push({
            containerNo: contNo,
            latestHaContDatetime: dtHa,
            latestLoadContDatetime: dtLoad,
            latestTraContDatetime: dtTra,
            status,
            statusLabel,
            latestEventDatetime: latestEv.eventDatetime || '',
            latestActualDate: latestEv.actualDate || '',
            latestBoardType: latestBoard,
            latestVesselName: latestLoad?.vesselName || '',
            latestBargeInfo: latestLoad?.bargeInfo || '',
            latestPlateNumber: latestEv.plateNumber || '',
            latestNetWeightKg: latestLoad?.netWeightKg || latestHa?.netWeightKg || 0,
            cycleCount: Math.max(haCount, 1),
            hasWarning,
            warningText
        });
    }

    // Sort: Cont có hàng first, then Cont rỗng, then Đã trả; within group sort newest first
    const statusOrder: Record<EastwoodContainerStatus, number> = {
        LOADED: 0,
        EMPTY_YARD: 1,
        RETURNED: 2
    };
    rows.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return (b.latestEventDatetime || '').localeCompare(a.latestEventDatetime || '');
    });

    return {
        rows,
        summary: {
            loadedCount,
            emptyCount,
            returnedCount,
            totalTracked: rows.length
        }
    };
}

/**
 * Compute Daily Container Report (Sheet REPORT) grouped by SHIFT REPORT DATE (`reportDate`, 06:00 AM cutoff).
 */
export function computeContainerDailyReport(
    events: EastwoodContainerEvent[],
    options?: { fromDate?: string; toDate?: string }
): {
    rows: EastwoodContainerDailyReportRow[];
    totalIn: number;
    totalOut: number;
    totalLoad: number;
    totalHaWeightKg: number;
    totalLoadWeightKg: number;
} {
    const byDate = new Map<string, EastwoodContainerDailyReportRow>();

    for (const ev of events) {
        const d = ev.reportDate || ev.actualDate;
        if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        if (options?.fromDate && d < options.fromDate) continue;
        if (options?.toDate && d > options.toDate) continue;

        let row = byDate.get(d);
        if (!row) {
            row = {
                reportDate: d,
                displayDate: formatIsoToDmy(d),
                containerIn: 0,
                containerOut: 0,
                containerLoad: 0,
                haWeightKg: 0,
                loadWeightKg: 0,
                loadWeightTons: 0
            };
            byDate.set(d, row);
        }

        if (ev.flowType === 'HA_CONT') {
            row.containerIn += 1;
            row.haWeightKg += Number(ev.netWeightKg) || 0;
        } else if (ev.flowType === 'TRA_CONT') {
            row.containerOut += 1;
        } else if (ev.flowType === 'LOAD_CONT') {
            row.containerLoad += 1;
            row.loadWeightKg += Number(ev.netWeightKg) || 0;
        }
    }

    const rows = Array.from(byDate.values()).sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    let totalIn = 0;
    let totalOut = 0;
    let totalLoad = 0;
    let totalHaWeightKg = 0;
    let totalLoadWeightKg = 0;

    for (const r of rows) {
        r.loadWeightTons = Math.round((r.loadWeightKg / 1000) * 1000) / 1000;
        totalIn += r.containerIn;
        totalOut += r.containerOut;
        totalLoad += r.containerLoad;
        totalHaWeightKg += r.haWeightKg;
        totalLoadWeightKg += r.loadWeightKg;
    }

    return {
        rows,
        totalIn,
        totalOut,
        totalLoad,
        totalHaWeightKg,
        totalLoadWeightKg
    };
}

function unwrapExcelCell(val: any): any {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val instanceof Date) return val;
        if ('result' in val) return val.result ?? '';
        if ('richText' in val && Array.isArray(val.richText)) {
            return val.richText.map((t: any) => t?.text || '').join('');
        }
        if ('text' in val) return val.text ?? '';
    }
    return val;
}

function extractExcelDateTimeParts(rawDate: any, rawTime: any, rawDatetime: any): {
    actualDate: string;
    timeStr: string;
    eventDatetime: string;
} {
    let actualDate = parseToIsoDate(rawDate);
    let timeStr = parseToTimeStr(rawTime);

    if (rawDatetime instanceof Date && !isNaN(rawDatetime.getTime())) {
        const y = rawDatetime.getUTCFullYear();
        if (y >= 2000 && y <= 2100) {
            const m = String(rawDatetime.getUTCMonth() + 1).padStart(2, '0');
            const d = String(rawDatetime.getUTCDate()).padStart(2, '0');
            const hh = String(rawDatetime.getUTCHours()).padStart(2, '0');
            const mm = String(rawDatetime.getUTCMinutes()).padStart(2, '0');
            const ss = String(rawDatetime.getUTCSeconds()).padStart(2, '0');
            if (!actualDate) actualDate = `${y}-${m}-${d}`;
            if (!timeStr || timeStr === '00:00:00') timeStr = `${hh}:${mm}:${ss}`;
        }
    } else if (typeof rawDatetime === 'string' && rawDatetime.trim()) {
        if (!actualDate) actualDate = parseToIsoDate(rawDatetime);
        if (!timeStr) timeStr = parseToTimeStr(rawDatetime);
    }

    const safeTime = timeStr || '00:00:00';
    return {
        actualDate,
        timeStr: safeTime,
        eventDatetime: actualDate ? `${actualDate}T${safeTime}` : ''
    };
}

function mapEventToDbRow(ev: EastwoodContainerEvent): Record<string, any> {
    return {
        id: ev.id,
        flow_type: ev.flowType,
        container_no: ev.containerNo,
        so_phieu: ev.soPhieu || '',
        ma_lenh: ev.maLenh || '',
        plate_number: ev.plateNumber || '',
        romooc_no: ev.romoocNo || '',
        seal_no: ev.sealNo || '',
        board_type: ev.boardType || '',
        gross_weight_kg: Number(ev.grossWeightKg) || 0,
        tare_weight_kg: Number(ev.tareWeightKg) || 0,
        net_weight_kg: Number(ev.netWeightKg) || 0,
        actual_date: ev.actualDate,
        report_date: ev.reportDate,
        weigh_in_date: ev.weighInDate || '',
        weigh_in_time: ev.weighInTime || '',
        weigh_out_date: ev.weighOutDate || ev.actualDate,
        weigh_out_time: ev.weighOutTime || '00:00:00',
        event_datetime: ev.eventDatetime,
        barge_info: ev.bargeInfo || '',
        vessel_name: ev.vesselName || '',
        source_factory: ev.sourceFactory || '',
        warehouse_note: ev.warehouseNote || '',
        remark: ev.remark || '',
        raw_note: ev.rawNote || '',
        customer_name: ev.customerName || 'EASTWOOD',
        cargo_type: ev.cargoType || ''
    };
}

function mapDbRowToEvent(row: any): EastwoodContainerEvent {
    return {
        id: String(row.id || ''),
        flowType: row.flow_type as EastwoodContainerFlowType,
        containerNo: String(row.container_no || '').toUpperCase(),
        soPhieu: String(row.so_phieu || ''),
        maLenh: String(row.ma_lenh || ''),
        plateNumber: String(row.plate_number || ''),
        romoocNo: String(row.romooc_no || ''),
        sealNo: String(row.seal_no || ''),
        boardType: (row.board_type || '') as 'Có ván' | 'Không ván' | '',
        grossWeightKg: Number(row.gross_weight_kg) || 0,
        tareWeightKg: Number(row.tare_weight_kg) || 0,
        netWeightKg: Number(row.net_weight_kg) || 0,
        actualDate: String(row.actual_date || ''),
        reportDate: String(row.report_date || row.actual_date || ''),
        weighInDate: String(row.weigh_in_date || ''),
        weighInTime: String(row.weigh_in_time || ''),
        weighOutDate: String(row.weigh_out_date || row.actual_date || ''),
        weighOutTime: String(row.weigh_out_time || '00:00:00'),
        eventDatetime: String(row.event_datetime || `${row.actual_date || ''}T${row.weigh_out_time || '00:00:00'}`),
        bargeInfo: String(row.barge_info || ''),
        vesselName: String(row.vessel_name || ''),
        sourceFactory: String(row.source_factory || ''),
        warehouseNote: String(row.warehouse_note || ''),
        remark: String(row.remark || ''),
        rawNote: String(row.raw_note || ''),
        customerName: String(row.customer_name || 'EASTWOOD'),
        cargoType: String(row.cargo_type || ''),
        createdAt: row.created_at
    };
}

export function formatEventDatetimeDisplay(isoDt: string | undefined | null): string {
    if (!isoDt) return '-';
    const parts = isoDt.split('T');
    if (parts.length < 2) return formatIsoToDmy(isoDt);
    return `${formatIsoToDmy(parts[0]!)} ${parts[1]!.slice(0, 8)}`;
}

export const EastwoodContainerService = {
    async getEvents(): Promise<EastwoodContainerEvent[]> {
        try {
            const allRows: any[] = [];
            const pageSize = 1000;
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('eastwood_container_events')
                    .select('*')
                    .order('event_datetime', { ascending: false })
                    .range(from, from + pageSize - 1);

                if (error) {
                    console.warn('Supabase eastwood_container_events fallback to IndexedDB:', error.message);
                    const cached = await dbContext.get<EastwoodContainerEvent[]>(LOCAL_EVENTS_KEY);
                    return Array.isArray(cached) ? cached : [];
                }

                if (data && data.length > 0) {
                    allRows.push(...data);
                    from += pageSize;
                    hasMore = data.length === pageSize;
                } else {
                    hasMore = false;
                }
            }

            const mapped = allRows.map(mapDbRowToEvent);
            await dbContext.set(LOCAL_EVENTS_KEY, mapped);
            return mapped;
        } catch (err) {
            console.warn('getEvents fallback to IndexedDB:', err);
            const cached = await dbContext.get<EastwoodContainerEvent[]>(LOCAL_EVENTS_KEY);
            return Array.isArray(cached) ? cached : [];
        }
    },

    async saveEventsBulk(
        incoming: EastwoodContainerEvent[]
    ): Promise<{ added: number; updated: number; total: number; cloudError?: string }> {
        if (!incoming || incoming.length === 0) {
            return { added: 0, updated: 0, total: 0 };
        }

        // Dedup incoming by id (latest wins)
        const dedupIncoming = new Map<string, EastwoodContainerEvent>();
        for (const ev of incoming) {
            dedupIncoming.set(ev.id, ev);
        }
        const uniqueList = Array.from(dedupIncoming.values());

        // Merge with local cache first
        const existing = (await dbContext.get<EastwoodContainerEvent[]>(LOCAL_EVENTS_KEY)) || [];
        const existingMap = new Map<string, EastwoodContainerEvent>();
        for (const ev of existing) {
            existingMap.set(ev.id, ev);
        }

        let added = 0;
        let updated = 0;
        const mergedToSave: EastwoodContainerEvent[] = [];

        for (const ev of uniqueList) {
            const prev = existingMap.get(ev.id);
            if (prev) {
                const next: EastwoodContainerEvent = {
                    ...prev,
                    ...ev,
                    sealNo: ev.sealNo || prev.sealNo || '',
                    boardType: ev.boardType || prev.boardType || '',
                    vesselName: ev.vesselName || prev.vesselName || '',
                    remark: ev.remark || prev.remark || ''
                };
                existingMap.set(ev.id, next);
                mergedToSave.push(next);
                updated++;
            } else {
                existingMap.set(ev.id, ev);
                mergedToSave.push(ev);
                added++;
            }
        }

        const nextAll = Array.from(existingMap.values()).sort((a, b) =>
            (b.eventDatetime || '').localeCompare(a.eventDatetime || '')
        );
        await dbContext.set(LOCAL_EVENTS_KEY, nextAll);

        // Push to Supabase in chunks of 500
        let cloudError: string | undefined;
        try {
            const rows = mergedToSave.map(mapEventToDbRow);
            const chunkSize = 500;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from('eastwood_container_events')
                    .upsert(chunk, { onConflict: 'id' });
                if (error) {
                    cloudError = error.message;
                    console.warn('Supabase upsert eastwood_container_events error:', error.message);
                    break;
                }
            }
        } catch (err: any) {
            cloudError = err?.message || String(err);
        }

        return { added, updated, total: uniqueList.length, cloudError };
    },

    async updateEvent(ev: EastwoodContainerEvent): Promise<boolean> {
        const res = await this.saveEventsBulk([ev]);
        return !res.cloudError;
    },

    async deleteEvent(id: string): Promise<boolean> {
        const existing = (await dbContext.get<EastwoodContainerEvent[]>(LOCAL_EVENTS_KEY)) || [];
        const next = existing.filter(e => e.id !== id);
        await dbContext.set(LOCAL_EVENTS_KEY, next);

        try {
            const { error } = await supabase
                .from('eastwood_container_events')
                .delete()
                .eq('id', id);
            if (error) {
                console.warn('Supabase delete eastwood_container_events error:', error.message);
                return false;
            }
            return true;
        } catch {
            return false;
        }
    },

    async clearAllEvents(): Promise<boolean> {
        await dbContext.set(LOCAL_EVENTS_KEY, []);
        try {
            const { error } = await supabase
                .from('eastwood_container_events')
                .delete()
                .neq('id', '');
            if (error) {
                console.warn('Supabase clear eastwood_container_events error:', error.message);
                return false;
            }
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Import historical container Excel workbook (e.g. REPORT CONTAINER_NGUYÊN NGOC PORT_EW_*.xlsx)
     * Parses sheets: HẠ CONT, LOAD CONT, TRẢ CONT, and optional CONT RỖNG.
     */
    async importHistoricalContainerExcel(file: File): Promise<{
        haCount: number;
        loadCount: number;
        traCount: number;
        emptyLegacyCount: number;
        added: number;
        updated: number;
        errors: string[];
    }> {
        const errors: string[] = [];
        const ExcelJS = await import('exceljs');
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);

        const vessels = await WeighbridgeService.getVessels().catch(() => [] as Vessel[]);
        const events: EastwoodContainerEvent[] = [];
        let haCount = 0;
        let loadCount = 0;
        let traCount = 0;
        let emptyLegacyCount = 0;

        const findHeaderRow = (ws: any, requiredKeywords: string[]): { rowIdx: number; colMap: Record<string, number> } | null => {
            const maxScan = Math.min(25, ws.rowCount || 25);
            for (let r = 1; r <= maxScan; r++) {
                const row = ws.getRow(r);
                const colMap: Record<string, number> = {};
                const maxCol = Math.min(25, row.cellCount || 20);
                for (let c = 1; c <= maxCol; c++) {
                    const text = stripAccents(String(unwrapExcelCell(row.getCell(c).value) || '')).toLowerCase().trim();
                    if (!text) continue;
                    if (!colMap.soPhieu && (text.includes('so phieu') || text === 'id' || text.includes('no id') || text.includes('noid'))) {
                        colMap.soPhieu = c;
                    } else if (!colMap.date && (text === 'date' || text.includes('ngay'))) {
                        colMap.date = c;
                    } else if (!colMap.date2 && text === 'date' && colMap.date && c > colMap.date) {
                        colMap.date2 = c;
                    } else if (!colMap.truckNo && (text.includes('truck no') || text.includes('truckno') || text.includes('so xe'))) {
                        colMap.truckNo = c;
                    } else if (!colMap.romooc && text.includes('romooc')) {
                        colMap.romooc = c;
                    } else if (!colMap.containerNo && (text.includes('container') || text.includes('so cont'))) {
                        colMap.containerNo = c;
                    } else if (!colMap.sealNo && text.includes('seal')) {
                        colMap.sealNo = c;
                    } else if (!colMap.grossWeight && (text.includes('total weight') || text.includes('kl 1') || text.includes('lan 1'))) {
                        colMap.grossWeight = c;
                    } else if (!colMap.tareWeight && (text.includes('truck weight') || text.includes('kl 2') || text.includes('lan 2'))) {
                        colMap.tareWeight = c;
                    } else if (!colMap.netWeight && (text.includes('cargo weight') || text === 'weight' || text.includes('kl hang'))) {
                        colMap.netWeight = c;
                    } else if (!colMap.truckIn && (text.includes('truck in') || text.includes('gio vao'))) {
                        colMap.truckIn = c;
                    } else if (!colMap.truckOut && (text.includes('truck out') || text.includes('gio ra'))) {
                        colMap.truckOut = c;
                    } else if (!colMap.barge && (text.includes('barge') || text.includes('salan') || text.includes('sa lan'))) {
                        colMap.barge = c;
                    } else if (!colMap.vessel && (text.includes('vessel') || text.includes('tau'))) {
                        colMap.vessel = c;
                    } else if (!colMap.kho && text === 'kho') {
                        colMap.kho = c;
                    } else if (!colMap.boardType && text.includes('van')) {
                        colMap.boardType = c;
                    } else if (!colMap.remark && (text.includes('remark') || text.includes('ghi chu'))) {
                        colMap.remark = c;
                    } else if (!colMap.datetime && text.includes('datetime')) {
                        colMap.datetime = c;
                    }
                }
                if (requiredKeywords.every(k => colMap[k] !== undefined)) {
                    return { rowIdx: r, colMap };
                }
            }
            return null;
        };

        for (const ws of wb.worksheets) {
            const sheetNorm = stripAccents(ws.name || '').toUpperCase().trim();

            if (sheetNorm.includes('HA CONT')) {
                const hdr = findHeaderRow(ws, ['containerNo']);
                if (!hdr) continue;
                const { rowIdx, colMap } = hdr;
                for (let r = rowIdx + 1; r <= ws.rowCount; r++) {
                    const row = ws.getRow(r);
                    const rawCont = String(unwrapExcelCell(row.getCell(colMap.containerNo!).value) || '').trim();
                    if (!rawCont) continue;
                    const conts = extractContainerNumbers(rawCont);
                    if (conts.length === 0) continue;

                    const rawDate = colMap.date ? unwrapExcelCell(row.getCell(colMap.date).value) : '';
                    const rawIn = colMap.truckIn ? unwrapExcelCell(row.getCell(colMap.truckIn).value) : '';
                    const rawOut = colMap.truckOut ? unwrapExcelCell(row.getCell(colMap.truckOut).value) : '';
                    const rawDt = colMap.datetime ? unwrapExcelCell(row.getCell(colMap.datetime).value) : '';
                    const { actualDate, timeStr, eventDatetime } = extractExcelDateTimeParts(rawDate, rawOut, rawDt);
                    if (!actualDate) continue;

                    const soPhieu = colMap.soPhieu ? String(unwrapExcelCell(row.getCell(colMap.soPhieu).value) || '').trim() : '';
                    const rawTruck = colMap.truckNo ? String(unwrapExcelCell(row.getCell(colMap.truckNo).value) || '').trim() : '';
                    const { plateNumber, romoocNo: splitRomooc } = splitPlateAndRomooc(rawTruck);
                    const romoocNo = (colMap.romooc ? String(unwrapExcelCell(row.getCell(colMap.romooc).value) || '').trim() : '') || splitRomooc;
                    const sealNo = colMap.sealNo ? String(unwrapExcelCell(row.getCell(colMap.sealNo).value) || '').trim() : '';
                    const netKg = colMap.netWeight ? normalizeWeightToKg(unwrapExcelCell(row.getCell(colMap.netWeight).value)) : 0;
                    const khoNote = colMap.kho ? String(unwrapExcelCell(row.getCell(colMap.kho).value) || '').trim() : '';
                    const remark = colMap.remark ? String(unwrapExcelCell(row.getCell(colMap.remark).value) || '').trim() : '';
                    const boardRaw = colMap.boardType ? String(unwrapExcelCell(row.getCell(colMap.boardType).value) || '').trim() : '';
                    const boardType = detectBoardType(boardRaw) || detectBoardType(khoNote) || detectBoardType(remark);

                    const reportDate = computeReportDate(actualDate, timeStr, true) || actualDate;
                    const weighInTime = parseToTimeStr(rawIn);

                    for (const contNo of conts) {
                        const id = buildEventId('HA_CONT', soPhieu, contNo, actualDate, timeStr, plateNumber);
                        events.push({
                            id,
                            flowType: 'HA_CONT',
                            containerNo: contNo,
                            soPhieu,
                            plateNumber,
                            romoocNo,
                            sealNo,
                            boardType,
                            grossWeightKg: 0,
                            tareWeightKg: 0,
                            netWeightKg: conts.length > 1 ? Math.round(netKg / conts.length) : netKg,
                            actualDate,
                            reportDate,
                            weighInDate: actualDate,
                            weighInTime,
                            weighOutDate: actualDate,
                            weighOutTime: timeStr,
                            eventDatetime,
                            warehouseNote: khoNote,
                            remark,
                            rawNote: rawCont,
                            customerName: 'EASTWOOD',
                            cargoType: 'Viên Nén Gỗ'
                        });
                        haCount++;
                    }
                }
            } else if (sheetNorm.includes('LOAD CONT')) {
                const hdr = findHeaderRow(ws, ['containerNo']);
                if (!hdr) continue;
                const { rowIdx, colMap } = hdr;
                for (let r = rowIdx + 1; r <= ws.rowCount; r++) {
                    const row = ws.getRow(r);
                    const rawCont = String(unwrapExcelCell(row.getCell(colMap.containerNo!).value) || '').trim();
                    if (!rawCont) continue;
                    const conts = extractContainerNumbers(rawCont);
                    if (conts.length === 0) continue;

                    const rawDate = colMap.date2
                        ? (unwrapExcelCell(row.getCell(colMap.date2).value) || (colMap.date ? unwrapExcelCell(row.getCell(colMap.date).value) : ''))
                        : (colMap.date ? unwrapExcelCell(row.getCell(colMap.date).value) : '');
                    const rawIn = colMap.truckIn ? unwrapExcelCell(row.getCell(colMap.truckIn).value) : '';
                    const rawOut = colMap.truckOut ? unwrapExcelCell(row.getCell(colMap.truckOut).value) : '';
                    const rawDt = colMap.datetime ? unwrapExcelCell(row.getCell(colMap.datetime).value) : '';
                    const { actualDate, timeStr, eventDatetime } = extractExcelDateTimeParts(rawDate, rawOut, rawDt);
                    if (!actualDate) continue;

                    const soPhieu = colMap.soPhieu ? String(unwrapExcelCell(row.getCell(colMap.soPhieu).value) || '').trim() : '';
                    const rawTruck = colMap.truckNo ? String(unwrapExcelCell(row.getCell(colMap.truckNo).value) || '').trim() : '';
                    const { plateNumber, romoocNo } = splitPlateAndRomooc(rawTruck);
                    const sealNo = colMap.sealNo ? String(unwrapExcelCell(row.getCell(colMap.sealNo).value) || '').trim() : '';
                    const grossKg = colMap.grossWeight ? normalizeWeightToKg(unwrapExcelCell(row.getCell(colMap.grossWeight).value)) : 0;
                    const tareKg = colMap.tareWeight ? normalizeWeightToKg(unwrapExcelCell(row.getCell(colMap.tareWeight).value)) : 0;
                    let netKg = colMap.netWeight ? normalizeWeightToKg(unwrapExcelCell(row.getCell(colMap.netWeight).value)) : 0;
                    if (netKg <= 0 && grossKg > 0 && tareKg > 0) netKg = Math.abs(grossKg - tareKg);
                    const bargeInfo = colMap.barge ? String(unwrapExcelCell(row.getCell(colMap.barge).value) || '').trim() : '';
                    const vesselRaw = colMap.vessel ? String(unwrapExcelCell(row.getCell(colMap.vessel).value) || '').trim() : '';
                    const vesselName = vesselRaw || resolveVesselNameFromBarge(bargeInfo, '', vessels);
                    const remark = colMap.remark ? String(unwrapExcelCell(row.getCell(colMap.remark).value) || '').trim() : '';
                    const boardRaw = colMap.boardType ? String(unwrapExcelCell(row.getCell(colMap.boardType).value) || '').trim() : '';
                    const boardType = detectBoardType(boardRaw) || detectBoardType(remark);

                    const reportDate = computeReportDate(actualDate, timeStr, true) || actualDate;
                    const weighInTime = parseToTimeStr(rawIn);

                    for (const contNo of conts) {
                        const id = buildEventId('LOAD_CONT', soPhieu, contNo, actualDate, timeStr, plateNumber);
                        events.push({
                            id,
                            flowType: 'LOAD_CONT',
                            containerNo: contNo,
                            soPhieu,
                            plateNumber,
                            romoocNo,
                            sealNo,
                            boardType,
                            grossWeightKg: grossKg,
                            tareWeightKg: tareKg,
                            netWeightKg: netKg,
                            actualDate,
                            reportDate,
                            weighInDate: actualDate,
                            weighInTime,
                            weighOutDate: actualDate,
                            weighOutTime: timeStr,
                            eventDatetime,
                            bargeInfo,
                            vesselName,
                            remark,
                            rawNote: rawCont,
                            customerName: 'EASTWOOD',
                            cargoType: 'Viên Nén Gỗ'
                        });
                        loadCount++;
                    }
                }
            } else if (sheetNorm.includes('TRA CONT')) {
                const hdr = findHeaderRow(ws, ['containerNo']);
                if (!hdr) continue;
                const { rowIdx, colMap } = hdr;
                for (let r = rowIdx + 1; r <= ws.rowCount; r++) {
                    const row = ws.getRow(r);
                    const rawCont = String(unwrapExcelCell(row.getCell(colMap.containerNo!).value) || '').trim();
                    if (!rawCont) continue;
                    const conts = extractContainerNumbers(rawCont);
                    if (conts.length === 0) continue;

                    const rawDate = colMap.date2
                        ? (unwrapExcelCell(row.getCell(colMap.date2).value) || (colMap.date ? unwrapExcelCell(row.getCell(colMap.date).value) : ''))
                        : (colMap.date ? unwrapExcelCell(row.getCell(colMap.date).value) : '');
                    const rawIn = colMap.truckIn ? unwrapExcelCell(row.getCell(colMap.truckIn).value) : '';
                    const rawOut = colMap.truckOut ? unwrapExcelCell(row.getCell(colMap.truckOut).value) : '';
                    const rawDt = colMap.datetime ? unwrapExcelCell(row.getCell(colMap.datetime).value) : '';
                    const { actualDate, timeStr, eventDatetime } = extractExcelDateTimeParts(rawDate, rawOut, rawDt);
                    if (!actualDate) continue;

                    const soPhieu = colMap.soPhieu ? String(unwrapExcelCell(row.getCell(colMap.soPhieu).value) || '').trim() : '';
                    const rawTruck = colMap.truckNo ? String(unwrapExcelCell(row.getCell(colMap.truckNo).value) || '').trim() : '';
                    const { plateNumber, romoocNo } = splitPlateAndRomooc(rawTruck);
                    const reportDate = computeReportDate(actualDate, timeStr, true) || actualDate;
                    const weighInTime = parseToTimeStr(rawIn);

                    for (const contNo of conts) {
                        const id = buildEventId('TRA_CONT', soPhieu, contNo, actualDate, timeStr, plateNumber);
                        events.push({
                            id,
                            flowType: 'TRA_CONT',
                            containerNo: contNo,
                            soPhieu,
                            plateNumber,
                            romoocNo,
                            sealNo: '',
                            boardType: '',
                            grossWeightKg: 0,
                            tareWeightKg: 0,
                            netWeightKg: 0,
                            actualDate,
                            reportDate,
                            weighInDate: actualDate,
                            weighInTime,
                            weighOutDate: actualDate,
                            weighOutTime: timeStr,
                            eventDatetime,
                            rawNote: rawCont,
                            customerName: 'EASTWOOD',
                            cargoType: 'Viên Nén Gỗ'
                        });
                        traCount++;
                    }
                }
            } else if (sheetNorm.includes('CONT RONG')) {
                // Legacy empty containers already on yard from 2024 ("chưa trả") -> import as LOAD_CONT if not already returned
                const hdr = findHeaderRow(ws, ['containerNo']);
                if (!hdr) continue;
                const { rowIdx, colMap } = hdr;
                for (let r = rowIdx + 1; r <= ws.rowCount; r++) {
                    const row = ws.getRow(r);
                    const rawCont = String(unwrapExcelCell(row.getCell(colMap.containerNo!).value) || '').trim();
                    if (!rawCont) continue;
                    const conts = extractContainerNumbers(rawCont);
                    if (conts.length === 0) continue;

                    const rawDate = colMap.date ? unwrapExcelCell(row.getCell(colMap.date).value) : '';
                    const { actualDate, timeStr, eventDatetime } = extractExcelDateTimeParts(rawDate, '', '');
                    if (!actualDate) continue;

                    const soPhieu = colMap.soPhieu ? String(unwrapExcelCell(row.getCell(colMap.soPhieu).value) || '').trim() : '';
                    const rawTruck = colMap.truckNo ? String(unwrapExcelCell(row.getCell(colMap.truckNo).value) || '').trim() : '';
                    const { plateNumber, romoocNo } = splitPlateAndRomooc(rawTruck);
                    const vesselName = colMap.vessel ? String(unwrapExcelCell(row.getCell(colMap.vessel).value) || '').trim() : '';
                    const remark = colMap.remark ? String(unwrapExcelCell(row.getCell(colMap.remark).value) || '').trim() : '';
                    const reportDate = computeReportDate(actualDate, timeStr, true) || actualDate;

                    for (const contNo of conts) {
                        const id = buildEventId('LOAD_CONT', soPhieu || `EMPTY_LEGACY_${r}`, contNo, actualDate, timeStr, plateNumber);
                        events.push({
                            id,
                            flowType: 'LOAD_CONT',
                            containerNo: contNo,
                            soPhieu,
                            plateNumber,
                            romoocNo,
                            sealNo: '',
                            boardType: '',
                            grossWeightKg: 0,
                            tareWeightKg: 0,
                            netWeightKg: 0,
                            actualDate,
                            reportDate,
                            weighInDate: actualDate,
                            weighInTime: '',
                            weighOutDate: actualDate,
                            weighOutTime: timeStr,
                            eventDatetime,
                            vesselName,
                            remark: remark || 'Cont rỗng tồn cũ',
                            rawNote: rawCont,
                            customerName: 'EASTWOOD',
                            cargoType: 'Cont rỗng'
                        });
                        emptyLegacyCount++;
                    }
                }
            }
        }

        if (events.length === 0) {
            errors.push('Không tìm thấy dữ liệu hợp lệ trong các sheet HẠ CONT / LOAD CONT / TRẢ CONT.');
            return { haCount, loadCount, traCount, emptyLegacyCount, added: 0, updated: 0, errors };
        }

        const saveRes = await this.saveEventsBulk(events);
        if (saveRes.cloudError) {
            errors.push(`Lưu cục bộ thành công, nhưng đồng bộ Supabase lỗi: ${saveRes.cloudError}`);
        }

        return {
            haCount,
            loadCount,
            traCount,
            emptyLegacyCount,
            added: saveRes.added,
            updated: saveRes.updated,
            errors
        };
    },

    /**
     * Export 5-sheet Excel report: REPORT (by shift reportDate), TRẠNG THÁI (by actual eventDatetime),
     * HẠ CONT, LOAD CONT, TRẢ CONT.
     */
    async exportContainerReportExcel(
        events: EastwoodContainerEvent[],
        options?: { fromDate?: string; toDate?: string }
    ): Promise<void> {
        const ExcelJS = await import('exceljs');
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Nguyen Ngoc Port - Eastwood Container Tracking';
        wb.created = new Date();

        const thinBorder = {
            top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
        };

        const styleHeaderRow = (row: any) => {
            row.height = 24;
            row.eachCell((cell: any) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A78C2' } };
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = thinBorder;
            });
        };

        const styleDataRow = (row: any) => {
            row.height = 20;
            row.eachCell((cell: any) => {
                cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF1E293B' } };
                cell.border = thinBorder;
                cell.alignment = { vertical: 'middle' };
            });
        };

        // 1. Sheet REPORT (theo Ngày báo cáo ca)
        const reportData = computeContainerDailyReport(events, options);
        const wsReport = wb.addWorksheet('REPORT');
        wsReport.addRow(['BÁO CÁO NHẬP - XUẤT CONTAINER (EASTWOOD)']);
        wsReport.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
        wsReport.addRow(['Tính theo Ngày báo cáo ca (06:00 sáng hôm nay -> 05:59 sáng hôm sau)']);
        wsReport.getRow(2).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
        wsReport.addRow([]);
        const repHeader = wsReport.addRow([
            'Ngày báo cáo ca',
            'Container IN (Hạ Cont)',
            'Container OUT (Trả Cont)',
            'Container LOAD (Xá Sà Lan)',
            'KL Hạ Cont (kg)',
            'KL Load Sà Lan (kg)',
            'KL Load Sà Lan (tấn)'
        ]);
        styleHeaderRow(repHeader);
        reportData.rows.forEach(r => {
            const dr = wsReport.addRow([
                r.displayDate,
                r.containerIn,
                r.containerOut,
                r.containerLoad,
                r.haWeightKg,
                r.loadWeightKg,
                r.loadWeightTons
            ]);
            styleDataRow(dr);
            dr.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            for (let c = 2; c <= 6; c++) dr.getCell(c).numFmt = '#,##0';
            dr.getCell(7).numFmt = '#,##0.00';
        });
        const repTotal = wsReport.addRow([
            'TỔNG CỘNG',
            reportData.totalIn,
            reportData.totalOut,
            reportData.totalLoad,
            reportData.totalHaWeightKg,
            reportData.totalLoadWeightKg,
            Math.round((reportData.totalLoadWeightKg / 1000) * 1000) / 1000
        ]);
        repTotal.eachCell((cell: any) => {
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2ECFC' } };
            cell.border = thinBorder;
        });
        wsReport.columns = [
            { width: 18 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 18 }, { width: 20 }, { width: 20 }
        ];

        // 2. Sheet TRẠNG THÁI (theo Ngày thực tế)
        const statusData = computeContainerStatuses(events);
        const wsStatus = wb.addWorksheet('TRẠNG THÁI');
        wsStatus.addRow(['TRẠNG THÁI BÃI CONTAINER - EASTWOOD (THEO NGÀY GIỜ THỰC TẾ)']);
        wsStatus.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
        wsStatus.addRow([
            `Cont có hàng: ${statusData.summary.loadedCount}`,
            `Cont rỗng (đã xá): ${statusData.summary.emptyCount}`,
            `Đã trả: ${statusData.summary.returnedCount}`,
            `Tổng theo dõi: ${statusData.summary.totalTracked}`
        ]);
        wsStatus.getRow(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF4A78C2' } };
        wsStatus.addRow([]);
        const stHeader = wsStatus.addRow([
            'STT',
            'Số Container',
            'Hạ Cont (Thực tế)',
            'Load Cont (Thực tế)',
            'Trả Cont (Thực tế)',
            'Trạng thái Cont',
            'Có/Không ván',
            'Tàu / Sà lan',
            'Cảnh báo'
        ]);
        styleHeaderRow(stHeader);
        statusData.rows.forEach((r, idx) => {
            const dr = wsStatus.addRow([
                idx + 1,
                r.containerNo,
                formatEventDatetimeDisplay(r.latestHaContDatetime),
                formatEventDatetimeDisplay(r.latestLoadContDatetime),
                formatEventDatetimeDisplay(r.latestTraContDatetime),
                r.statusLabel,
                r.latestBoardType || '',
                r.latestVesselName || r.latestBargeInfo || '',
                r.warningText || ''
            ]);
            styleDataRow(dr);
            dr.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            dr.getCell(2).font = { name: 'Calibri', size: 10.5, bold: true };
        });
        wsStatus.columns = [
            { width: 8 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 15 }, { width: 28 }, { width: 30 }
        ];

        // Filter detail events by reportDate if range provided
        const filterDetail = (flow: EastwoodContainerFlowType) =>
            events
                .filter(e => {
                    if (e.flowType !== flow) return false;
                    if (options?.fromDate && e.reportDate < options.fromDate) return false;
                    if (options?.toDate && e.reportDate > options.toDate) return false;
                    return true;
                })
                .sort((a, b) => (b.eventDatetime || '').localeCompare(a.eventDatetime || ''));

        // 3. Sheet HẠ CONT
        const wsHa = wb.addWorksheet('HẠ CONT');
        const haHeader = wsHa.addRow([
            'STT', 'Số Phiếu', 'Ngày thực tế', 'Ngày báo cáo ca', 'Số xe', 'Rơ-moóc',
            'Số Container', 'Số Seal', 'Có/Không ván', 'KL Hàng (kg)', 'Giờ vào', 'Giờ ra', 'Nguồn/Bãi', 'Ghi chú'
        ]);
        styleHeaderRow(haHeader);
        filterDetail('HA_CONT').forEach((e, idx) => {
            const dr = wsHa.addRow([
                idx + 1, e.soPhieu, formatIsoToDmy(e.actualDate), formatIsoToDmy(e.reportDate),
                e.plateNumber, e.romoocNo || '', e.containerNo, e.sealNo || '', e.boardType || '',
                e.netWeightKg, e.weighInTime || '', e.weighOutTime || '', e.sourceFactory || e.warehouseNote || '', e.remark || ''
            ]);
            styleDataRow(dr);
            dr.getCell(10).numFmt = '#,##0';
        });
        wsHa.columns = [
            { width: 7 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 15 }, { width: 15 },
            { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 22 }, { width: 24 }
        ];

        // 4. Sheet LOAD CONT
        const wsLoad = wb.addWorksheet('LOAD CONT');
        const loadHeader = wsLoad.addRow([
            'STT', 'Số Phiếu', 'Mã lệnh', 'Ngày thực tế', 'Ngày báo cáo ca', 'Số xe',
            'Số Container', 'Có/Không ván', 'Tổng TL (kg)', 'Xác xe (kg)', 'KL Hàng (kg)', 'Giờ vào', 'Giờ ra', 'Sà lan', 'Tàu mẹ', 'Ghi chú'
        ]);
        styleHeaderRow(loadHeader);
        filterDetail('LOAD_CONT').forEach((e, idx) => {
            const dr = wsLoad.addRow([
                idx + 1, e.soPhieu, e.maLenh || '', formatIsoToDmy(e.actualDate), formatIsoToDmy(e.reportDate),
                e.plateNumber, e.containerNo, e.boardType || '', e.grossWeightKg, e.tareWeightKg, e.netWeightKg,
                e.weighInTime || '', e.weighOutTime || '', e.bargeInfo || '', e.vesselName || '', e.remark || ''
            ]);
            styleDataRow(dr);
            dr.getCell(9).numFmt = '#,##0';
            dr.getCell(10).numFmt = '#,##0';
            dr.getCell(11).numFmt = '#,##0';
        });
        wsLoad.columns = [
            { width: 7 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 15 },
            { width: 16 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 11 }, { width: 32 }, { width: 20 }, { width: 22 }
        ];

        // 5. Sheet TRẢ CONT
        const wsTra = wb.addWorksheet('TRẢ CONT');
        const traHeader = wsTra.addRow([
            'STT', 'Số Phiếu', 'Ngày thực tế', 'Ngày báo cáo ca', 'Số xe', 'Rơ-moóc',
            'Số Container', 'Giờ vào', 'Giờ ra', 'Ghi chú'
        ]);
        styleHeaderRow(traHeader);
        filterDetail('TRA_CONT').forEach((e, idx) => {
            const dr = wsTra.addRow([
                idx + 1, e.soPhieu, formatIsoToDmy(e.actualDate), formatIsoToDmy(e.reportDate),
                e.plateNumber, e.romoocNo || '', e.containerNo, e.weighInTime || '', e.weighOutTime || '', e.remark || ''
            ]);
            styleDataRow(dr);
        });
        wsTra.columns = [
            { width: 7 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 15 }, { width: 15 },
            { width: 16 }, { width: 12 }, { width: 12 }, { width: 24 }
        ];

        const outBuffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([outBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        a.href = url;
        a.download = `REPORT_CONTAINER_EASTWOOD_${dd}${mm}${yyyy}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
