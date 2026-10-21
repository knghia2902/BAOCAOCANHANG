import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';
import { WeighbridgeService, type Vessel } from '@/services/weighbridge/WeighbridgeService';
import type {
    WarehouseId,
    WarehouseFlowType,
    WarehouseInventoryTicket,
    WarehouseConfig,
    WarehouseVehicleMap,
    WarehouseFinalRow,
    WarehouseImportSummary
} from '@/types/excel';

export const ALL_WAREHOUSES: WarehouseId[] = ['KHO 1', 'KHO 2', 'KHO 3', 'KHO 4'];

const LOCAL_TICKETS_KEY = 'warehouse_inventory_tickets';
const LOCAL_CONFIGS_KEY = 'warehouse_configs';
const LOCAL_VEHICLES_KEY = 'warehouse_vehicles';

function round2(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function stripAccents(str: string): string {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

export function normalizePlateKey(plate: string): string {
    if (!plate) return '';
    const mainPart = String(plate).split('/')[0] || String(plate);
    return mainPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function normalizeWarehouseId(raw: string | undefined | null): WarehouseId | null {
    if (!raw) return null;
    const clean = stripAccents(String(raw)).toUpperCase().trim();
    if (/\b(KHO\s*1|KHO1|IMPORT\s*(KHO\s*)?1|EXPORT\s*(KH(O)?\s*)?1|FINAL\s*1)\b/.test(clean)) return 'KHO 1';
    if (/\b(KHO\s*2|KHO2|IMPORT\s*(KHO\s*)?2|EXPORT\s*(KH(O)?\s*)?2|FINAL\s*2)\b/.test(clean)) return 'KHO 2';
    if (/\b(KHO\s*3|KHO3|IMPORT\s*(KHO\s*)?3|EXPORT\s*(KH(O)?\s*)?3|FINAL\s*3)\b/.test(clean)) return 'KHO 3';
    if (/\b(KHO\s*4|KHO4|IMPORT\s*(KHO\s*)?4|EXPORT\s*(KH(O)?\s*)?4|FINAL\s*4)\b/.test(clean)) return 'KHO 4';
    return null;
}

/**
 * Parse a date value (string DD/MM/YYYY, YYYY-MM-DD, Date object, or Excel serial) into YYYY-MM-DD
 */
export function parseToIsoDate(rawDate: any): string {
    if (!rawDate && rawDate !== 0) return '';
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        // Use UTC components if hours are near midnight UTC (ExcelJS dates)
        const y = rawDate.getFullYear();
        const m = String(rawDate.getMonth() + 1).padStart(2, '0');
        const d = String(rawDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof rawDate === 'number' && rawDate > 20000 && rawDate < 90000) {
        const utcDays = Math.floor(rawDate - 25569);
        const dt = new Date(utcDays * 86400 * 1000);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const str = String(rawDate).trim().split(' ')[0] || '';
    if (!str) return '';

    // Check YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const y = isoMatch[1]!;
        const m = isoMatch[2]!.padStart(2, '0');
        const d = isoMatch[3]!.padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmyMatch) {
        const d = dmyMatch[1]!.padStart(2, '0');
        const m = dmyMatch[2]!.padStart(2, '0');
        let y = dmyMatch[3]!;
        if (y.length === 2) y = '20' + y;
        return `${y}-${m}-${d}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return '';
}

/**
 * Parse a time value (HH:mm:ss, HH:mm, Date, or Excel fraction 0..1) into HH:mm:ss
 */
export function parseToTimeStr(rawTime: any): string {
    if (rawTime === null || rawTime === undefined || rawTime === '') return '';
    if (rawTime instanceof Date && !isNaN(rawTime.getTime())) {
        const hh = String(rawTime.getUTCHours()).padStart(2, '0');
        const mm = String(rawTime.getUTCMinutes()).padStart(2, '0');
        const ss = String(rawTime.getUTCSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    if (typeof rawTime === 'number' && rawTime >= 0 && rawTime < 1) {
        const totalSeconds = Math.round(rawTime * 86400);
        const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSeconds % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }
    const str = String(rawTime).trim();
    // If numeric string between 0 and 1 (e.g. "0.3958333")
    if (/^0\.\d+$/.test(str)) {
        const frac = parseFloat(str);
        const totalSeconds = Math.round(frac * 86400);
        const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSeconds % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    // Match HH:mm(:ss) with optional AM/PM
    const timeMatch = str.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM|SA|CH)?/i);
    if (timeMatch) {
        let hh = parseInt(timeMatch[1]!, 10);
        const mm = String(parseInt(timeMatch[2]!, 10)).padStart(2, '0');
        const ss = String(parseInt(timeMatch[3] || '0', 10)).padStart(2, '0');
        const ampm = (timeMatch[4] || '').toUpperCase();
        if ((ampm === 'PM' || ampm === 'CH') && hh < 12) hh += 12;
        if ((ampm === 'AM' || ampm === 'SA') && hh === 12) hh = 0;
        return `${String(hh).padStart(2, '0')}:${mm}:${ss}`;
    }
    return '';
}

/**
 * Compute reportDate (YYYY-MM-DD) using the 06:00 AM shift cutoff rule:
 * Any ticket weighed out between 00:00:00 and 05:59:59 on date D belongs to reportDate = D - 1 day.
 */
export function computeReportDate(weighOutDateRaw: any, weighOutTimeRaw?: any, applySixAmCutoff = true): string {
    const isoDate = parseToIsoDate(weighOutDateRaw);
    if (!isoDate) return '';

    const timeStr = parseToTimeStr(weighOutTimeRaw);
    if (!applySixAmCutoff || !timeStr) {
        return isoDate;
    }

    const hour = parseInt(timeStr.split(':')[0] || '0', 10);
    if (!isNaN(hour) && hour >= 0 && hour < 6) {
        const parts = isoDate.split('-').map(Number);
        const dt = new Date(Date.UTC(parts[0]!, (parts[1] || 1) - 1, parts[2] || 1));
        dt.setUTCDate(dt.getUTCDate() - 1);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return isoDate;
}

export function formatIsoToDmy(isoDate: string): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
}

export function normalizeWeightToTons(rawVal: any): number {
    if (rawVal === null || rawVal === undefined || rawVal === '') return 0;
    const num = typeof rawVal === 'number'
        ? rawVal
        : parseFloat(String(rawVal).replace(/,/g, '').trim()) || 0;
    if (Math.abs(num) > 500) {
        return round2(num / 1000);
    }
    return round2(num);
}

export function normalizeWeightToKg(rawVal: any): number {
    if (rawVal === null || rawVal === undefined || rawVal === '') return 0;
    const num = typeof rawVal === 'number'
        ? rawVal
        : parseFloat(String(rawVal).replace(/,/g, '').trim()) || 0;
    if (Math.abs(num) > 0 && Math.abs(num) <= 500) {
        return Math.round(num * 1000);
    }
    return Math.round(num);
}

function getDefaultConfigs(): Record<WarehouseId, WarehouseConfig> {
    return {
        'KHO 1': {
            warehouseId: 'KHO 1',
            initialStock: 0,
            initialDate: '',
            currentCustomer: 'GỖ BÌNH ĐỊNH',
            dailyRemarks: {}
        },
        'KHO 2': {
            warehouseId: 'KHO 2',
            initialStock: 0,
            initialDate: '',
            currentCustomer: 'GỖ BÌNH ĐỊNH',
            dailyRemarks: {}
        },
        'KHO 3': {
            warehouseId: 'KHO 3',
            initialStock: 0,
            initialDate: '',
            currentCustomer: 'GỖ BÌNH ĐỊNH',
            dailyRemarks: {}
        },
        'KHO 4': {
            warehouseId: 'KHO 4',
            initialStock: 0,
            initialDate: '',
            currentCustomer: 'EASTWOOD',
            dailyRemarks: {}
        }
    };
}

export function lookupCarrierName(plate: string, vehicleMap: Record<string, WarehouseVehicleMap>): string {
    if (!plate) return '';
    const norm = normalizePlateKey(plate);
    if (!norm) return '';
    if (vehicleMap[norm]) {
        return vehicleMap[norm].carrierName;
    }
    // Check if full plate with trailer was stored
    const fullNorm = String(plate).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (vehicleMap[fullNorm]) {
        return vehicleMap[fullNorm].carrierName;
    }
    return '';
}

export function resolveVesselNameFromBarge(bargeInfo: string, maLenh: string, vessels: Vessel[]): string {
    if (!vessels || vessels.length === 0) return '';
    const cleanBargeInfo = stripAccents(bargeInfo || '').toUpperCase().trim();
    const cleanOrder = stripAccents(maLenh || '').toUpperCase().trim();

    for (const v of vessels) {
        if (!v.barges) continue;
        for (const b of v.barges) {
            const bOrder = stripAccents(b.config?.orderNo || b.order_no || '').toUpperCase().trim();
            const bName = stripAccents(b.name || '').toUpperCase().trim();
            if (bOrder && (bOrder === cleanOrder || (cleanBargeInfo && cleanBargeInfo.includes(bOrder)))) {
                return v.name || '';
            }
            if (bName && cleanBargeInfo && (cleanBargeInfo === bName || cleanBargeInfo.startsWith(bName))) {
                return v.name || '';
            }
        }
    }
    return '';
}

export interface RawWeighbridgeRow {
    soPhieu: string;
    maLenh: string;
    soXe: string;
    khachHang: string;
    kl1: number;
    kl2: number;
    klHang: number;
    ngay1: string;
    gio1: string;
    ngay2: string;
    gio2: string;
    xuatNhap: string;
    loaiHang: string;
    loaiSalan: string;
    taiXe: string;
    ghiChu: string;
}

/**
 * Classify a single CSV/Excel weighbridge row into IMPORT, EXPORT, DIRECT, or null (ignored)
 */
export function classifyWeighbridgeRow(
    row: RawWeighbridgeRow,
    vehicleMap: Record<string, WarehouseVehicleMap> = {},
    vessels: Vessel[] = []
): WarehouseInventoryTicket | null {
    const dirClean = stripAccents(row.xuatNhap || '').toUpperCase().trim();
    const cargoClean = stripAccents(row.loaiHang || '').toUpperCase().trim();
    const weighOutDate = parseToIsoDate(row.ngay2 || row.ngay1);
    const weighOutTime = parseToTimeStr(row.gio2 || row.gio1);
    if (!weighOutDate || !row.soXe) return null;

    const reportDate = computeReportDate(weighOutDate, weighOutTime, true);
    const grossWeight = normalizeWeightToTons(row.kl1);
    const tareWeight = normalizeWeightToTons(row.kl2);
    let netWeight = normalizeWeightToTons(row.klHang);
    if (netWeight <= 0 && grossWeight > 0 && tareWeight > 0) {
        netWeight = round2(Math.abs(grossWeight - tareWeight));
    }
    if (netWeight <= 0) return null;

    const carrierName = lookupCarrierName(row.soXe, vehicleMap);

    // 1. Check IMPORT: Xuat/Nhap = Nhap AND Loai Salan = KHO 1..4
    if (dirClean.includes('NHAP')) {
        const targetWh = normalizeWarehouseId(row.loaiSalan) || normalizeWarehouseId(row.taiXe);
        if (!targetWh) {
            // Non-warehouse import (e.g. agricultural BẮP from barge TG 15767) -> ignore in Warehouse Inventory
            return null;
        }
        let factoryWeight: number | null = null;
        if (row.ghiChu) {
            const parsedNoteNum = parseFloat(String(row.ghiChu).replace(/,/g, '').trim());
            if (!isNaN(parsedNoteNum) && parsedNoteNum > 0) {
                factoryWeight = normalizeWeightToTons(parsedNoteNum);
            }
        }
        const id = `IMPORT_${targetWh}_${row.soPhieu || normalizePlateKey(row.soXe)}_${weighOutDate}_${weighOutTime || '00:00:00'}`;
        return {
            id,
            soPhieu: String(row.soPhieu || '').trim(),
            maLenh: String(row.maLenh || '').trim(),
            reportDate,
            weighInDate: parseToIsoDate(row.ngay1) || weighOutDate,
            weighInTime: parseToTimeStr(row.gio1),
            weighOutDate,
            weighOutTime,
            flowType: 'IMPORT',
            warehouseId: targetWh,
            customerName: String(row.khachHang || '').trim(),
            cargoType: String(row.loaiHang || '').trim(),
            vehiclePlate: String(row.soXe || '').trim(),
            carrierName,
            grossWeight,
            tareWeight,
            netWeight,
            factoryWeight,
            bargeInfo: '',
            vesselName: '',
            sourceOrRemark: String(row.taiXe || '').trim(),
            rawNote: String(row.ghiChu || '').trim()
        };
    }

    // 2. Check EXPORT or DIRECT: Xuat/Nhap = Xuat
    if (dirClean.includes('XUAT')) {
        // Ignore agricultural feed exports if any (BẮP, LÚA MÌ, ĐẬU NÀNH)
        if (/\b(BAP|LUA MI|DAU NANH|CAM)\b/.test(cargoClean) && !cargoClean.includes('GO') && !cargoClean.includes('VIEN NEN')) {
            return null;
        }

        const exportWh = normalizeWarehouseId(row.taiXe);
        const vesselName = resolveVesselNameFromBarge(row.loaiSalan, row.maLenh, vessels);

        if (exportWh) {
            const id = `EXPORT_${exportWh}_${row.soPhieu || normalizePlateKey(row.soXe)}_${weighOutDate}_${weighOutTime || '00:00:00'}`;
            return {
                id,
                soPhieu: String(row.soPhieu || '').trim(),
                maLenh: String(row.maLenh || '').trim(),
                reportDate,
                weighInDate: parseToIsoDate(row.ngay1) || weighOutDate,
                weighInTime: parseToTimeStr(row.gio1),
                weighOutDate,
                weighOutTime,
                flowType: 'EXPORT',
                warehouseId: exportWh,
                customerName: String(row.khachHang || '').trim(),
                cargoType: String(row.loaiHang || '').trim(),
                vehiclePlate: String(row.soXe || '').trim(),
                carrierName,
                grossWeight,
                tareWeight,
                netWeight,
                factoryWeight: null,
                bargeInfo: String(row.loaiSalan || '').trim(),
                vesselName,
                sourceOrRemark: String(row.taiXe || '').trim(),
                rawNote: String(row.ghiChu || '').trim()
            };
        } else {
            const id = `DIRECT_${row.soPhieu || normalizePlateKey(row.soXe)}_${weighOutDate}_${weighOutTime || '00:00:00'}`;
            return {
                id,
                soPhieu: String(row.soPhieu || '').trim(),
                maLenh: String(row.maLenh || '').trim(),
                reportDate,
                weighInDate: parseToIsoDate(row.ngay1) || weighOutDate,
                weighInTime: parseToTimeStr(row.gio1),
                weighOutDate,
                weighOutTime,
                flowType: 'DIRECT',
                warehouseId: null,
                customerName: String(row.khachHang || '').trim(),
                cargoType: String(row.loaiHang || '').trim(),
                vehiclePlate: String(row.soXe || '').trim(),
                carrierName,
                grossWeight,
                tareWeight,
                netWeight,
                factoryWeight: null,
                bargeInfo: String(row.loaiSalan || '').trim(),
                vesselName,
                sourceOrRemark: String(row.taiXe || '').trim(),
                rawNote: String(row.ghiChu || '').trim()
            };
        }
    }

    return null;
}

/**
 * Compute continuous cumulative FINAL summary table for a specific warehouse
 */
export function computeWarehouseFinalTable(
    warehouseId: WarehouseId,
    allTickets: WarehouseInventoryTicket[],
    config: WarehouseConfig,
    options?: {
        fromDate?: string;
        toDate?: string;
        includeDirectForCustomer?: boolean;
    }
): {
    openingStockBeforeFilter: number;
    rows: WarehouseFinalRow[];
    totalImportTons: number;
    totalImportTrips: number;
    totalExportTons: number;
    totalExportTrips: number;
    totalDirectTons: number;
    totalDirectTrips: number;
    closingStockTons: number;
} {
    const whTickets = allTickets.filter(t => t.warehouseId === warehouseId && (t.flowType === 'IMPORT' || t.flowType === 'EXPORT'));
    const currentCustomerClean = stripAccents(config.currentCustomer || '').toUpperCase().trim();

    // Direct tickets matching this warehouse's customer (or all direct tickets if warehouse is KHO 4 / EW or GBD)
    const directTickets = allTickets.filter(t => {
        if (t.flowType !== 'DIRECT') return false;
        if (options?.includeDirectForCustomer === false) return false;
        if (!currentCustomerClean) return true;
        const tCust = stripAccents(t.customerName || '').toUpperCase().trim();
        if (!tCust) return true;
        return tCust.includes(currentCustomerClean) || currentCustomerClean.includes(tCust);
    });

    const dateSet = new Set<string>();
    whTickets.forEach(t => {
        if (t.reportDate) dateSet.add(t.reportDate);
    });
    Object.keys(config.dailyRemarks || {}).forEach(d => {
        if (d) dateSet.add(d);
    });
    // Include direct ticket dates only if warehouse already has activity or matching customer
    if (whTickets.length > 0) {
        const minWhDate = whTickets.map(t => t.reportDate).sort()[0] || '';
        directTickets.forEach(t => {
            if (t.reportDate && (!minWhDate || t.reportDate >= minWhDate)) {
                dateSet.add(t.reportDate);
            }
        });
    }

    const sortedDates = Array.from(dateSet).filter(Boolean).sort();
    let runningStock = round2(config.initialStock || 0);
    let openingStockBeforeFilter = runningStock;

    const allRows: WarehouseFinalRow[] = [];

    for (const d of sortedDates) {
        const dayImports = whTickets.filter(t => t.flowType === 'IMPORT' && t.reportDate === d);
        const dayExports = whTickets.filter(t => t.flowType === 'EXPORT' && t.reportDate === d);
        const dayDirects = directTickets.filter(t => t.reportDate === d);

        const importTons = round2(dayImports.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        const exportTons = round2(dayExports.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        const directTons = round2(dayDirects.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));

        if (options?.fromDate && d < options.fromDate) {
            runningStock = round2(runningStock + importTons - exportTons);
            openingStockBeforeFilter = runningStock;
            continue;
        }

        runningStock = round2(runningStock + importTons - exportTons);

        const vesselsOnDay = Array.from(
            new Set(
                dayExports
                    .map(t => (t.vesselName || '').trim())
                    .filter(Boolean)
            )
        );
        const bargesOnDay = Array.from(
            new Set(
                dayExports
                    .map(t => (t.bargeInfo || '').trim().split('(')[0]?.trim() || '')
                    .filter(Boolean)
            )
        );

        let autoRemark = '';
        if (vesselsOnDay.length > 0) {
            autoRemark = `Xuất tàu ${vesselsOnDay.join(', ')}`;
        } else if (bargesOnDay.length > 0) {
            autoRemark = `Xuất SL ${bargesOnDay.join(', ')}`;
        }

        const manualRemark = (config.dailyRemarks && config.dailyRemarks[d]) ? config.dailyRemarks[d]! : '';
        const customers = Array.from(
            new Set(
                [...dayImports, ...dayExports]
                    .map(t => (t.customerName || '').trim())
                    .filter(Boolean)
            )
        );

        allRows.push({
            reportDate: d,
            displayDate: formatIsoToDmy(d),
            importTons,
            importTrips: dayImports.length,
            exportTons,
            exportTrips: dayExports.length,
            directTons,
            directTrips: dayDirects.length,
            remainingStockTons: runningStock,
            remark: manualRemark !== '' ? manualRemark : autoRemark,
            autoRemark,
            manualRemark,
            customers
        });
    }

    const filteredRows = options?.toDate
        ? allRows.filter(r => r.reportDate <= options.toDate!)
        : allRows;

    const totalImportTons = round2(filteredRows.reduce((s, r) => s + r.importTons, 0));
    const totalImportTrips = filteredRows.reduce((s, r) => s + r.importTrips, 0);
    const totalExportTons = round2(filteredRows.reduce((s, r) => s + r.exportTons, 0));
    const totalExportTrips = filteredRows.reduce((s, r) => s + r.exportTrips, 0);
    const totalDirectTons = round2(filteredRows.reduce((s, r) => s + r.directTons, 0));
    const totalDirectTrips = filteredRows.reduce((s, r) => s + r.directTrips, 0);
    const closingStockTons = filteredRows.length > 0
        ? filteredRows[filteredRows.length - 1]!.remainingStockTons
        : openingStockBeforeFilter;

    return {
        openingStockBeforeFilter,
        rows: filteredRows,
        totalImportTons,
        totalImportTrips,
        totalExportTons,
        totalExportTrips,
        totalDirectTons,
        totalDirectTrips,
        closingStockTons
    };
}

// Helper to parse CSV text respecting quotes
export function parseWeighbridgeCsvText(text: string): RawWeighbridgeRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
        const res: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]!;
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                res.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        res.push(cur.trim());
        return res;
    };

    let headerIdx = 0;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const cols = parseLine(lines[i]!);
        const norm = cols.map(c => stripAccents(c).toLowerCase());
        if (norm.some(c => c.includes('phieu') || c.includes('so xe') || c.includes('kl hang'))) {
            headerIdx = i;
            headers = norm;
            break;
        }
    }
    if (headers.length === 0) {
        headers = parseLine(lines[0]!).map(c => stripAccents(c).toLowerCase());
    }

    const findCol = (pred: (h: string) => boolean) => headers.findIndex(pred);
    const idxSoPhieu = findCol(h => h.includes('so phieu') || h.includes('phieu'));
    const idxMaLenh = findCol(h => h.includes('ma lenh') || h.includes('lenh'));
    const idxSoXe = findCol(h => h.includes('so xe') || h.includes('bien so'));
    const idxKhachHang = findCol(h => h.includes('khach hang') || h.includes('khach'));
    const idxKl1 = findCol(h => h.includes('lan 1') && (h.includes('kl') || h.includes('tl') || h.includes('can')));
    const idxKl2 = findCol(h => h.includes('lan 2') && (h.includes('kl') || h.includes('tl') || h.includes('can')));
    const idxKlHang = findCol(h => h.includes('kl hang') || h.includes('tl hang') || h.includes('khoi luong hang'));
    const idxNgay1 = findCol(h => h.includes('ngay') && h.includes('1'));
    const idxGio1 = findCol(h => h.includes('gio') && h.includes('1'));
    const idxNgay2 = findCol(h => h.includes('ngay') && h.includes('2'));
    const idxGio2 = findCol(h => h.includes('gio') && h.includes('2'));
    const idxXuatNhap = findCol(h => h.includes('xuat/nhap') || h.includes('xuat nhap'));
    const idxLoaiHang = findCol(h => h.includes('loai hang') || h.includes('ten hang'));
    const idxLoaiSalan = findCol(h => h.includes('salan') || h.includes('sa lan'));
    const idxTaiXe = findCol(h => h.includes('tai xe') || h.includes('lai xe'));
    const idxGhiChu = findCol(h => h.includes('ghi chu'));

    const rows: RawWeighbridgeRow[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]!);
        if (cols.length < 4) continue;
        const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx]! : '');
        const getNum = (idx: number) => {
            const raw = get(idx).replace(/,/g, '').trim();
            return parseFloat(raw) || 0;
        };
        const soXe = get(idxSoXe);
        if (!soXe) continue;

        rows.push({
            soPhieu: get(idxSoPhieu),
            maLenh: get(idxMaLenh),
            soXe,
            khachHang: get(idxKhachHang),
            kl1: getNum(idxKl1),
            kl2: getNum(idxKl2),
            klHang: getNum(idxKlHang),
            ngay1: get(idxNgay1),
            gio1: get(idxGio1),
            ngay2: get(idxNgay2),
            gio2: get(idxGio2),
            xuatNhap: get(idxXuatNhap),
            loaiHang: get(idxLoaiHang),
            loaiSalan: get(idxLoaiSalan),
            taiXe: get(idxTaiXe),
            ghiChu: get(idxGhiChu)
        });
    }

    return rows;
}

async function readCsvFileDecoded(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
    const utf8Text = utf8Decoder.decode(buffer);
    if (utf8Text.includes('\uFFFD')) {
        try {
            const winDecoder = new TextDecoder('windows-1258');
            return winDecoder.decode(buffer);
        } catch (_) {
            return utf8Text;
        }
    }
    return utf8Text;
}

function mapDbTicketToModel(row: any): WarehouseInventoryTicket {
    return {
        id: row.id,
        soPhieu: row.so_phieu || row.soPhieu || '',
        maLenh: row.ma_lenh || row.maLenh || '',
        reportDate: row.report_date || row.reportDate || '',
        weighInDate: row.weigh_in_date || row.weighInDate || '',
        weighInTime: row.weigh_in_time || row.weighInTime || '',
        weighOutDate: row.weigh_out_date || row.weighOutDate || '',
        weighOutTime: row.weigh_out_time || row.weighOutTime || '',
        flowType: (row.flow_type || row.flowType || 'IMPORT') as WarehouseFlowType,
        warehouseId: (row.warehouse_id || row.warehouseId || null) as WarehouseId | null,
        customerName: row.customer_name || row.customerName || '',
        cargoType: row.cargo_type || row.cargoType || '',
        vehiclePlate: row.vehicle_plate || row.vehiclePlate || '',
        carrierName: row.carrier_name || row.carrierName || '',
        grossWeight: Number(row.gross_weight ?? row.grossWeight ?? 0),
        tareWeight: Number(row.tare_weight ?? row.tareWeight ?? 0),
        netWeight: Number(row.net_weight ?? row.netWeight ?? 0),
        factoryWeight: (row.factory_weight ?? row.factoryWeight) != null ? Number(row.factory_weight ?? row.factoryWeight) : null,
        bargeInfo: row.barge_info || row.bargeInfo || '',
        vesselName: row.vessel_name || row.vesselName || '',
        sourceOrRemark: row.source_or_remark || row.sourceOrRemark || '',
        rawNote: row.raw_note || row.rawNote || '',
        createdAt: row.created_at || row.createdAt
    };
}

function mapModelTicketToDb(t: WarehouseInventoryTicket): any {
    return {
        id: t.id,
        so_phieu: t.soPhieu || '',
        ma_lenh: t.maLenh || '',
        report_date: t.reportDate,
        weigh_in_date: t.weighInDate || '',
        weigh_in_time: t.weighInTime || '',
        weigh_out_date: t.weighOutDate,
        weigh_out_time: t.weighOutTime || '',
        flow_type: t.flowType,
        warehouse_id: t.warehouseId || null,
        customer_name: t.customerName || '',
        cargo_type: t.cargoType || '',
        vehicle_plate: t.vehiclePlate || '',
        carrier_name: t.carrierName || '',
        gross_weight: Number(t.grossWeight) || 0,
        tare_weight: Number(t.tareWeight) || 0,
        net_weight: Number(t.netWeight) || 0,
        factory_weight: t.factoryWeight != null ? Number(t.factoryWeight) : null,
        barge_info: t.bargeInfo || '',
        vessel_name: t.vesselName || '',
        source_or_remark: t.sourceOrRemark || '',
        raw_note: t.rawNote || ''
    };
}

let dedicatedTablesMissing = false;

function isTableMissingError(error: any): boolean {
    if (!error) return false;
    const msg = String(error.message || error.details || error.code || '').toLowerCase();
    return error.code === '42P01' || error.code === 'PGRST205' || msg.includes('could not find the table') || msg.includes('does not exist');
}

async function syncFallbackStateToContentSettings() {
    try {
        const [configs, vehicles, tickets] = await Promise.all([
            dbContext.get<any>(LOCAL_CONFIGS_KEY),
            dbContext.get<any>(LOCAL_VEHICLES_KEY),
            dbContext.get<any>(LOCAL_TICKETS_KEY)
        ]);
        const { data: current } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (current) {
            const updatedSettings = {
                ...(current.settings || {}),
                warehouse_inventory_state: {
                    configs: configs || {},
                    vehicles: vehicles || {},
                    tickets: tickets || [],
                    updatedAt: new Date().toISOString()
                }
            };
            await supabase
                .from('content')
                .update({ settings: updatedSettings })
                .eq('id', 'main');
        }
    } catch (_) {}
}

async function loadFallbackStateFromContentSettings(): Promise<{
    configs?: Record<WarehouseId, WarehouseConfig>;
    vehicles?: Record<string, WarehouseVehicleMap>;
    tickets?: WarehouseInventoryTicket[];
} | null> {
    try {
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (!error && data?.settings?.warehouse_inventory_state) {
            return data.settings.warehouse_inventory_state;
        }
    } catch (_) {}
    return null;
}

export const WarehouseInventoryService = {
    normalizeWarehouseId,
    normalizePlateKey,
    computeReportDate,
    parseToIsoDate,
    parseToTimeStr,
    formatIsoToDmy,
    classifyWeighbridgeRow,
    computeWarehouseFinalTable,
    parseWeighbridgeCsvText,

    async getConfigs(): Promise<Record<WarehouseId, WarehouseConfig>> {
        const defaults = getDefaultConfigs();
        const local = (await dbContext.get<Record<WarehouseId, WarehouseConfig>>(LOCAL_CONFIGS_KEY)) || {};
        const merged: Record<WarehouseId, WarehouseConfig> = {
            'KHO 1': { ...defaults['KHO 1'], ...(local['KHO 1'] || {}) },
            'KHO 2': { ...defaults['KHO 2'], ...(local['KHO 2'] || {}) },
            'KHO 3': { ...defaults['KHO 3'], ...(local['KHO 3'] || {}) },
            'KHO 4': { ...defaults['KHO 4'], ...(local['KHO 4'] || {}) }
        };

        if (!dedicatedTablesMissing) {
            try {
                const { data, error } = await supabase
                    .from('warehouse_configs')
                    .select('*');
                if (error && isTableMissingError(error)) {
                    dedicatedTablesMissing = true;
                } else if (!error && Array.isArray(data) && data.length > 0) {
                    for (const row of data) {
                        const whId = normalizeWarehouseId(row.warehouse_id);
                        if (whId) {
                            merged[whId] = {
                                warehouseId: whId,
                                initialStock: Number(row.initial_stock) || 0,
                                initialDate: row.initial_date || '',
                                currentCustomer: row.current_customer || merged[whId].currentCustomer,
                                dailyRemarks: row.daily_remarks || {},
                                updatedAt: row.updated_at
                            };
                        }
                    }
                    await dbContext.set(LOCAL_CONFIGS_KEY, merged);
                    return merged;
                }
            } catch (err) {
                console.warn('Fallback to local warehouse_configs:', err);
            }
        }

        if (dedicatedTablesMissing) {
            const fb = await loadFallbackStateFromContentSettings();
            if (fb?.configs) {
                for (const whId of ALL_WAREHOUSES) {
                    if (fb.configs[whId]) {
                        merged[whId] = { ...merged[whId], ...fb.configs[whId] };
                    }
                }
                await dbContext.set(LOCAL_CONFIGS_KEY, merged);
            }
        }

        return merged;
    },

    async saveConfig(config: WarehouseConfig): Promise<boolean> {
        const defaults = getDefaultConfigs();
        const local = (await dbContext.get<Record<WarehouseId, WarehouseConfig>>(LOCAL_CONFIGS_KEY)) || {};
        const current: Record<WarehouseId, WarehouseConfig> = {
            'KHO 1': { ...defaults['KHO 1'], ...(local['KHO 1'] || {}) },
            'KHO 2': { ...defaults['KHO 2'], ...(local['KHO 2'] || {}) },
            'KHO 3': { ...defaults['KHO 3'], ...(local['KHO 3'] || {}) },
            'KHO 4': { ...defaults['KHO 4'], ...(local['KHO 4'] || {}) }
        };
        current[config.warehouseId] = {
            ...config,
            updatedAt: new Date().toISOString()
        };
        await dbContext.set(LOCAL_CONFIGS_KEY, current);

        if (!dedicatedTablesMissing) {
            try {
                const { error } = await supabase
                    .from('warehouse_configs')
                    .upsert({
                        warehouse_id: config.warehouseId,
                        initial_stock: Number(config.initialStock) || 0,
                        initial_date: config.initialDate || '',
                        current_customer: config.currentCustomer || '',
                        daily_remarks: config.dailyRemarks || {},
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'warehouse_id' });
                if (error) {
                    if (isTableMissingError(error)) {
                        dedicatedTablesMissing = true;
                    } else {
                        console.warn('Supabase saveConfig warning (stored locally):', error.message);
                    }
                }
            } catch (err) {
                console.warn('Supabase saveConfig fallback:', err);
            }
        }

        if (dedicatedTablesMissing) {
            await syncFallbackStateToContentSettings();
        }
        return true;
    },

    async getVehicles(): Promise<Record<string, WarehouseVehicleMap>> {
        const local = (await dbContext.get<Record<string, WarehouseVehicleMap>>(LOCAL_VEHICLES_KEY)) || {};
        if (!dedicatedTablesMissing) {
            try {
                const { data, error } = await supabase
                    .from('warehouse_vehicles')
                    .select('*');
                if (error && isTableMissingError(error)) {
                    dedicatedTablesMissing = true;
                } else if (!error && Array.isArray(data) && data.length > 0) {
                    const map: Record<string, WarehouseVehicleMap> = { ...local };
                    for (const r of data) {
                        const key = normalizePlateKey(r.vehicle_plate || r.display_plate);
                        if (key) {
                            map[key] = {
                                vehiclePlate: key,
                                displayPlate: r.display_plate || r.vehicle_plate,
                                carrierName: r.carrier_name || ''
                            };
                        }
                    }
                    await dbContext.set(LOCAL_VEHICLES_KEY, map);
                    return map;
                }
            } catch (err) {
                console.warn('Fallback to local warehouse_vehicles:', err);
            }
        }

        if (dedicatedTablesMissing && Object.keys(local).length === 0) {
            const fb = await loadFallbackStateFromContentSettings();
            if (fb?.vehicles) {
                await dbContext.set(LOCAL_VEHICLES_KEY, fb.vehicles);
                return fb.vehicles;
            }
        }
        return local;
    },

    async saveVehiclesBulk(vehicles: WarehouseVehicleMap[]): Promise<number> {
        if (!vehicles || vehicles.length === 0) return 0;
        const current = (await dbContext.get<Record<string, WarehouseVehicleMap>>(LOCAL_VEHICLES_KEY)) || {};
        const dbRows: any[] = [];

        for (const v of vehicles) {
            const key = normalizePlateKey(v.vehiclePlate || v.displayPlate);
            if (!key || !v.carrierName) continue;
            current[key] = {
                vehiclePlate: key,
                displayPlate: (v.displayPlate || v.vehiclePlate).trim(),
                carrierName: v.carrierName.trim()
            };
            dbRows.push({
                vehicle_plate: key,
                display_plate: current[key].displayPlate,
                carrier_name: current[key].carrierName,
                updated_at: new Date().toISOString()
            });
        }

        await dbContext.set(LOCAL_VEHICLES_KEY, current);

        if (dbRows.length > 0 && !dedicatedTablesMissing) {
            try {
                const chunkSize = 500;
                for (let i = 0; i < dbRows.length; i += chunkSize) {
                    const chunk = dbRows.slice(i, i + chunkSize);
                    const { error } = await supabase.from('warehouse_vehicles').upsert(chunk, { onConflict: 'vehicle_plate' });
                    if (error && isTableMissingError(error)) {
                        dedicatedTablesMissing = true;
                        break;
                    }
                }
            } catch (err) {
                console.warn('Supabase saveVehiclesBulk fallback:', err);
            }
        }

        if (dedicatedTablesMissing) {
            await syncFallbackStateToContentSettings();
        }
        return dbRows.length;
    },

    async deleteVehicle(vehiclePlate: string): Promise<boolean> {
        const key = normalizePlateKey(vehiclePlate);
        const current = (await dbContext.get<Record<string, WarehouseVehicleMap>>(LOCAL_VEHICLES_KEY)) || {};
        delete current[key];
        await dbContext.set(LOCAL_VEHICLES_KEY, current);
        if (!dedicatedTablesMissing) {
            try {
                await supabase.from('warehouse_vehicles').delete().eq('vehicle_plate', key);
            } catch (_) {}
        } else {
            await syncFallbackStateToContentSettings();
        }
        return true;
    },

    async getAllTickets(): Promise<WarehouseInventoryTicket[]> {
        const local = (await dbContext.get<WarehouseInventoryTicket[]>(LOCAL_TICKETS_KEY)) || [];
        if (!dedicatedTablesMissing) {
            try {
                const allRemote: WarehouseInventoryTicket[] = [];
                const pageSize = 1000;
                let from = 0;
                let hasError = false;

                while (true) {
                    const { data, error } = await supabase
                        .from('warehouse_inventory_tickets')
                        .select('*')
                        .order('report_date', { ascending: true })
                        .order('weigh_out_time', { ascending: true })
                        .range(from, from + pageSize - 1);

                    if (error) {
                        if (isTableMissingError(error)) {
                            dedicatedTablesMissing = true;
                        }
                        hasError = true;
                        break;
                    }
                    if (!data || data.length === 0) break;
                    allRemote.push(...data.map(mapDbTicketToModel));
                    if (data.length < pageSize) break;
                    from += pageSize;
                }

                if (!hasError && allRemote.length > 0) {
                    const mergedMap = new Map<string, WarehouseInventoryTicket>();
                    for (const t of local) mergedMap.set(t.id, t);
                    for (const t of allRemote) mergedMap.set(t.id, t);
                    const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
                        if (a.reportDate !== b.reportDate) return a.reportDate.localeCompare(b.reportDate);
                        return (a.weighOutTime || '').localeCompare(b.weighOutTime || '');
                    });
                    await dbContext.set(LOCAL_TICKETS_KEY, mergedList);
                    return mergedList;
                }
            } catch (err) {
                console.warn('Fallback to local warehouse_inventory_tickets:', err);
            }
        }

        if (dedicatedTablesMissing && local.length === 0) {
            const fb = await loadFallbackStateFromContentSettings();
            if (fb?.tickets && Array.isArray(fb.tickets) && fb.tickets.length > 0) {
                await dbContext.set(LOCAL_TICKETS_KEY, fb.tickets);
                return fb.tickets;
            }
        }

        return local.sort((a, b) => {
            if (a.reportDate !== b.reportDate) return a.reportDate.localeCompare(b.reportDate);
            return (a.weighOutTime || '').localeCompare(b.weighOutTime || '');
        });
    },

    async saveTicketsBulk(tickets: WarehouseInventoryTicket[]): Promise<number> {
        if (!tickets || tickets.length === 0) return 0;
        const current = (await dbContext.get<WarehouseInventoryTicket[]>(LOCAL_TICKETS_KEY)) || [];
        const map = new Map<string, WarehouseInventoryTicket>();
        for (const t of current) map.set(t.id, t);
        for (const t of tickets) map.set(t.id, t);

        const merged = Array.from(map.values()).sort((a, b) => {
            if (a.reportDate !== b.reportDate) return a.reportDate.localeCompare(b.reportDate);
            return (a.weighOutTime || '').localeCompare(b.weighOutTime || '');
        });

        await dbContext.set(LOCAL_TICKETS_KEY, merged);

        if (!dedicatedTablesMissing) {
            try {
                const dbRows = tickets.map(mapModelTicketToDb);
                const chunkSize = 500;
                for (let i = 0; i < dbRows.length; i += chunkSize) {
                    const chunk = dbRows.slice(i, i + chunkSize);
                    const { error } = await supabase
                        .from('warehouse_inventory_tickets')
                        .upsert(chunk, { onConflict: 'id' });
                    if (error) {
                        if (isTableMissingError(error)) {
                            dedicatedTablesMissing = true;
                        } else {
                            console.warn('Supabase saveTicketsBulk chunk warning (saved locally):', error.message);
                        }
                        break;
                    }
                }
            } catch (err) {
                console.warn('Supabase saveTicketsBulk fallback:', err);
            }
        }

        if (dedicatedTablesMissing) {
            await syncFallbackStateToContentSettings();
        }

        return tickets.length;
    },

    async updateTicket(ticket: WarehouseInventoryTicket): Promise<boolean> {
        await this.saveTicketsBulk([ticket]);
        return true;
    },

    async deleteTicket(ticketId: string): Promise<boolean> {
        const current = (await dbContext.get<WarehouseInventoryTicket[]>(LOCAL_TICKETS_KEY)) || [];
        const filtered = current.filter(t => t.id !== ticketId);
        await dbContext.set(LOCAL_TICKETS_KEY, filtered);
        try {
            await supabase.from('warehouse_inventory_tickets').delete().eq('id', ticketId);
        } catch (_) {}
        return true;
    },

    async clearWarehouseTickets(warehouseId?: WarehouseId | 'ALL'): Promise<boolean> {
        const current = (await dbContext.get<WarehouseInventoryTicket[]>(LOCAL_TICKETS_KEY)) || [];
        if (!warehouseId || warehouseId === 'ALL') {
            await dbContext.set(LOCAL_TICKETS_KEY, []);
            try {
                await supabase.from('warehouse_inventory_tickets').delete().neq('id', '');
            } catch (_) {}
            return true;
        }
        const remaining = current.filter(t => t.warehouseId !== warehouseId);
        await dbContext.set(LOCAL_TICKETS_KEY, remaining);
        try {
            await supabase.from('warehouse_inventory_tickets').delete().eq('warehouse_id', warehouseId);
        } catch (_) {}
        return true;
    },

    async reapplyVehicleCarriers(): Promise<number> {
        const vehicleMap = await this.getVehicles();
        const tickets = await this.getAllTickets();
        const updated: WarehouseInventoryTicket[] = [];

        for (const t of tickets) {
            const lookedUp = lookupCarrierName(t.vehiclePlate, vehicleMap);
            if (lookedUp && lookedUp !== t.carrierName) {
                t.carrierName = lookedUp;
                updated.push(t);
            }
        }
        if (updated.length > 0) {
            await this.saveTicketsBulk(updated);
        }
        return updated.length;
    },

    /**
     * Single-Point Import Sync: Push EXPORT & DIRECT weighbridge rows directly to
     * `allocator_tickets` (CargoAllocator Tab 1) AND matching unlocked Barges in `WeighbridgeService`.
     */
    async syncExportRowsToAllocator(rawRows: RawWeighbridgeRow[]): Promise<{
        syncedTicketsCount: number;
        matchedBargesCount: number;
    }> {
        const exportRows = rawRows.filter(r => stripAccents(r.xuatNhap || '').toUpperCase().includes('XUAT'));
        if (exportRows.length === 0) {
            return { syncedTicketsCount: 0, matchedBargesCount: 0 };
        }

        // 1. Merge into allocator_tickets (stored in kg)
        const existingAllocatorTickets = (await dbContext.get<any[]>('allocator_tickets')) || [];
        let syncedCount = 0;

        for (const r of exportRows) {
            const ticketNo = String(r.soPhieu || '').trim();
            const plateNumber = String(r.soXe || '').trim();
            const weight1 = normalizeWeightToKg(r.kl1);
            const weight2 = normalizeWeightToKg(r.kl2);
            let weightNet = normalizeWeightToKg(r.klHang);
            if (weightNet <= 0 && weight1 > 0 && weight2 > 0) {
                weightNet = Math.abs(weight1 - weight2);
            }
            if (weightNet <= 0) continue;

            const dInIso = parseToIsoDate(r.ngay1 || r.ngay2);
            const dOutIso = parseToIsoDate(r.ngay2 || r.ngay1);
            const dateInStr = formatIsoToDmy(dInIso) || r.ngay1;
            const dateOutStr = formatIsoToDmy(dOutIso) || r.ngay2;
            const timeInStr = parseToTimeStr(r.gio1);
            const timeOutStr = parseToTimeStr(r.gio2);

            const existsIdx = existingAllocatorTickets.findIndex(x =>
                (ticketNo && x.ticketNo === ticketNo) ||
                (!ticketNo && x.plateNumber === plateNumber && x.weightNet === weightNet && x.dateOutStr === dateOutStr)
            );

            const recordPayload = {
                id: existsIdx !== -1 ? existingAllocatorTickets[existsIdx].id : `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                ticketNo,
                sourceTicketNo: ticketNo,
                plateNumber,
                customer: String(r.khachHang || '').trim(),
                weight1,
                weight2,
                weightNet,
                dateInStr,
                timeInStr,
                dateOutStr,
                timeOutStr,
                date1Obj: dInIso ? `${dInIso}T${timeInStr || '00:00:00'}` : null,
                date2Obj: dOutIso ? `${dOutIso}T${timeOutStr || '00:00:00'}` : null,
                direction: String(r.xuatNhap || 'Xuat').trim(),
                cargoType: String(r.loaiHang || '').trim(),
                bargeName: String(r.loaiSalan || '').trim(),
                driverName: String(r.taiXe || '').trim(),
                notes: String(r.ghiChu || '').trim(),
                orderNo: String(r.maLenh || '').trim()
            };

            if (existsIdx === -1) {
                existingAllocatorTickets.push(recordPayload);
                syncedCount++;
            } else {
                existingAllocatorTickets[existsIdx] = recordPayload;
            }
        }

        await dbContext.set('allocator_tickets', existingAllocatorTickets);

        // Save to Supabase content.settings.allocator_tickets
        try {
            const { data: current } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
            if (current) {
                const updatedSettings = {
                    ...(current.settings || {}),
                    allocator_tickets: existingAllocatorTickets
                };
                await supabase
                    .from('content')
                    .update({ settings: updatedSettings })
                    .eq('id', 'main');
            }
        } catch (err) {
            console.warn('Sync allocator_tickets to Supabase warning:', err);
        }

        // Broadcast to open CargoAllocator / WeighbridgePrinter tabs
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const ch = new BroadcastChannel('allocator_sync_channel');
                ch.postMessage({ type: 'tickets' });
                ch.close();
            }
        } catch (_) {}

        // 2. Auto-push to matching unlocked Barges in WeighbridgeService
        let matchedBargesCount = 0;
        try {
            const vessels = await WeighbridgeService.getVessels();
            for (const vessel of vessels) {
                if (!vessel.barges) continue;
                for (const barge of vessel.barges) {
                    if (barge.config?.locked) continue;
                    const bargeOrderNo = String(barge.config?.orderNo || '').trim().toLowerCase();
                    if (!bargeOrderNo) continue;

                    const matchedForBarge = existingAllocatorTickets.filter(t => {
                        const tOrder = String(t.orderNo || '').trim().toLowerCase();
                        return tOrder === bargeOrderNo;
                    });
                    if (matchedForBarge.length === 0) continue;

                    const currentTrucks = await WeighbridgeService.getTrucks(barge.id);
                    const newTrucks = matchedForBarge
                        .filter(t => {
                            if (t.ticketNo) {
                                return !currentTrucks.some(ct => ct.ticketNo === t.ticketNo || ct.sourceTicketNo === t.ticketNo);
                            }
                            return !currentTrucks.some(ct => ct.plateNumber === t.plateNumber && ct.weightNet === t.weightNet);
                        })
                        .map((t, i) => ({
                            id: Date.now() + i,
                            barge_id: barge.id,
                            ticketNo: t.ticketNo || '',
                            sourceTicketNo: t.ticketNo || '',
                            plateNumber: t.plateNumber || '',
                            driver: t.driverName || '',
                            weight1: Number(t.weight1) || 0,
                            weight2: Number(t.weight2) || 0,
                            weightNet: Number(t.weightNet) || 0,
                            dateIn: t.date1Obj ? String(t.date1Obj).slice(0, 16) : '',
                            dateOut: t.date2Obj ? String(t.date2Obj).slice(0, 16) : '',
                            note: t.notes || ''
                        }));

                    if (newTrucks.length > 0) {
                        await WeighbridgeService.saveTrucks(barge.id, [...currentTrucks, ...newTrucks]);
                        matchedBargesCount++;
                    }
                }
            }
        } catch (err) {
            console.warn('Auto-sync to barges warning:', err);
        }

        return { syncedTicketsCount: syncedCount, matchedBargesCount };
    },

    /**
     * Import 1 or multiple Weighbridge CSV/Excel files (e.g. Import file + Export file from scale)
     */
    async importWeighbridgeCsvFiles(files: File[] | FileList): Promise<WarehouseImportSummary> {
        const summary: WarehouseImportSummary = {
            importedCount: 0,
            importFlowCount: 0,
            exportFlowCount: 0,
            directFlowCount: 0,
            ignoredCount: 0,
            syncedToAllocatorCount: 0,
            matchedBargesCount: 0,
            vehiclesLearnedCount: 0,
            warehousesUpdated: [],
            errors: []
        };

        const vehicleMap = await this.getVehicles();
        const configs = await this.getConfigs();
        let vessels: Vessel[] = [];
        try {
            vessels = await WeighbridgeService.getVessels();
        } catch (_) {}

        const allRawRows: RawWeighbridgeRow[] = [];
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            try {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                if (ext === 'csv') {
                    const text = await readCsvFileDecoded(file);
                    const rows = parseWeighbridgeCsvText(text);
                    allRawRows.push(...rows);
                } else if (ext === 'xlsx' || ext === 'xls') {
                    const ExcelJS = await import('exceljs');
                    const wb = new ExcelJS.Workbook();
                    await wb.xlsx.load(await file.arrayBuffer());
                    const sheet = wb.worksheets[0];
                    if (sheet) {
                        const csvLines: string[] = [];
                        sheet.eachRow((row) => {
                            const vals: string[] = [];
                            for (let c = 1; c <= Math.min(20, row.cellCount); c++) {
                                const cell = row.getCell(c);
                                let v: any = cell.value;
                                if (v && typeof v === 'object' && 'result' in v) v = v.result;
                                if (v instanceof Date) {
                                    v = `${String(v.getDate()).padStart(2, '0')}/${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
                                }
                                vals.push(`"${String(v ?? '').replace(/"/g, '""')}"`);
                            }
                            csvLines.push(vals.join(','));
                        });
                        allRawRows.push(...parseWeighbridgeCsvText(csvLines.join('\n')));
                    }
                }
            } catch (err: any) {
                summary.errors.push(`Lỗi đọc file ${file.name}: ${err?.message || err}`);
            }
        }

        const classifiedTickets: WarehouseInventoryTicket[] = [];
        const updatedWhSet = new Set<WarehouseId>();

        for (const raw of allRawRows) {
            const ticket = classifyWeighbridgeRow(raw, vehicleMap, vessels);
            if (!ticket) {
                summary.ignoredCount++;
                continue;
            }
            classifiedTickets.push(ticket);
            if (ticket.flowType === 'IMPORT') summary.importFlowCount++;
            else if (ticket.flowType === 'EXPORT') summary.exportFlowCount++;
            else if (ticket.flowType === 'DIRECT') summary.directFlowCount++;

            if (ticket.warehouseId) {
                updatedWhSet.add(ticket.warehouseId);
                if (ticket.customerName && configs[ticket.warehouseId]) {
                    configs[ticket.warehouseId].currentCustomer = ticket.customerName;
                }
            }
        }

        if (classifiedTickets.length > 0) {
            await this.saveTicketsBulk(classifiedTickets);
            summary.importedCount = classifiedTickets.length;
        }

        for (const whId of updatedWhSet) {
            await this.saveConfig(configs[whId]);
        }
        summary.warehousesUpdated = Array.from(updatedWhSet);

        // Single-point sync of all Xuat rows to CargoAllocator & WeighbridgePrinter barges
        const syncRes = await this.syncExportRowsToAllocator(allRawRows);
        summary.syncedToAllocatorCount = syncRes.syncedTicketsCount;
        summary.matchedBargesCount = syncRes.matchedBargesCount;

        return summary;
    },

    /**
     * Bootstrap / Import full history from an existing Multi-sheet Warehouse Inventory Excel file
     * Supports both:
     * 1. Single-Warehouse Workbook (e.g. WL GỖ NÉN_KHO 4 NGUYÊN NGỌC_21102026_EW.xlsx)
     * 2. Multi-Warehouse Workbook (e.g. WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD_21102026.xlsx with Kho 1, 2, 3)
     */
    async importHistoricalExcelWorkbook(
        file: File,
        defaultWarehouseOverride?: WarehouseId
    ): Promise<WarehouseImportSummary> {
        const summary: WarehouseImportSummary = {
            importedCount: 0,
            importFlowCount: 0,
            exportFlowCount: 0,
            directFlowCount: 0,
            ignoredCount: 0,
            syncedToAllocatorCount: 0,
            matchedBargesCount: 0,
            vehiclesLearnedCount: 0,
            warehousesUpdated: [],
            errors: []
        };

        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());

            const getCellPrimitive = (cell: any): any => {
                if (!cell) return '';
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if ('result' in val) val = val.result;
                    else if ('richText' in val && Array.isArray(val.richText)) {
                        val = val.richText.map((rt: any) => rt.text || '').join('');
                    } else if ('text' in val) {
                        val = val.text;
                    }
                }
                return val ?? '';
            };

            const defaultWh = normalizeWarehouseId(file.name) || defaultWarehouseOverride || 'KHO 4';
            const updatedWhSet = new Set<WarehouseId>();
            const configs = await this.getConfigs();

            // Detect default customer from filename
            const fileNameClean = stripAccents(file.name).toUpperCase();
            const inferredFileCustomer = fileNameClean.includes('EW') || fileNameClean.includes('EASTWOOD')
                ? 'EASTWOOD'
                : fileNameClean.includes('GBD') || fileNameClean.includes('BINH DINH')
                    ? 'GỖ BÌNH ĐỊNH'
                    : '';

            // 1. Parse `Data` sheet (Vehicle -> Carrier lookup)
            const dataSheet = workbook.worksheets.find(ws => stripAccents(ws.name).toUpperCase().trim() === 'DATA');
            const learnedVehicles: WarehouseVehicleMap[] = [];
            if (dataSheet) {
                dataSheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const plate = String(getCellPrimitive(row.getCell(1)) || '').trim();
                    const carrier = String(getCellPrimitive(row.getCell(2)) || '').trim();
                    if (plate && carrier && !stripAccents(plate).toUpperCase().includes('SO XE')) {
                        learnedVehicles.push({
                            vehiclePlate: normalizePlateKey(plate),
                            displayPlate: plate,
                            carrierName: carrier
                        });
                    }
                });
            }
            if (learnedVehicles.length > 0) {
                summary.vehiclesLearnedCount = await this.saveVehiclesBulk(learnedVehicles);
            }

            const vehicleMap = await this.getVehicles();
            const allTickets: WarehouseInventoryTicket[] = [];

            // 2. Parse IMPORT, EXPORT, and ĐI THẲNG / XÁ THẲNG sheets
            for (const sheet of workbook.worksheets) {
                const sNameClean = stripAccents(sheet.name).toUpperCase().trim();
                if (sNameClean === 'DATA' || sNameClean.startsWith('FINAL') || sNameClean.includes('BUI CANG')) {
                    continue;
                }

                const isImportSheet = sNameClean.includes('IMPORT') || sNameClean.startsWith('NHAP');
                const isExportSheet = sNameClean.includes('EXPORT') || sNameClean.startsWith('XUAT');
                const isDirectSheet = sNameClean.includes('DI THANG') || sNameClean.includes('XA THANG');

                if (!isImportSheet && !isExportSheet && !isDirectSheet) continue;

                const sheetWh: WarehouseId | null = isDirectSheet
                    ? null
                    : (normalizeWarehouseId(sheet.name) || defaultWh);

                if (sheetWh) updatedWhSet.add(sheetWh);

                // Find header row (usually row 4 or 5 containing STT, NGÀY, SỐ PHIẾU, SỐ XE)
                let headerRowNum = 5;
                for (let r = 1; r <= Math.min(12, sheet.rowCount); r++) {
                    const row = sheet.getRow(r);
                    let rowText = '';
                    for (let c = 1; c <= Math.min(15, row.cellCount); c++) {
                        rowText += ' ' + stripAccents(String(getCellPrimitive(row.getCell(c)))).toUpperCase();
                    }
                    if (rowText.includes('SO PHIEU') && (rowText.includes('SO XE') || rowText.includes('TL HANG'))) {
                        headerRowNum = r;
                        break;
                    }
                }

                // Map column indexes from headerRowNum
                const headerRow = sheet.getRow(headerRowNum);
                const colHeaders: string[] = [];
                for (let c = 1; c <= Math.min(18, headerRow.cellCount); c++) {
                    colHeaders[c] = stripAccents(String(getCellPrimitive(headerRow.getCell(c)))).toUpperCase().trim();
                }

                const findColIdx = (matcher: (h: string) => boolean, fallback: number): number => {
                    for (let c = 1; c < colHeaders.length; c++) {
                        if (colHeaders[c] && matcher(colHeaders[c]!)) return c;
                    }
                    return fallback;
                };

                const colDate = findColIdx(h => h.includes('NGAY'), 2);
                const colTicketNo = findColIdx(h => h.includes('PHIEU') && !h.includes('KL'), 3);
                const colPlate = findColIdx(h => h.includes('SO XE') || h.includes('BIEN SO'), 4);
                const colCarrier = findColIdx(h => h.includes('NHA XE') || h.includes('DON VI'), 5);
                const colWeight = findColIdx(h => h.includes('TL HANG') || h.includes('KL HANG') || h.includes('TRONG LUONG'), 6);

                for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
                    const row = sheet.getRow(r);
                    const rawDateVal = getCellPrimitive(row.getCell(colDate));
                    const rawPlateVal = String(getCellPrimitive(row.getCell(colPlate)) || '').trim();
                    const rawWeightVal = getCellPrimitive(row.getCell(colWeight));

                    const reportDate = parseToIsoDate(rawDateVal);
                    const netWeight = normalizeWeightToTons(rawWeightVal);
                    if (!reportDate || !rawPlateVal || netWeight <= 0) continue;

                    const soPhieu = String(getCellPrimitive(row.getCell(colTicketNo)) || '').trim();
                    let carrierName = String(getCellPrimitive(row.getCell(colCarrier)) || '').trim();
                    if (!carrierName || carrierName === '0') {
                        carrierName = lookupCarrierName(rawPlateVal, vehicleMap);
                    }

                    if (isImportSheet && sheetWh) {
                        const colTime = findColIdx(h => h.includes('GIO'), 7);
                        const colRemark = findColIdx(h => h.includes('GHI CHU') || h.includes('NGUON'), 8);
                        const colFactoryWeight = findColIdx(h => h.includes('KL PHIEU') || h.includes('PHIEU CAN'), 9);

                        const weighOutTime = parseToTimeStr(getCellPrimitive(row.getCell(colTime)));
                        const sourceOrRemark = String(getCellPrimitive(row.getCell(colRemark)) || '').trim();
                        const fwRaw = getCellPrimitive(row.getCell(colFactoryWeight));
                        const factoryWeight = fwRaw !== '' && fwRaw !== null && Number(fwRaw) > 0
                            ? normalizeWeightToTons(fwRaw)
                            : null;

                        // Note: In historical Excel sheets, the NGÀY column is ALREADY the 6:00 AM shift-adjusted reportDate!
                        const id = `IMPORT_${sheetWh}_${soPhieu || normalizePlateKey(rawPlateVal)}_${reportDate}_${r}`;
                        allTickets.push({
                            id,
                            soPhieu,
                            maLenh: '',
                            reportDate,
                            weighInDate: reportDate,
                            weighInTime: weighOutTime,
                            weighOutDate: reportDate,
                            weighOutTime,
                            flowType: 'IMPORT',
                            warehouseId: sheetWh,
                            customerName: inferredFileCustomer || configs[sheetWh]?.currentCustomer || '',
                            cargoType: 'Viên nén gỗ',
                            vehiclePlate: rawPlateVal,
                            carrierName,
                            grossWeight: 0,
                            tareWeight: 0,
                            netWeight,
                            factoryWeight,
                            bargeInfo: '',
                            vesselName: '',
                            sourceOrRemark,
                            rawNote: ''
                        });
                        summary.importFlowCount++;
                    } else if (isExportSheet && sheetWh) {
                        const colBarge = findColIdx(h => h.includes('SA LAN') || h.includes('SALAN'), 7);
                        const colVessel = findColIdx(h => h === 'TAU' || h.includes('TEN TAU'), 8);
                        const colTime = findColIdx(h => h.includes('GIO'), 9);
                        const colCust = findColIdx(h => h.includes('KHACH'), 10);

                        const bargeInfo = String(getCellPrimitive(row.getCell(colBarge)) || '').trim();
                        const vesselName = String(getCellPrimitive(row.getCell(colVessel)) || '').trim();
                        const weighOutTime = parseToTimeStr(getCellPrimitive(row.getCell(colTime)));
                        const custVal = colCust > 0 ? String(getCellPrimitive(row.getCell(colCust)) || '').trim() : '';
                        const customerName = custVal || inferredFileCustomer || configs[sheetWh]?.currentCustomer || '';

                        if (customerName && configs[sheetWh]) {
                            configs[sheetWh].currentCustomer = customerName;
                        }

                        const id = `EXPORT_${sheetWh}_${soPhieu || normalizePlateKey(rawPlateVal)}_${reportDate}_${r}`;
                        allTickets.push({
                            id,
                            soPhieu,
                            maLenh: '',
                            reportDate,
                            weighInDate: reportDate,
                            weighInTime: weighOutTime,
                            weighOutDate: reportDate,
                            weighOutTime,
                            flowType: 'EXPORT',
                            warehouseId: sheetWh,
                            customerName,
                            cargoType: 'Viên nén gỗ',
                            vehiclePlate: rawPlateVal,
                            carrierName,
                            grossWeight: 0,
                            tareWeight: 0,
                            netWeight,
                            factoryWeight: null,
                            bargeInfo,
                            vesselName,
                            sourceOrRemark: sheetWh,
                            rawNote: ''
                        });
                        summary.exportFlowCount++;
                    } else if (isDirectSheet) {
                        const colBarge = findColIdx(h => h.includes('SA LAN') || h.includes('SALAN'), 7);
                        const colVessel = findColIdx(h => h === 'TAU' || h.includes('TEN TAU'), 8);
                        const colTime = findColIdx(h => h.includes('GIO'), 9);
                        const colRemark = findColIdx(h => h.includes('GHI CHU') || h.includes('NGUON'), 10);

                        const bargeInfo = String(getCellPrimitive(row.getCell(colBarge)) || '').trim();
                        const vesselName = String(getCellPrimitive(row.getCell(colVessel)) || '').trim();
                        const weighOutTime = parseToTimeStr(getCellPrimitive(row.getCell(colTime)));
                        const sourceOrRemark = String(getCellPrimitive(row.getCell(colRemark)) || '').trim();

                        const id = `DIRECT_${soPhieu || normalizePlateKey(rawPlateVal)}_${reportDate}_${r}`;
                        allTickets.push({
                            id,
                            soPhieu,
                            maLenh: '',
                            reportDate,
                            weighInDate: reportDate,
                            weighInTime: weighOutTime,
                            weighOutDate: reportDate,
                            weighOutTime,
                            flowType: 'DIRECT',
                            warehouseId: null,
                            customerName: inferredFileCustomer || '',
                            cargoType: 'Viên nén gỗ',
                            vehiclePlate: rawPlateVal,
                            carrierName,
                            grossWeight: 0,
                            tareWeight: 0,
                            netWeight,
                            factoryWeight: null,
                            bargeInfo,
                            vesselName,
                            sourceOrRemark,
                            rawNote: ''
                        });
                        summary.directFlowCount++;
                    }
                }
            }

            // 3. Parse FINAL / FINAL 4 sheet for dailyRemarks & initialStock
            const finalSheet = workbook.worksheets.find(ws =>
                stripAccents(ws.name).toUpperCase().trim().startsWith('FINAL')
            );
            if (finalSheet) {
                // Check if this is GBD 3-Warehouse horizontal layout (KHO 1 at col A..E, KHO 2 at col G..K, KHO 3 at col M..Q)
                let isThreeWhHorizontal = false;
                for (let r = 1; r <= Math.min(8, finalSheet.rowCount); r++) {
                    const row = finalSheet.getRow(r);
                    const c7 = stripAccents(String(getCellPrimitive(row.getCell(7)))).toUpperCase();
                    const c13 = stripAccents(String(getCellPrimitive(row.getCell(13)))).toUpperCase();
                    if (c7.includes('KHO 2') || c13.includes('KHO 3') || c7.includes('NGAY')) {
                        isThreeWhHorizontal = true;
                        break;
                    }
                }

                if (isThreeWhHorizontal) {
                    const blocks: Array<{ wh: WarehouseId; dateCol: number; remarkCol: number }> = [
                        { wh: 'KHO 1', dateCol: 1, remarkCol: 5 },
                        { wh: 'KHO 2', dateCol: 7, remarkCol: 11 },
                        { wh: 'KHO 3', dateCol: 13, remarkCol: 17 }
                    ];
                    for (const b of blocks) {
                        updatedWhSet.add(b.wh);
                        if (inferredFileCustomer) configs[b.wh].currentCustomer = inferredFileCustomer;
                        for (let r = 5; r <= finalSheet.rowCount; r++) {
                            const row = finalSheet.getRow(r);
                            const dIso = parseToIsoDate(getCellPrimitive(row.getCell(b.dateCol)));
                            const rem = String(getCellPrimitive(row.getCell(b.remarkCol)) || '').trim();
                            if (dIso && rem) {
                                configs[b.wh].dailyRemarks[dIso] = rem;
                            }
                        }
                    }
                } else {
                    const fWh = normalizeWarehouseId(finalSheet.name) || defaultWh;
                    updatedWhSet.add(fWh);
                    if (inferredFileCustomer) configs[fWh].currentCustomer = inferredFileCustomer;

                    // Single-Warehouse FINAL (e.g. FINAL 4: Col B=Ngày, Col F=Tồn kho, Col G=Ghi chú)
                    for (let r = 6; r <= finalSheet.rowCount; r++) {
                        const row = finalSheet.getRow(r);
                        const dIso = parseToIsoDate(getCellPrimitive(row.getCell(2)) || getCellPrimitive(row.getCell(1)));
                        const rem = String(getCellPrimitive(row.getCell(7)) || getCellPrimitive(row.getCell(6)) || '').trim();
                        if (dIso && rem && !/^\d+(\.\d+)?$/.test(rem)) {
                            configs[fWh].dailyRemarks[dIso] = rem;
                        }
                    }
                }
            }

            if (allTickets.length > 0) {
                await this.saveTicketsBulk(allTickets);
                summary.importedCount = allTickets.length;
            }

            for (const whId of updatedWhSet) {
                await this.saveConfig(configs[whId]);
            }
            summary.warehousesUpdated = Array.from(updatedWhSet);
        } catch (err: any) {
            console.error('Error importing historical Excel workbook:', err);
            summary.errors.push(err?.message || String(err));
        }

        return summary;
    },

    /**
     * Build Single-Warehouse Morning Excel Report (.xlsx)
     * Sheets: IMPORT {num}, EXPORT {num}, FINAL {num}, ĐI THẲNG, Data
     */
    async exportSingleWarehouseWorkbook(
        warehouseId: WarehouseId,
        options?: {
            fromDate?: string;
            toDate?: string;
        }
    ): Promise<{ buffer: ArrayBuffer; filename: string }> {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();

        const whNum = warehouseId.replace('KHO ', '').trim();
        const importSheetName = `IMPORT ${whNum}`;
        const exportSheetName = `EXPORT ${whNum}`;
        const finalSheetName = `FINAL ${whNum}`;
        const directSheetName = 'ĐI THẲNG';

        const allTickets = await this.getAllTickets();
        const configs = await this.getConfigs();
        const vehicleMap = await this.getVehicles();
        const config = configs[warehouseId];

        const whImports = allTickets.filter(t => t.warehouseId === warehouseId && t.flowType === 'IMPORT');
        const whExports = allTickets.filter(t => t.warehouseId === warehouseId && t.flowType === 'EXPORT');
        const directTickets = allTickets.filter(t => t.flowType === 'DIRECT');

        const finalCalc = computeWarehouseFinalTable(warehouseId, allTickets, config, options);

        // 1. Sheet IMPORT X
        const wsImport = workbook.addWorksheet(importSheetName);
        this.populateImportWorksheet(wsImport, warehouseId, config.currentCustomer, whImports);

        // 2. Sheet EXPORT X
        const wsExport = workbook.addWorksheet(exportSheetName);
        this.populateExportWorksheet(wsExport, warehouseId, config.currentCustomer, whExports);

        // 3. Sheet FINAL X
        const wsFinal = workbook.addWorksheet(finalSheetName);
        this.populateSingleFinalWorksheet(
            wsFinal,
            warehouseId,
            config.currentCustomer,
            importSheetName,
            exportSheetName,
            directSheetName,
            finalCalc.openingStockBeforeFilter,
            finalCalc.rows
        );

        // 4. Sheet ĐI THẲNG
        const wsDirect = workbook.addWorksheet(directSheetName);
        this.populateDirectWorksheet(wsDirect, directTickets);

        // 5. Sheet Data
        const wsData = workbook.addWorksheet('Data');
        this.populateDataWorksheet(wsData, Object.values(vehicleMap));

        const now = new Date();
        const ddmmyyyy = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        const custShort = (config.currentCustomer || 'KH').replace(/\s+/g, '_').toUpperCase();
        const filename = `WL GỖ NÉN_${warehouseId} NGUYÊN NGỌC_${ddmmyyyy}_${custShort}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        return { buffer: buffer as ArrayBuffer, filename };
    },

    /**
     * Build Combined 3-Warehouse (KHO 1, KHO 2, KHO 3) Morning Excel Report (.xlsx)
     * Matches WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD_DDMMYYYY.xlsx layout
     */
    async exportCombined123WarehouseWorkbook(options?: {
        fromDate?: string;
        toDate?: string;
    }): Promise<{ buffer: ArrayBuffer; filename: string }> {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();

        const allTickets = await this.getAllTickets();
        const configs = await this.getConfigs();
        const vehicleMap = await this.getVehicles();

        const calc1 = computeWarehouseFinalTable('KHO 1', allTickets, configs['KHO 1'], options);
        const calc2 = computeWarehouseFinalTable('KHO 2', allTickets, configs['KHO 2'], options);
        const calc3 = computeWarehouseFinalTable('KHO 3', allTickets, configs['KHO 3'], options);

        // 1. Sheet FINAL (3 horizontal tables side-by-side: A..E, G..K, M..Q)
        const wsFinal = workbook.addWorksheet('FINAL');
        this.populateCombined123FinalWorksheet(wsFinal, [
            {
                whId: 'KHO 1',
                customer: configs['KHO 1'].currentCustomer,
                importSheet: 'IMPORT 1',
                exportSheet: 'EXPORT 1',
                startCol: 1,
                openingStock: calc1.openingStockBeforeFilter,
                rows: calc1.rows
            },
            {
                whId: 'KHO 2',
                customer: configs['KHO 2'].currentCustomer,
                importSheet: 'IMPORT 2',
                exportSheet: 'EXPORT 2',
                startCol: 7,
                openingStock: calc2.openingStockBeforeFilter,
                rows: calc2.rows
            },
            {
                whId: 'KHO 3',
                customer: configs['KHO 3'].currentCustomer,
                importSheet: 'IMPORT KHO 3',
                exportSheet: 'EXPORT KH 3',
                startCol: 13,
                openingStock: calc3.openingStockBeforeFilter,
                rows: calc3.rows
            }
        ]);

        // 2. Sheets IMPORT 1, EXPORT 1, IMPORT 2, EXPORT 2, IMPORT KHO 3, EXPORT KH 3
        const whDefs: Array<{ wh: WarehouseId; impName: string; expName: string }> = [
            { wh: 'KHO 1', impName: 'IMPORT 1', expName: 'EXPORT 1' },
            { wh: 'KHO 2', impName: 'IMPORT 2', expName: 'EXPORT 2' },
            { wh: 'KHO 3', impName: 'IMPORT KHO 3', expName: 'EXPORT KH 3' }
        ];

        for (const def of whDefs) {
            const wsImp = workbook.addWorksheet(def.impName);
            this.populateImportWorksheet(
                wsImp,
                def.wh,
                configs[def.wh].currentCustomer,
                allTickets.filter(t => t.warehouseId === def.wh && t.flowType === 'IMPORT')
            );

            const wsExp = workbook.addWorksheet(def.expName);
            this.populateExportWorksheet(
                wsExp,
                def.wh,
                configs[def.wh].currentCustomer,
                allTickets.filter(t => t.warehouseId === def.wh && t.flowType === 'EXPORT')
            );
        }

        // 3. Sheet XÁ THẲNG
        const wsDirect = workbook.addWorksheet('XÁ THẲNG');
        this.populateDirectWorksheet(wsDirect, allTickets.filter(t => t.flowType === 'DIRECT'));

        // 4. Sheet Data
        const wsData = workbook.addWorksheet('Data');
        this.populateDataWorksheet(wsData, Object.values(vehicleMap));

        const now = new Date();
        const ddmmyyyy = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        const filename = `WEIGHT LIST GỖ NÉN_KHO NGUYÊN NGỌC_GBD_${ddmmyyyy}.xlsx`;

        const buffer = await workbook.xlsx.writeBuffer();
        return { buffer: buffer as ArrayBuffer, filename };
    },

    populateImportWorksheet(
        sheet: any,
        warehouseId: WarehouseId,
        customerName: string,
        tickets: WarehouseInventoryTicket[]
    ) {
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
        };

        sheet.getCell('A2').value = `THEO DÕI NHẬP KHO HÀNG VIÊN NÉN GỖ - ${warehouseId} (${customerName || ''})`;
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 13, bold: true };

        const lastRow = Math.max(6, tickets.length + 5);
        const totalTons = round2(tickets.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        sheet.getCell('D4').value = { formula: `SUBTOTAL(3,D6:D${lastRow})`, result: tickets.length };
        sheet.getCell('F4').value = { formula: `SUBTOTAL(9,F6:F${lastRow})`, result: totalTons };
        sheet.getCell('D4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('F4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('F4').numFmt = '#,##0.00';

        const headers = ['STT', 'NGÀY', 'SỐ PHIẾU', 'SỐ XE', 'NHÀ XE', 'TL HÀNG', 'GIỜ CÂN', 'GHI CHÚ', 'KL PHIẾU', 'CHÊNH LỆCH'];
        const hRow = sheet.getRow(5);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = thinBorder;
        });
        hRow.height = 22;

        tickets.forEach((t, idx) => {
            const rNum = idx + 6;
            const row = sheet.getRow(rNum);
            const dtParts = (t.reportDate || '').split('-').map(Number);
            const excelDate = dtParts.length === 3
                ? new Date(Date.UTC(dtParts[0]!, (dtParts[1] || 1) - 1, dtParts[2] || 1))
                : t.reportDate;

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = excelDate;
            row.getCell(2).numFmt = 'dd/mm/yyyy';
            row.getCell(3).value = t.soPhieu;
            row.getCell(4).value = t.vehiclePlate;
            row.getCell(5).value = {
                formula: `IFERROR(VLOOKUP(D${rNum},Data!$A$2:$B$500,2,0),"")`,
                result: t.carrierName || ''
            };
            row.getCell(6).value = round2(t.netWeight);
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).value = t.weighOutTime || '';
            row.getCell(8).value = t.sourceOrRemark || '';
            if (t.factoryWeight != null && t.factoryWeight > 0) {
                row.getCell(9).value = round2(t.factoryWeight);
                row.getCell(9).numFmt = '#,##0.00';
                row.getCell(10).value = {
                    formula: `F${rNum}-I${rNum}`,
                    result: round2(t.netWeight - t.factoryWeight)
                };
                row.getCell(10).numFmt = '#,##0.00';
            }

            for (let c = 1; c <= 10; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        sheet.columns = [
            { width: 7 }, { width: 13 }, { width: 13 }, { width: 18 }, { width: 16 },
            { width: 13 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 13 }
        ];
    },

    populateExportWorksheet(
        sheet: any,
        warehouseId: WarehouseId,
        customerName: string,
        tickets: WarehouseInventoryTicket[]
    ) {
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
        };

        sheet.getCell('A2').value = `THEO DÕI XUẤT KHO HÀNG VIÊN NÉN GỖ - ${warehouseId} (${customerName || ''})`;
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 13, bold: true };

        const lastRow = Math.max(6, tickets.length + 5);
        const totalTons = round2(tickets.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        sheet.getCell('D4').value = { formula: `SUBTOTAL(3,D6:D${lastRow})`, result: tickets.length };
        sheet.getCell('F4').value = { formula: `SUBTOTAL(9,F6:F${lastRow})`, result: totalTons };
        sheet.getCell('D4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('F4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('F4').numFmt = '#,##0.00';

        const headers = ['STT', 'NGÀY', 'SỐ PHIẾU', 'SỐ XE', 'NHÀ XE', 'TL HÀNG', 'SÀ LAN', 'TÀU', 'GIỜ CÂN', 'KHÁCH HÀNG'];
        const hRow = sheet.getRow(5);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
            cell.border = thinBorder;
        });
        hRow.height = 22;

        tickets.forEach((t, idx) => {
            const rNum = idx + 6;
            const row = sheet.getRow(rNum);
            const dtParts = (t.reportDate || '').split('-').map(Number);
            const excelDate = dtParts.length === 3
                ? new Date(Date.UTC(dtParts[0]!, (dtParts[1] || 1) - 1, dtParts[2] || 1))
                : t.reportDate;

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = excelDate;
            row.getCell(2).numFmt = 'dd/mm/yyyy';
            row.getCell(3).value = t.soPhieu;
            row.getCell(4).value = t.vehiclePlate;
            row.getCell(5).value = {
                formula: `IFERROR(VLOOKUP(D${rNum},Data!$A$2:$B$500,2,0),"")`,
                result: t.carrierName || ''
            };
            row.getCell(6).value = round2(t.netWeight);
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).value = t.bargeInfo || '';
            row.getCell(8).value = t.vesselName || '';
            row.getCell(9).value = t.weighOutTime || '';
            row.getCell(10).value = t.customerName || customerName || '';

            for (let c = 1; c <= 10; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        sheet.columns = [
            { width: 7 }, { width: 13 }, { width: 13 }, { width: 18 }, { width: 16 },
            { width: 13 }, { width: 24 }, { width: 22 }, { width: 12 }, { width: 18 }
        ];
    },

    populateDirectWorksheet(sheet: any, tickets: WarehouseInventoryTicket[]) {
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
        };

        sheet.getCell('A2').value = 'THEO DÕI HÀNG ĐI THẲNG (XÁ THẲNG) VIÊN NÉN GỖ';
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 13, bold: true };

        const lastRow = Math.max(6, tickets.length + 5);
        const totalTons = round2(tickets.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        sheet.getCell('D4').value = { formula: `SUBTOTAL(3,D6:D${lastRow})`, result: tickets.length };
        sheet.getCell('F4').value = { formula: `SUBTOTAL(9,F6:F${lastRow})`, result: totalTons };
        sheet.getCell('D4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('F4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('F4').numFmt = '#,##0.00';

        const headers = ['STT', 'NGÀY', 'SỐ PHIẾU', 'SỐ XE', 'NHÀ XE', 'TL HÀNG', 'SÀ LAN', 'TÀU', 'GIỜ CÂN', 'GHI CHÚ', 'KHÁCH HÀNG'];
        const hRow = sheet.getRow(5);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.border = thinBorder;
        });
        hRow.height = 22;

        tickets.forEach((t, idx) => {
            const rNum = idx + 6;
            const row = sheet.getRow(rNum);
            const dtParts = (t.reportDate || '').split('-').map(Number);
            const excelDate = dtParts.length === 3
                ? new Date(Date.UTC(dtParts[0]!, (dtParts[1] || 1) - 1, dtParts[2] || 1))
                : t.reportDate;

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = excelDate;
            row.getCell(2).numFmt = 'dd/mm/yyyy';
            row.getCell(3).value = t.soPhieu;
            row.getCell(4).value = t.vehiclePlate;
            row.getCell(5).value = {
                formula: `IFERROR(VLOOKUP(D${rNum},Data!$A$2:$B$500,2,0),"")`,
                result: t.carrierName || ''
            };
            row.getCell(6).value = round2(t.netWeight);
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).value = t.bargeInfo || '';
            row.getCell(8).value = t.vesselName || '';
            row.getCell(9).value = t.weighOutTime || '';
            row.getCell(10).value = t.sourceOrRemark || '';
            row.getCell(11).value = t.customerName || '';

            for (let c = 1; c <= 11; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        sheet.columns = [
            { width: 7 }, { width: 13 }, { width: 13 }, { width: 18 }, { width: 16 },
            { width: 13 }, { width: 24 }, { width: 22 }, { width: 12 }, { width: 18 }, { width: 18 }
        ];
    },

    populateSingleFinalWorksheet(
        sheet: any,
        warehouseId: WarehouseId,
        customerName: string,
        importSheetName: string,
        exportSheetName: string,
        directSheetName: string,
        openingStock: number,
        rows: WarehouseFinalRow[]
    ) {
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF808080' } },
            left: { style: 'thin', color: { argb: 'FF808080' } },
            bottom: { style: 'thin', color: { argb: 'FF808080' } },
            right: { style: 'thin', color: { argb: 'FF808080' } }
        };

        sheet.getCell('B3').value = `BÁO CÁO TỒN KHO HÀNG VIÊN NÉN GỖ - ${warehouseId} (${customerName || ''})`;
        sheet.getCell('B3').font = { name: 'Times New Roman', size: 14, bold: true };

        const headers = ['STT', 'Ngày', 'Nhập', 'Xuất', 'Xá thẳng', 'Tồn kho', 'Ghi chú'];
        const hRow = sheet.getRow(7);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = thinBorder;
        });
        hRow.height = 24;

        // Row 8: Tồn đầu row
        const initRow = sheet.getRow(8);
        initRow.getCell(2).value = 'Tồn đầu';
        initRow.getCell(6).value = round2(openingStock);
        initRow.getCell(6).numFmt = '#,##0.00';
        for (let c = 1; c <= 7; c++) {
            initRow.getCell(c).font = { name: 'Times New Roman', size: 11, bold: true };
            initRow.getCell(c).border = thinBorder;
        }

        rows.forEach((r, idx) => {
            const rNum = idx + 9;
            const row = sheet.getRow(rNum);
            const dtParts = (r.reportDate || '').split('-').map(Number);
            const excelDate = dtParts.length === 3
                ? new Date(Date.UTC(dtParts[0]!, (dtParts[1] || 1) - 1, dtParts[2] || 1))
                : r.reportDate;

            row.getCell(1).value = idx + 1;
            row.getCell(2).value = excelDate;
            row.getCell(2).numFmt = 'dd/mm/yyyy';
            row.getCell(3).value = {
                formula: `SUMIFS('${importSheetName}'!$F$6:$F$50000,'${importSheetName}'!$B$6:$B$50000,B${rNum})`,
                result: round2(r.importTons)
            };
            row.getCell(3).numFmt = '#,##0.00';

            row.getCell(4).value = {
                formula: `SUMIFS('${exportSheetName}'!$F$6:$F$50000,'${exportSheetName}'!$B$6:$B$50000,B${rNum})`,
                result: round2(r.exportTons)
            };
            row.getCell(4).numFmt = '#,##0.00';

            row.getCell(5).value = {
                formula: `SUMIF('${directSheetName}'!$B$6:$B$50000,B${rNum},'${directSheetName}'!$F$6:$F$50000)`,
                result: round2(r.directTons)
            };
            row.getCell(5).numFmt = '#,##0.00';

            row.getCell(6).value = {
                formula: `F${rNum - 1}+C${rNum}-D${rNum}`,
                result: round2(r.remainingStockTons)
            };
            row.getCell(6).numFmt = '#,##0.00';

            row.getCell(7).value = r.remark || '';

            for (let c = 1; c <= 7; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        const totalRowNum = rows.length + 9;
        const lastDataRow = Math.max(8, rows.length + 8);
        const totalRow = sheet.getRow(totalRowNum);
        const totalImp = round2(rows.reduce((s, x) => s + x.importTons, 0));
        const totalExp = round2(rows.reduce((s, x) => s + x.exportTons, 0));
        const totalDir = round2(rows.reduce((s, x) => s + x.directTons, 0));
        const closing = rows.length > 0 ? rows[rows.length - 1]!.remainingStockTons : openingStock;

        totalRow.getCell(2).value = 'TỔNG CỘNG';
        totalRow.getCell(3).value = { formula: `SUM(C9:C${lastDataRow})`, result: totalImp };
        totalRow.getCell(4).value = { formula: `SUM(D9:D${lastDataRow})`, result: totalExp };
        totalRow.getCell(5).value = { formula: `SUM(E9:E${lastDataRow})`, result: totalDir };
        totalRow.getCell(6).value = { formula: `F${lastDataRow}`, result: round2(closing) };

        for (let c = 1; c <= 7; c++) {
            const cell = totalRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.border = thinBorder;
            if (c >= 3 && c <= 6) cell.numFmt = '#,##0.00';
        }

        sheet.columns = [
            { width: 7 }, { width: 14 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 16 }, { width: 32 }
        ];
    },

    populateCombined123FinalWorksheet(
        sheet: any,
        blocks: Array<{
            whId: WarehouseId;
            customer: string;
            importSheet: string;
            exportSheet: string;
            startCol: number;
            openingStock: number;
            rows: WarehouseFinalRow[];
        }>
    ) {
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF808080' } },
            left: { style: 'thin', color: { argb: 'FF808080' } },
            bottom: { style: 'thin', color: { argb: 'FF808080' } },
            right: { style: 'thin', color: { argb: 'FF808080' } }
        };

        const colLetter = (colIdx: number): string => {
            let s = '';
            let n = colIdx;
            while (n > 0) {
                const m = (n - 1) % 26;
                s = String.fromCharCode(65 + m) + s;
                n = Math.floor((n - m) / 26);
            }
            return s;
        };

        for (const b of blocks) {
            const cDate = b.startCol;
            const cImp = b.startCol + 1;
            const cExp = b.startCol + 2;
            const cStock = b.startCol + 3;
            const cRem = b.startCol + 4;

            const lDate = colLetter(cDate);
            const lImp = colLetter(cImp);
            const lExp = colLetter(cExp);
            const lStock = colLetter(cStock);

            const titleCell = sheet.getRow(2).getCell(cDate);
            titleCell.value = `THEO DÕI NHẬP XUẤT HÀNG VIÊN NÉN GỖ - ${b.whId} (${b.customer || ''})`;
            titleCell.font = { name: 'Times New Roman', size: 12, bold: true };

            const headers = ['Ngày', 'Nhập', 'Xuất', 'Tồn kho', 'Ghi chú'];
            const hRow = sheet.getRow(4);
            headers.forEach((h, i) => {
                const cell = hRow.getCell(b.startCol + i);
                cell.value = h;
                cell.font = { name: 'Times New Roman', size: 11, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
                cell.border = thinBorder;
            });

            // Row 5: Tồn đầu
            const initRow = sheet.getRow(5);
            initRow.getCell(cDate).value = 'Tồn đầu';
            initRow.getCell(cStock).value = round2(b.openingStock);
            initRow.getCell(cStock).numFmt = '#,##0.00';
            for (let i = 0; i < 5; i++) {
                const cell = initRow.getCell(b.startCol + i);
                cell.font = { name: 'Times New Roman', size: 11, bold: true };
                cell.border = thinBorder;
            }

            b.rows.forEach((r, idx) => {
                const rNum = idx + 6;
                const row = sheet.getRow(rNum);
                const dtParts = (r.reportDate || '').split('-').map(Number);
                const excelDate = dtParts.length === 3
                    ? new Date(Date.UTC(dtParts[0]!, (dtParts[1] || 1) - 1, dtParts[2] || 1))
                    : r.reportDate;

                row.getCell(cDate).value = excelDate;
                row.getCell(cDate).numFmt = 'dd/mm/yyyy';

                row.getCell(cImp).value = {
                    formula: `SUMIF('${b.importSheet}'!$B$6:$B$50000,${lDate}${rNum},'${b.importSheet}'!$F$6:$F$50000)`,
                    result: round2(r.importTons)
                };
                row.getCell(cImp).numFmt = '#,##0.00';

                row.getCell(cExp).value = {
                    formula: `SUMIF('${b.exportSheet}'!$B$6:$B$50000,${lDate}${rNum},'${b.exportSheet}'!$F$6:$F$50000)`,
                    result: round2(r.exportTons)
                };
                row.getCell(cExp).numFmt = '#,##0.00';

                row.getCell(cStock).value = {
                    formula: `${lStock}${rNum - 1}+${lImp}${rNum}-${lExp}${rNum}`,
                    result: round2(r.remainingStockTons)
                };
                row.getCell(cStock).numFmt = '#,##0.00';

                row.getCell(cRem).value = r.remark || '';

                for (let i = 0; i < 5; i++) {
                    const cell = row.getCell(b.startCol + i);
                    cell.font = { name: 'Times New Roman', size: 11 };
                    cell.border = thinBorder;
                }
            });

            const totalRowNum = b.rows.length + 6;
            const lastDataRow = Math.max(5, b.rows.length + 5);
            const totalRow = sheet.getRow(totalRowNum);
            const totalImp = round2(b.rows.reduce((s, x) => s + x.importTons, 0));
            const totalExp = round2(b.rows.reduce((s, x) => s + x.exportTons, 0));
            const closing = b.rows.length > 0 ? b.rows[b.rows.length - 1]!.remainingStockTons : b.openingStock;

            totalRow.getCell(cDate).value = 'TỔNG CỘNG';
            totalRow.getCell(cImp).value = { formula: `SUM(${lImp}6:${lImp}${lastDataRow})`, result: totalImp };
            totalRow.getCell(cExp).value = { formula: `SUM(${lExp}6:${lExp}${lastDataRow})`, result: totalExp };
            totalRow.getCell(cStock).value = { formula: `${lStock}${lastDataRow}`, result: round2(closing) };

            for (let i = 0; i < 5; i++) {
                const cell = totalRow.getCell(b.startCol + i);
                cell.font = { name: 'Times New Roman', size: 11, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
                cell.border = thinBorder;
                if (i >= 1 && i <= 3) cell.numFmt = '#,##0.00';
            }
        }
    },

    populateDataWorksheet(sheet: any, vehicles: WarehouseVehicleMap[]) {
        sheet.getCell('A1').value = 'SO XE';
        sheet.getCell('B1').value = 'NHÀ XE';
        sheet.getCell('A1').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('B1').font = { name: 'Times New Roman', size: 11, bold: true };

        vehicles.forEach((v, idx) => {
            const r = sheet.getRow(idx + 2);
            r.getCell(1).value = v.displayPlate || v.vehiclePlate;
            r.getCell(2).value = v.carrierName;
        });

        sheet.columns = [{ width: 22 }, { width: 24 }];
    }
};

export default WarehouseInventoryService;
