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
    return Math.round((Number(n) || 0) * 1000) / 1000;
}

function extractTrailingRowNum(id: string): number | null {
    const m = (id || '').match(/_(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1]!, 10);
    return isNaN(n) ? null : n;
}

function compareTicketsOrder(a: WarehouseInventoryTicket, b: WarehouseInventoryTicket): number {
    const rA = extractTrailingRowNum(a.id);
    const rB = extractTrailingRowNum(b.id);
    if (rA !== null && rB !== null && a.flowType === b.flowType && a.warehouseId === b.warehouseId && rA !== rB) {
        return rA - rB;
    }
    if (a.reportDate !== b.reportDate) {
        return (a.reportDate || '').localeCompare(b.reportDate || '');
    }
    if (rA !== null && rB !== null && rA !== rB) {
        return rA - rB;
    }
    const shiftTimeKey = (tStr: string | undefined): string => {
        if (!tStr) return '99:99:99';
        const hh = parseInt(tStr.split(':')[0] || '0', 10);
        if (!isNaN(hh) && hh >= 0 && hh < 6) {
            return `${String(hh + 24).padStart(2, '0')}:${tStr.slice(tStr.indexOf(':') + 1)}`;
        }
        return tStr;
    };
    const tA = shiftTimeKey(a.weighOutTime);
    const tB = shiftTimeKey(b.weighOutTime);
    if (tA !== tB) return tA.localeCompare(tB);
    return (a.soPhieu || '').localeCompare(b.soPhieu || '');
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
    if (typeof rawDate === 'number') {
        if (rawDate > 20000 && rawDate < 75000) {
            const utcDays = Math.floor(rawDate - 25569);
            const dt = new Date(utcDays * 86400 * 1000);
            const y = dt.getUTCFullYear();
            const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const d = String(dt.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    const str = String(rawDate).trim().split(' ')[0] || '';
    if (!str || /^\d+(\.\d+)?$/.test(str)) return '';

    // Check YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const yNum = parseInt(isoMatch[1]!, 10);
        if (yNum < 2000 || yNum > 2100) return '';
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
        const yNum = parseInt(y, 10);
        if (yNum < 2000 || yNum > 2100) return '';
        return `${y}-${m}-${d}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        if (y < 2000 || y > 2100) return '';
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

export type CustomerGroup = 'KHO_4' | 'KHO_123';

/**
 * Filter and sanitize customer name string.
 * Strips date objects or Excel date serialization artifacts (e.g. "Sat Dec 30 1899 ...").
 */
export function sanitizeCustomerName(val: any, fallback = ''): string {
    if (!val) return fallback;
    if (val instanceof Date) return fallback;
    const s = String(val).trim();
    if (!s) return fallback;
    if (/1899|1900/.test(s)) return fallback;
    if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s[A-Z][a-z]{2}\s\d{1,2}\s\d{4}/i.test(s)) return fallback;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fallback;
    return s;
}

/**
 * Sanitize dailyRemarks map to purge corrupted date keys (e.g. "100080-01-01")
 * or raw JS Date.toString() values (e.g. "Thu May 28 2026 07:00:00 GMT+0700 (Indochina Time)").
 */
export function sanitizeDailyRemarks(remarks: Record<string, string> | undefined | null): {
    cleaned: Record<string, string>;
    hadInvalid: boolean;
} {
    const cleaned: Record<string, string> = {};
    let hadInvalid = false;
    if (!remarks || typeof remarks !== 'object') return { cleaned, hadInvalid };

    for (const [k, v] of Object.entries(remarks)) {
        const m = k.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) {
            hadInvalid = true;
            continue;
        }
        const y = parseInt(m[1]!, 10);
        const mo = parseInt(m[2]!, 10);
        const d = parseInt(m[3]!, 10);
        if (y < 2020 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) {
            hadInvalid = true;
            continue;
        }

        const valStr = String(v ?? '').trim();
        if (
            /GMT[+-]\d{4}/i.test(valStr) ||
            /Indochina Time/i.test(valStr) ||
            /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s[A-Z][a-z]{2}\s\d{1,2}\s\d{4}/i.test(valStr)
        ) {
            hadInvalid = true;
            continue;
        }

        cleaned[k] = valStr;
    }

    return { cleaned, hadInvalid };
}

/**
 * Determine which Customer Group a ticket belongs to:
 * - KHO_4: Customer owning Kho 4 (Default EASTWOOD)
 * - KHO_123: Customer owning Kho 1, 2, 3 (Default GỖ BÌNH ĐỊNH)
 */
export function getTicketCustomerGroup(
    ticket: WarehouseInventoryTicket,
    configs?: Partial<Record<WarehouseId, WarehouseConfig>>
): 'KHO_4' | 'KHO_123' {
    if (ticket.warehouseId === 'KHO 4') return 'KHO_4';
    if (ticket.warehouseId === 'KHO 1' || ticket.warehouseId === 'KHO 2' || ticket.warehouseId === 'KHO 3') return 'KHO_123';

    const custClean = stripAccents(ticket.customerName || '').toUpperCase().trim();
    const custKho4 = stripAccents(configs?.['KHO 4']?.currentCustomer || 'EASTWOOD').toUpperCase().trim();
    const custKho123 = stripAccents(configs?.['KHO 1']?.currentCustomer || 'GO BINH DINH').toUpperCase().trim();

    if (custClean) {
        if (custClean.includes('EASTWOOD') || custClean.includes('EAST WOOD') || custClean.includes('BACH KHOA') || custClean.includes('EW') || (custKho4 && (custClean.includes(custKho4) || custKho4.includes(custClean)))) {
            return 'KHO_4';
        }
        if (custClean.includes('BINH DINH') || custClean.includes('GBD') || (custKho123 && (custClean.includes(custKho123) || custKho123.includes(custClean)))) {
            return 'KHO_123';
        }
    }

    const remarkClean = stripAccents(ticket.sourceOrRemark || '').toUpperCase();
    if (remarkClean.includes('KHO 4') || remarkClean.includes('EW')) return 'KHO_4';
    if (remarkClean.includes('KHO 1') || remarkClean.includes('KHO 2') || remarkClean.includes('KHO 3') || remarkClean.includes('GBD')) return 'KHO_123';

    if (ticket.id.includes('KHO 4') || ticket.id.includes('EW')) return 'KHO_4';
    if (ticket.id.includes('KHO 1') || ticket.id.includes('KHO 2') || ticket.id.includes('KHO 3') || ticket.id.includes('GBD')) return 'KHO_123';

    return 'KHO_123';
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
    const targetGroup = warehouseId === 'KHO 4' ? 'KHO_4' : 'KHO_123';

    // Direct tickets matching this warehouse's customer group:
    // Kho 4 -> Customer 1 (EASTWOOD); Kho 1..3 -> Customer 2 (GỖ BÌNH ĐỊNH)
    const directTickets = allTickets.filter(t => {
        if (t.flowType !== 'DIRECT') return false;
        if (options?.includeDirectForCustomer === false) return false;
        return getTicketCustomerGroup(t, { [warehouseId]: config } as any) === targetGroup;
    });

    const { cleaned: validRemarks } = sanitizeDailyRemarks(config.dailyRemarks);
    const dateSet = new Set<string>();
    whTickets.forEach(t => {
        if (t.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(t.reportDate)) dateSet.add(t.reportDate);
    });
    if (whTickets.length > 0 || (config.initialStock || 0) !== 0) {
        Object.keys(validRemarks).forEach(d => {
            if (d) dateSet.add(d);
        });
    } else {
        // If warehouse has 0 tickets and 0 initial stock, only include dates that have non-empty human remarks
        Object.entries(validRemarks).forEach(([d, rem]) => {
            if (d && rem) dateSet.add(d);
        });
    }
    // Include direct ticket dates only when this warehouse actually has tickets (or for Kho 4 if it has direct tickets)
    if (whTickets.length > 0 || (warehouseId === 'KHO 4' && directTickets.length > 0)) {
        directTickets.forEach(t => {
            if (t.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(t.reportDate)) {
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

        const manualRemark = validRemarks[d] ? validRemarks[d]! : '';
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
        const local = (await dbContext.get<Record<string, WarehouseConfig>>(LOCAL_CONFIGS_KEY)) || {};
        const merged: Record<WarehouseId, WarehouseConfig> = {
            'KHO 1': { ...defaults['KHO 1'], ...(local['KHO 1'] as WarehouseConfig || {}) },
            'KHO 2': { ...defaults['KHO 2'], ...(local['KHO 2'] as WarehouseConfig || {}) },
            'KHO 3': { ...defaults['KHO 3'], ...(local['KHO 3'] as WarehouseConfig || {}) },
            'KHO 4': { ...defaults['KHO 4'], ...(local['KHO 4'] as WarehouseConfig || {}) }
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

        // Sanitize customer names and dailyRemarks to eliminate date strings or Excel date serial artifacts
        merged['KHO 4'].currentCustomer = sanitizeCustomerName(merged['KHO 4'].currentCustomer, 'EASTWOOD');
        merged['KHO 1'].currentCustomer = sanitizeCustomerName(merged['KHO 1'].currentCustomer, 'GỖ BÌNH ĐỊNH');
        merged['KHO 2'].currentCustomer = sanitizeCustomerName(merged['KHO 2'].currentCustomer, 'GỖ BÌNH ĐỊNH');
        merged['KHO 3'].currentCustomer = sanitizeCustomerName(merged['KHO 3'].currentCustomer, 'GỖ BÌNH ĐỊNH');

        let anyCleaned = false;
        for (const whId of ALL_WAREHOUSES) {
            const { cleaned, hadInvalid } = sanitizeDailyRemarks(merged[whId].dailyRemarks);
            if (hadInvalid) {
                merged[whId].dailyRemarks = cleaned;
                anyCleaned = true;
                await this.saveConfig(merged[whId]);
            }
        }
        if (anyCleaned) {
            await dbContext.set(LOCAL_CONFIGS_KEY, merged);
        }

        return merged;
    },

    async saveConfig(config: WarehouseConfig): Promise<boolean> {
        const defaults = getDefaultConfigs();
        const local = (await dbContext.get<Record<string, WarehouseConfig>>(LOCAL_CONFIGS_KEY)) || {};
        const current: Record<WarehouseId, WarehouseConfig> = {
            'KHO 1': { ...defaults['KHO 1'], ...(local['KHO 1'] as WarehouseConfig || {}) },
            'KHO 2': { ...defaults['KHO 2'], ...(local['KHO 2'] as WarehouseConfig || {}) },
            'KHO 3': { ...defaults['KHO 3'], ...(local['KHO 3'] as WarehouseConfig || {}) },
            'KHO 4': { ...defaults['KHO 4'], ...(local['KHO 4'] as WarehouseConfig || {}) }
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
                    const mergedList = Array.from(mergedMap.values()).sort(compareTicketsOrder);
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
                const sortedFb = [...fb.tickets].sort(compareTicketsOrder);
                await dbContext.set(LOCAL_TICKETS_KEY, sortedFb);
                return sortedFb;
            }
        }

        return local.sort(compareTicketsOrder);
    },

    async saveTicketsBulk(tickets: WarehouseInventoryTicket[]): Promise<number> {
        if (!tickets || tickets.length === 0) return 0;
        const current = (await dbContext.get<WarehouseInventoryTicket[]>(LOCAL_TICKETS_KEY)) || [];
        const map = new Map<string, WarehouseInventoryTicket>();
        for (const t of current) map.set(t.id, t);
        for (const t of tickets) map.set(t.id, t);

        const merged = Array.from(map.values()).sort(compareTicketsOrder);

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

    async clearWarehouseTickets(
        target?: WarehouseId | 'ALL' | 'DIRECT' | 'DIRECT_KHO4' | 'DIRECT_KHO123' | 'GROUP_KHO123'
    ): Promise<boolean> {
        const current = (await dbContext.get<WarehouseInventoryTicket[]>(LOCAL_TICKETS_KEY)) || [];
        const configs = await this.getConfigs();

        if (!target || target === 'ALL') {
            await dbContext.set(LOCAL_TICKETS_KEY, []);
            try {
                await supabase.from('warehouse_inventory_tickets').delete().neq('id', '');
            } catch (_) {}
            for (const whId of ALL_WAREHOUSES) {
                configs[whId].dailyRemarks = {};
                configs[whId].initialStock = 0;
                configs[whId].initialDate = '';
                await this.saveConfig(configs[whId]);
            }
            return true;
        }

        if (target === 'DIRECT') {
            const remaining = current.filter(t => t.flowType !== 'DIRECT');
            await dbContext.set(LOCAL_TICKETS_KEY, remaining);
            try {
                await supabase.from('warehouse_inventory_tickets').delete().eq('flow_type', 'DIRECT');
            } catch (_) {}
            return true;
        }

        if (target === 'DIRECT_KHO4') {
            const remaining = current.filter(t => !(t.flowType === 'DIRECT' && getTicketCustomerGroup(t, configs) === 'KHO_4'));
            await dbContext.set(LOCAL_TICKETS_KEY, remaining);
            try {
                await supabase.from('warehouse_inventory_tickets').delete().eq('flow_type', 'DIRECT').eq('warehouse_id', 'KHO 4');
            } catch (_) {}
            return true;
        }

        if (target === 'DIRECT_KHO123') {
            const remaining = current.filter(t => !(t.flowType === 'DIRECT' && getTicketCustomerGroup(t, configs) === 'KHO_123'));
            await dbContext.set(LOCAL_TICKETS_KEY, remaining);
            try {
                await supabase.from('warehouse_inventory_tickets').delete().eq('flow_type', 'DIRECT').neq('warehouse_id', 'KHO 4');
            } catch (_) {}
            return true;
        }

        if (target === 'GROUP_KHO123') {
            const remaining = current.filter(t => getTicketCustomerGroup(t, configs) !== 'KHO_123');
            await dbContext.set(LOCAL_TICKETS_KEY, remaining);
            try {
                await supabase.from('warehouse_inventory_tickets').delete().in('warehouse_id', ['KHO 1', 'KHO 2', 'KHO 3']);
            } catch (_) {}
            for (const whId of ['KHO 1', 'KHO 2', 'KHO 3'] as WarehouseId[]) {
                configs[whId].dailyRemarks = {};
                configs[whId].initialStock = 0;
                configs[whId].initialDate = '';
                await this.saveConfig(configs[whId]);
            }
            return true;
        }

        const remaining = current.filter(t => t.warehouseId !== target);
        await dbContext.set(LOCAL_TICKETS_KEY, remaining);
        try {
            await supabase.from('warehouse_inventory_tickets').delete().eq('warehouse_id', target);
        } catch (_) {}
        if (configs[target]) {
            configs[target].dailyRemarks = {};
            configs[target].initialStock = 0;
            configs[target].initialDate = '';
            await this.saveConfig(configs[target]);
        }
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
     * Single-Point Import Sync: Push weighbridge rows directly to
     * `allocator_tickets` (CargoAllocator Tab 1 - Phiếu Cân).
     * 
     * Quy tắc:
     * - Nếu file có tên chứa "cc2" (ví dụ xxxx cc2.csv, xxxx_cc2.xlsx): nạp TOÀN BỘ phiếu trong file cc2 (bao gồm cả Nhập và Xuất).
     * - Nếu không phân tách cc1/cc2 rõ rệt: nạp tất cả các dòng Xuất (Xuat/nhap = Xuat).
     */
    async syncRowsToAllocator(rowsToSync: RawWeighbridgeRow[]): Promise<{
        syncedTicketsCount: number;
        matchedBargesCount: number;
    }> {
        if (!rowsToSync || rowsToSync.length === 0) {
            return { syncedTicketsCount: 0, matchedBargesCount: 0 };
        }

        // 1. Merge into allocator_tickets (stored in kg)
        const existingAllocatorTickets = (await dbContext.get<any[]>('allocator_tickets')) || [];
        let syncedCount = 0;

        for (const r of rowsToSync) {
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

        // 2. Không tự động ghép vào sà lan. Dữ liệu chỉ nạp vào Tab Phiếu Cân ở Dữ Liệu Cân Hàng (allocator_tickets),
        // việc đồng bộ vào từng sà lan người dùng sẽ chủ động tiến hành như trước đây.
        return { syncedTicketsCount: syncedCount, matchedBargesCount: 0 };
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
        const cc2RawRows: RawWeighbridgeRow[] = [];
        const fileArray = Array.from(files);

        for (const file of fileArray) {
            try {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const fileNameLower = file.name.toLowerCase();
                const isCc2File = fileNameLower.includes('cc2') || fileNameLower.includes('cc 2');
                let fileRows: RawWeighbridgeRow[] = [];

                if (ext === 'csv') {
                    const text = await readCsvFileDecoded(file);
                    fileRows = parseWeighbridgeCsvText(text);
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
                        fileRows = parseWeighbridgeCsvText(csvLines.join('\n'));
                    }
                }

                allRawRows.push(...fileRows);
                if (isCc2File) {
                    cc2RawRows.push(...fileRows);
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

        // Quy tắc nạp vào Tab Phiếu Cân ở Dữ Liệu Cân Hàng:
        // - Nếu có nạp file "cc2" (ví dụ xxxx cc2.csv): nạp TOÀN BỘ phiếu trong file cc2 (bao gồm cả Nhập và Xuất).
        // - Nếu không có file cc2: nạp các dòng Xuất (Xuat/nhap = Xuat) từ các file đã chọn.
        const rowsToSyncToAllocator = cc2RawRows.length > 0
            ? cc2RawRows
            : allRawRows.filter(r => stripAccents(r.xuatNhap || '').toUpperCase().includes('XUAT'));

        const syncRes = await this.syncRowsToAllocator(rowsToSyncToAllocator);
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
                    if ('result' in val) {
                        val = val.result;
                        if (val && typeof val === 'object' && 'error' in val) return '';
                    } else if ('richText' in val && Array.isArray(val.richText)) {
                        val = val.richText.map((rt: any) => rt.text || '').join('');
                    } else if ('text' in val) {
                        val = val.text;
                    } else if ('formula' in val || 'sharedFormula' in val || 'error' in val) {
                        return '';
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
            // Template files have Row 3 header: Col 2 = STT, Col 3 = SỐ XE, Col 4 = CÔNG TY
            // Web-exported files have Row 1 header: Col 1 = SO XE, Col 2 = NHÀ XE
            const dataSheet = workbook.worksheets.find(ws => stripAccents(ws.name).toUpperCase().trim() === 'DATA');
            const learnedVehicles: WarehouseVehicleMap[] = [];
            if (dataSheet) {
                let plateCol = 1;
                let carrierCol = 2;
                let dataStartRow = 2;
                for (let r = 1; r <= Math.min(8, dataSheet.rowCount); r++) {
                    const row = dataSheet.getRow(r);
                    for (let c = 1; c <= Math.min(10, row.cellCount); c++) {
                        const txt = stripAccents(String(getCellPrimitive(row.getCell(c)) || '')).toUpperCase().trim();
                        if (txt.includes('SO XE') || txt.includes('BIEN SO')) {
                            plateCol = c;
                            carrierCol = c + 1;
                            dataStartRow = r + 1;
                            for (let c2 = c + 1; c2 <= Math.min(10, row.cellCount); c2++) {
                                const txt2 = stripAccents(String(getCellPrimitive(row.getCell(c2)) || '')).toUpperCase().trim();
                                if (txt2.includes('CONG TY') || txt2.includes('NHA XE') || txt2.includes('DON VI') || txt2.includes('DVVC')) {
                                    carrierCol = c2;
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
                for (let r = dataStartRow; r <= dataSheet.rowCount; r++) {
                    const row = dataSheet.getRow(r);
                    const plate = String(getCellPrimitive(row.getCell(plateCol)) || '').trim();
                    const carrier = String(getCellPrimitive(row.getCell(carrierCol)) || '').trim();
                    if (plate && carrier && !stripAccents(plate).toUpperCase().includes('SO XE')) {
                        learnedVehicles.push({
                            vehiclePlate: normalizePlateKey(plate),
                            displayPlate: plate,
                            carrierName: carrier
                        });
                    }
                }
            }
            if (learnedVehicles.length > 0) {
                summary.vehiclesLearnedCount = await this.saveVehiclesBulk(learnedVehicles);
            }

            const vehicleMap = await this.getVehicles();
            const allTickets: WarehouseInventoryTicket[] = [];
            let sheetLevelCustomer = inferredFileCustomer;

            // 2. Parse IMPORT, EXPORT, and XÁ THẲNG sheets
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

                // Extract customer from rows 1..14 if present (e.g. "Khách hàng\n(Customer):" -> "BÁCH KHOA" or "EASTWOOD")
                for (let r = 1; r <= Math.min(14, sheet.rowCount); r++) {
                    const row = sheet.getRow(r);
                    for (let c = 1; c <= Math.min(12, row.cellCount); c++) {
                        const cellTxt = stripAccents(String(getCellPrimitive(row.getCell(c)) || '')).toUpperCase();
                        if (cellTxt.includes('KHACH HANG') || cellTxt.includes('CUSTOMER')) {
                            for (let cNext = c + 1; cNext <= Math.min(c + 4, row.cellCount); cNext++) {
                                const nextVal = sanitizeCustomerName(getCellPrimitive(row.getCell(cNext)), '');
                                if (nextVal && !stripAccents(nextVal).toUpperCase().includes(' LOAI HANG')) {
                                    sheetLevelCustomer = nextVal;
                                    if (sheetWh && configs[sheetWh]) {
                                        configs[sheetWh].currentCustomer = nextVal;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }

                // Find header row (containing STT, NGÀY, SỐ PHIẾU, SỐ XE; can be row 6, 7, 12, 13, or 15)
                let headerRowNum = 6;
                for (let r = 1; r <= Math.min(25, sheet.rowCount); r++) {
                    const row = sheet.getRow(r);
                    let rowText = '';
                    for (let c = 1; c <= Math.min(16, row.cellCount); c++) {
                        rowText += ' ' + stripAccents(String(getCellPrimitive(row.getCell(c)))).toUpperCase();
                    }
                    if (rowText.includes('SO PHIEU') && (rowText.includes('SO XE') || rowText.includes('TL HANG') || rowText.includes('LUONG HANG'))) {
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

                const colDate = findColIdx(h => h.includes('NGAY') && !h.includes('CAN VAO') && !h.includes('CAN RA'), 2);
                const colTicketNo = findColIdx(h => h.includes('PHIEU') && !h.includes('KL'), 3);
                const colPlate = findColIdx(h => h.includes('SO XE') || h.includes('BIEN SO'), 4);
                const colCarrier = findColIdx(h => h.includes('NHA XE') || h.includes('DON VI') || h.includes('CONG TY'), -1);
                // Net weight: "T.Lượng hàng (N.Weight)" (template) or "TL HÀNG" (legacy web export)
                const colWeight = findColIdx(h =>
                    h.includes('LUONG HANG') ||
                    h.includes('N.WEIGHT') ||
                    h.includes('TL HANG') ||
                    h.includes('KL HANG') ||
                    (h.includes('TRONG LUONG') && !h.includes('VAO') && !h.includes('RA')),
                7);
                const colGross = findColIdx(h => h.includes('LUONG VAO') || h.includes('WEIGHT IN') || h.includes('TL VAO'), -1);
                const colTare = findColIdx(h => h.includes('LUONG RA') || h.includes('WEIGHT OUT') || h.includes('TL RA'), -1);
                const colTimeIn = findColIdx(h => h.includes('CAN VAO') || h.includes('GIO VAO'), -1);
                const colTimeOut = findColIdx(h => h.includes('CAN RA') || h.includes('GIO RA'), -1);
                const colTimeGeneric = findColIdx(h => h.includes('GIO'), -1);
                const colFactory = findColIdx(h => h.includes('NHA MAY') || h.includes('KL PHIEU') || h.includes('PHIEU CAN'), -1);
                const colRemark1 = findColIdx(h => (h.includes('GHI CHU') && !h.includes('2')) || h.includes('NGUON'), -1);
                const colRemark2 = findColIdx(h => h.includes('GHI CHU 2'), -1);
                const colPlace = findColIdx(h => h.includes('NOI NHAN'), -1);
                const colWarehouse = findColIdx(h => h.includes('KHO') || h.includes('WAREHOUSE'), -1);
                const colInOut = findColIdx(h => h.includes('NHAP/XUAT') || h.includes('NHAP/ XUAT') || h.includes('IN/OUT'), -1);

                const cellAt = (row: any, idx: number): any => (idx >= 1 ? getCellPrimitive(row.getCell(idx)) : '');
                const weightAt = (row: any, idx: number): number => {
                    const v = cellAt(row, idx);
                    if (v === '' || v === null || v instanceof Date || typeof v === 'object') return 0;
                    return normalizeWeightToTons(v);
                };

                for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
                    const row = sheet.getRow(r);
                    const rawDateVal = getCellPrimitive(row.getCell(colDate));
                    const rawPlateVal = String(getCellPrimitive(row.getCell(colPlate)) || '').trim();
                    const rawWeightVal = getCellPrimitive(row.getCell(colWeight));

                    const reportDate = parseToIsoDate(rawDateVal);
                    const netWeight = normalizeWeightToTons(rawWeightVal);
                    if (!reportDate || !rawPlateVal || netWeight <= 0) continue;

                    const soPhieu = String(getCellPrimitive(row.getCell(colTicketNo)) || '').trim();
                    let carrierName = colCarrier >= 1
                        ? String(getCellPrimitive(row.getCell(colCarrier)) || '').trim()
                        : '';
                    if ((!carrierName || carrierName === '0') && isImportSheet && colHeaders.length <= 14) {
                        // In standard 14-column IMPORT sheet, Col 14 holds VLOOKUP carrier even if Row 6 header cell 14 is blank
                        const col14Val = String(getCellPrimitive(row.getCell(14)) || '').trim();
                        if (col14Val && col14Val !== '0' && !/^\d+(\.\d+)?$/.test(col14Val)) {
                            carrierName = col14Val;
                        }
                    }
                    if (!carrierName || carrierName === '0' || /^\d+(\.\d+)?$/.test(carrierName)) {
                        carrierName = lookupCarrierName(rawPlateVal, vehicleMap);
                    }

                    const grossWeight = weightAt(row, colGross);
                    const tareWeight = weightAt(row, colTare);
                    const weighInTime = parseToTimeStr(cellAt(row, colTimeIn));
                    const weighOutTimeAny = parseToTimeStr(cellAt(row, colTimeOut)) || parseToTimeStr(cellAt(row, colTimeGeneric));

                    if (isImportSheet && sheetWh) {
                        const sourceOrRemark = String(cellAt(row, colRemark1) || '').trim();
                        const remark2 = String(cellAt(row, colRemark2) || '').trim();
                        const fw = weightAt(row, colFactory);
                        const factoryWeight = fw > 0 ? fw : null;

                        // Note: In historical Excel sheets, the NGÀY column is ALREADY the 6:00 AM shift-adjusted reportDate!
                        const id = `IMPORT_${sheetWh}_${soPhieu || normalizePlateKey(rawPlateVal)}_${reportDate}_${r}`;
                        allTickets.push({
                            id,
                            soPhieu,
                            maLenh: '',
                            reportDate,
                            weighInDate: reportDate,
                            weighInTime: weighInTime || weighOutTimeAny,
                            weighOutDate: reportDate,
                            weighOutTime: weighOutTimeAny,
                            flowType: 'IMPORT',
                            warehouseId: sheetWh,
                            customerName: sheetLevelCustomer || configs[sheetWh]?.currentCustomer || '',
                            cargoType: 'Viên nén gỗ',
                            vehiclePlate: rawPlateVal,
                            carrierName,
                            grossWeight,
                            tareWeight,
                            netWeight,
                            factoryWeight,
                            bargeInfo: '',
                            vesselName: '',
                            sourceOrRemark,
                            rawNote: remark2
                        });
                        summary.importFlowCount++;
                    } else if (isExportSheet && sheetWh) {
                        const colBarge = findColIdx(h => h.includes('SA LAN') || h.includes('SALAN'), -1);
                        const colVessel = findColIdx(h => h === 'TAU' || h.includes('TEN TAU'), -1);
                        const colCust = findColIdx(h => h.includes('KHACH'), -1);

                        const bargeInfo = String(cellAt(row, colBarge) || '').trim();
                        const vesselName = String(cellAt(row, colVessel) || '').trim();
                        const weighOutTime = weighOutTimeAny;
                        const custVal = colCust > 0 ? sanitizeCustomerName(cellAt(row, colCust), '') : '';
                        const customerName = custVal || sheetLevelCustomer || configs[sheetWh]?.currentCustomer || '';
                        const inOutVal = String(cellAt(row, colInOut) || 'Xuất').trim();
                        const whLabel = String(cellAt(row, colWarehouse) || cellAt(row, colPlace) || sheetWh).trim();
                        const exportRemark = String(cellAt(row, colRemark1) || '').trim();

                        if (customerName && configs[sheetWh] && sanitizeCustomerName(customerName, '')) {
                            configs[sheetWh].currentCustomer = sanitizeCustomerName(customerName, configs[sheetWh].currentCustomer);
                        }

                        const id = `EXPORT_${sheetWh}_${soPhieu || normalizePlateKey(rawPlateVal)}_${reportDate}_${r}`;
                        allTickets.push({
                            id,
                            soPhieu,
                            maLenh: inOutVal,
                            reportDate,
                            weighInDate: reportDate,
                            weighInTime: weighInTime || weighOutTime,
                            weighOutDate: reportDate,
                            weighOutTime,
                            flowType: 'EXPORT',
                            warehouseId: sheetWh,
                            customerName,
                            cargoType: 'Viên nén gỗ',
                            vehiclePlate: rawPlateVal,
                            carrierName,
                            grossWeight,
                            tareWeight,
                            netWeight,
                            factoryWeight: null,
                            bargeInfo,
                            vesselName,
                            sourceOrRemark: whLabel,
                            rawNote: exportRemark
                        });
                        summary.exportFlowCount++;
                    } else if (isDirectSheet) {
                        const colBarge = findColIdx(h => h.includes('SA LAN') || h.includes('SALAN'), -1);
                        const colVessel = findColIdx(h => h === 'TAU' || h.includes('TEN TAU'), -1);

                        // In ĐI THẲNG template, Col 8 is "Nhập/ Xuất", Col 13 is "Ghi chú" (barge info), Col 14 is "Nơi nhận" (source), Col 15 is "Tàu"
                        const rawInOut = cellAt(row, colInOut);
                        const inOutStr = typeof rawInOut === 'number' && rawInOut > 0 && rawInOut < 1
                            ? parseToTimeStr(rawInOut)
                            : String(rawInOut || '').trim();
                        const bargeInfo = String(cellAt(row, colBarge) || cellAt(row, colRemark1) || '').trim();
                        const vesselName = String(cellAt(row, colVessel) || '').trim();
                        const weighOutTime = weighOutTimeAny;
                        const sourceOrRemark = String(cellAt(row, colPlace) || (colBarge > 0 ? cellAt(row, colRemark1) : '') || '').trim();

                        const isKho4File = updatedWhSet.has('KHO 4') || defaultWh === 'KHO 4' || sheetLevelCustomer === 'EASTWOOD' || fileNameClean.includes('EW') || fileNameClean.includes('KHO 4');
                        const targetWh: WarehouseId = isKho4File ? 'KHO 4' : 'KHO 1';
                        const directCust = isKho4File
                            ? sanitizeCustomerName(sheetLevelCustomer, configs['KHO 4']?.currentCustomer || 'EASTWOOD')
                            : sanitizeCustomerName(sheetLevelCustomer, configs['KHO 1']?.currentCustomer || 'GỖ BÌNH ĐỊNH');

                        const id = `DIRECT_${targetWh}_${soPhieu || normalizePlateKey(rawPlateVal)}_${reportDate}_${r}`;
                        allTickets.push({
                            id,
                            soPhieu,
                            maLenh: inOutStr,
                            reportDate,
                            weighInDate: reportDate,
                            weighInTime: weighInTime || weighOutTime,
                            weighOutDate: reportDate,
                            weighOutTime,
                            flowType: 'DIRECT',
                            warehouseId: targetWh,
                            customerName: directCust,
                            cargoType: 'Viên nén gỗ',
                            vehiclePlate: rawPlateVal,
                            carrierName,
                            grossWeight,
                            tareWeight,
                            netWeight,
                            factoryWeight: weightAt(row, colFactory) || null,
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
                for (let r = 1; r <= Math.min(12, finalSheet.rowCount); r++) {
                    const row = finalSheet.getRow(r);
                    const c7 = stripAccents(String(getCellPrimitive(row.getCell(7)))).toUpperCase();
                    const c8 = stripAccents(String(getCellPrimitive(row.getCell(8)))).toUpperCase();
                    const c13 = stripAccents(String(getCellPrimitive(row.getCell(13)))).toUpperCase();
                    const c14 = stripAccents(String(getCellPrimitive(row.getCell(14)))).toUpperCase();
                    if (c7.includes('KHO 2') || c8.includes('KHO 2') || c13.includes('KHO 3') || c14.includes('KHO 3') || c7.startsWith('NGAY')) {
                        isThreeWhHorizontal = true;
                        break;
                    }
                }

                if (isThreeWhHorizontal) {
                    const blocks: Array<{ wh: WarehouseId; dateCol: number; impCol: number; stockCol: number; remarkCol: number }> = [
                        { wh: 'KHO 1', dateCol: 1, impCol: 2, stockCol: 4, remarkCol: 5 },
                        { wh: 'KHO 2', dateCol: 7, impCol: 8, stockCol: 10, remarkCol: 11 },
                        { wh: 'KHO 3', dateCol: 13, impCol: 14, stockCol: 16, remarkCol: 17 }
                    ];
                    for (const b of blocks) {
                        updatedWhSet.add(b.wh);
                        configs[b.wh].dailyRemarks = {};
                        configs[b.wh].initialStock = 0;
                        configs[b.wh].initialDate = '';
                        if (sheetLevelCustomer) configs[b.wh].currentCustomer = sheetLevelCustomer;
                        for (let r = 5; r <= finalSheet.rowCount; r++) {
                            const row = finalSheet.getRow(r);
                            const rawDateCell = getCellPrimitive(row.getCell(b.dateCol));
                            const rawDateStr = stripAccents(String(rawDateCell || '')).toUpperCase().trim();
                            if (rawDateStr.includes('TON DAU')) {
                                const openVal = normalizeWeightToTons(getCellPrimitive(row.getCell(b.stockCol)) || getCellPrimitive(row.getCell(b.impCol)));
                                configs[b.wh].initialStock = openVal;
                                continue;
                            }
                            if (rawDateStr.includes('TONG CONG') || rawDateStr.includes('TOTAL')) {
                                break;
                            }
                            const dIso = parseToIsoDate(rawDateCell);
                            if (!dIso) continue;
                            const rawRemCell = getCellPrimitive(row.getCell(b.remarkCol));
                            const rem = rawRemCell instanceof Date ? '' : String(rawRemCell || '').trim();
                            if (rem && !/^\d+(\.\d+)?$/.test(rem)) {
                                configs[b.wh].dailyRemarks[dIso] = rem;
                            }
                        }
                    }
                } else {
                    const fWh = normalizeWarehouseId(finalSheet.name) || defaultWh;
                    updatedWhSet.add(fWh);
                    configs[fWh].dailyRemarks = {};
                    configs[fWh].initialStock = 0;
                    configs[fWh].initialDate = '';
                    if (sheetLevelCustomer) configs[fWh].currentCustomer = sheetLevelCustomer;

                    // Detect columns in Single-Warehouse FINAL:
                    // Native template: Col 1=Ngày, Col 2=Trọng lượng nhập, Col 3=Trọng lượng xuất, Col 4=Tồn cuối, Col 5=Xá thẳng/Ghi chú, Col 6=Ghi chú
                    let fHeaderRow = 7;
                    let dateCol = 1;
                    let impCol = 2;
                    let stockCol = 4;
                    let remCol = 6;
                    for (let r = 1; r <= Math.min(15, finalSheet.rowCount); r++) {
                        const row = finalSheet.getRow(r);
                        for (let c = 1; c <= Math.min(8, row.cellCount); c++) {
                            const txt = stripAccents(String(getCellPrimitive(row.getCell(c)) || '')).toUpperCase().trim();
                            if (txt === 'NGAY' || txt.startsWith('NGAY') || txt.includes('DATE')) {
                                fHeaderRow = r;
                                dateCol = c;
                            } else if (txt.includes('TON CUOI') || txt.includes('TON KHO') || txt.includes('STOCK') || txt.includes('REMAINING')) {
                                stockCol = c;
                            } else if (txt.includes('GHI CHU') || txt.includes('REMARK')) {
                                remCol = c;
                            } else if (txt.includes('NHAP') || txt.includes('IMPORT')) {
                                impCol = c;
                            }
                        }
                    }

                    let checkedFirstDataRow = false;
                    for (let r = fHeaderRow + 1; r <= finalSheet.rowCount; r++) {
                        const row = finalSheet.getRow(r);
                        const rawDateCell = getCellPrimitive(row.getCell(dateCol));
                        const rawDateStr = stripAccents(String(rawDateCell || '')).toUpperCase().trim();

                        if (rawDateStr.includes('TON DAU')) {
                            const openVal = normalizeWeightToTons(getCellPrimitive(row.getCell(stockCol)) || getCellPrimitive(row.getCell(impCol)));
                            configs[fWh].initialStock = openVal;
                            continue;
                        }
                        if (rawDateStr.includes('TONG CONG') || rawDateStr.includes('TOTAL')) {
                            break;
                        }

                        const dIso = parseToIsoDate(rawDateCell);
                        if (!dIso) continue;

                        const rawRemCell = getCellPrimitive(row.getCell(remCol));
                        const rem = rawRemCell instanceof Date ? '' : String(rawRemCell || '').trim();
                        configs[fWh].dailyRemarks[dIso] = (!rem || /^\d+(\.\d+)?$/.test(rem)) ? '' : rem;

                        // Detect opening stock row on first date row (e.g. 26/12/2025 in EW Kho 4 where Col 2 is a literal number 17,652,550 with remark "Tồn kho đến 26/12/2025")
                        if (!checkedFirstDataRow) {
                            checkedFirstDataRow = true;
                            const impCellRaw = row.getCell(impCol)?.value;
                            const isLiteralNumber = typeof impCellRaw === 'number' && impCellRaw > 0;
                            const remClean = stripAccents(rem).toUpperCase();
                            const hasImportTicketsOnDate = allTickets.some(
                                t => t.warehouseId === fWh && t.flowType === 'IMPORT' && t.reportDate === dIso
                            );
                            if (isLiteralNumber && (!hasImportTicketsOnDate || remClean.includes('TON KHO DEN') || remClean.includes('THEO BAO CAO'))) {
                                configs[fWh].initialStock = normalizeWeightToTons(impCellRaw);
                                configs[fWh].initialDate = dIso;
                            }
                        }
                    }
                }
            }

            // Clear previous tickets for the imported warehouse group before saving fresh historical workbook tickets
            if (allTickets.length > 0) {
                if (updatedWhSet.has('KHO 4') && updatedWhSet.size === 1) {
                    await this.clearWarehouseTickets('KHO 4');
                    await this.clearWarehouseTickets('DIRECT_KHO4');
                } else if (updatedWhSet.has('KHO 1') || updatedWhSet.has('KHO 2') || updatedWhSet.has('KHO 3')) {
                    await this.clearWarehouseTickets('GROUP_KHO123');
                }
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
        const directSheetName = 'XÁ THẲNG';

        const allTickets = await this.getAllTickets();
        const configs = await this.getConfigs();
        const vehicleMap = await this.getVehicles();
        const config = configs[warehouseId];

        const whImports = allTickets.filter(t => t.warehouseId === warehouseId && t.flowType === 'IMPORT');
        const whExports = allTickets.filter(t => t.warehouseId === warehouseId && t.flowType === 'EXPORT');
        const targetGroup = warehouseId === 'KHO 4' ? 'KHO_4' : 'KHO_123';
        const directTickets = allTickets.filter(t => t.flowType === 'DIRECT' && getTicketCustomerGroup(t, configs) === targetGroup);

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

        // 4. Sheet XÁ THẲNG
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

        // 3. Sheet XÁ THẲNG (Kho 1-2-3 / Gỗ Bình Định)
        const wsDirect = workbook.addWorksheet('XÁ THẲNG');
        this.populateDirectWorksheet(
            wsDirect,
            allTickets.filter(t => t.flowType === 'DIRECT' && getTicketCustomerGroup(t, configs) === 'KHO_123')
        );

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

        sheet.getCell('A2').value = `BẢNG KÊ TRỌNG LƯỢNG HÀNG NHẬP (WEIGHT LIST OF IMPORT CARGO) - ${warehouseId}`;
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 13, bold: true };
        sheet.getCell('C4').value = 'Khách hàng\n(Customer):';
        sheet.getCell('C4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('E4').value = customerName || '';
        sheet.getCell('E4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('I4').value = 'Loại hàng (Cargo):';
        sheet.getCell('I4').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('J4').value = 'Viên nén gỗ (Wood pellets)';
        sheet.getCell('J4').font = { name: 'Times New Roman', size: 11, bold: true };

        const headers = [
            'STT (No)',
            'Ngày nhập\nDate',
            'Số phiếu (Serial)',
            'Số xe (Truck no)',
            'T.Lượng vào (Weight in)',
            'T.Lượng ra (Weight out)',
            'T.Lượng hàng (N.Weight)',
            'Ngày cân vào',
            'Ngày cân ra',
            'Cân Nhà Máy',
            'Chênh lệch',
            'Ghi chú',
            'Ghi chú 2',
            'Nhà xe'
        ];
        const hRow = sheet.getRow(6);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.border = thinBorder;
        });
        hRow.height = 28;

        tickets.forEach((t, idx) => {
            const rNum = idx + 7;
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
            row.getCell(5).value = round2(t.grossWeight || 0);
            row.getCell(5).numFmt = '#,##0.00';
            row.getCell(6).value = round2(t.tareWeight || 0);
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).value = round2(t.netWeight);
            row.getCell(7).numFmt = '#,##0.00';
            row.getCell(8).value = t.weighInTime || '';
            row.getCell(9).value = t.weighOutTime || '';
            if (t.factoryWeight != null && t.factoryWeight > 0) {
                row.getCell(10).value = round2(t.factoryWeight);
                row.getCell(10).numFmt = '#,##0.00';
                row.getCell(11).value = {
                    formula: `G${rNum}-J${rNum}`,
                    result: round2(t.netWeight - t.factoryWeight)
                };
                row.getCell(11).numFmt = '#,##0.00';
            }
            row.getCell(12).value = t.sourceOrRemark || '';
            row.getCell(13).value = t.rawNote || '';
            row.getCell(14).value = {
                formula: `IFERROR(VLOOKUP(D${rNum},Data!$A$2:$B$500,2,0),"")`,
                result: t.carrierName || ''
            };

            for (let c = 1; c <= 14; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        const lastDataRow = Math.max(7, tickets.length + 6);
        const totalRowNum = tickets.length + 7;
        const totalRow = sheet.getRow(totalRowNum);
        const totalGross = round2(tickets.reduce((s, t) => s + (Number(t.grossWeight) || 0), 0));
        const totalTare = round2(tickets.reduce((s, t) => s + (Number(t.tareWeight) || 0), 0));
        const totalNet = round2(tickets.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        const totalFactory = round2(tickets.reduce((s, t) => s + (Number(t.factoryWeight) || 0), 0));
        const totalDiff = round2(
            tickets.reduce((s, t) => s + (t.factoryWeight != null && t.factoryWeight > 0 ? (Number(t.netWeight) || 0) - Number(t.factoryWeight) : 0), 0)
        );

        totalRow.getCell(1).value = 'Tổng cộng (Total):';
        totalRow.getCell(5).value = { formula: `SUBTOTAL(9,E7:E${lastDataRow})`, result: totalGross };
        totalRow.getCell(6).value = { formula: `SUBTOTAL(9,F7:F${lastDataRow})`, result: totalTare };
        totalRow.getCell(7).value = { formula: `SUBTOTAL(9,G7:G${lastDataRow})`, result: totalNet };
        totalRow.getCell(10).value = { formula: `SUBTOTAL(9,J7:J${lastDataRow})`, result: totalFactory };
        totalRow.getCell(11).value = { formula: `SUBTOTAL(9,K7:K${lastDataRow})`, result: totalDiff };

        for (let c = 1; c <= 14; c++) {
            const cell = totalRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.border = thinBorder;
            if ((c >= 5 && c <= 7) || c === 10 || c === 11) {
                cell.numFmt = '#,##0.00';
            }
        }

        sheet.columns = [
            { width: 9 }, { width: 13 }, { width: 15 }, { width: 18 }, { width: 16 },
            { width: 16 }, { width: 16 }, { width: 13 }, { width: 13 }, { width: 14 },
            { width: 13 }, { width: 18 }, { width: 14 }, { width: 16 }
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

        sheet.getCell('A1').value = 'BÁO CÁO CHI TIẾT CÂN XUẤT KHO';
        sheet.getCell('A1').font = { name: 'Times New Roman', size: 13, bold: true };
        sheet.getCell('A2').value = '(WEIGHING LIST REPORT)';
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('A3').value = 'Nguồn gốc (Origin):';
        sheet.getCell('C3').value = warehouseId;
        sheet.getCell('A4').value = 'Hàng hóa (Cargo):';
        sheet.getCell('C4').value = 'VIÊN GỖ NÉN';
        sheet.getCell('A5').value = 'Khách hàng ( Customer):';
        sheet.getCell('C5').value = customerName || '';

        const lastDataRow = Math.max(8, tickets.length + 7);
        const totalTons = round2(tickets.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        sheet.getCell('G6').value = { formula: `SUBTOTAL(9,G8:G${lastDataRow})`, result: totalTons };
        sheet.getCell('G6').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('G6').numFmt = '#,##0.00';

        const headers = [
            'STT (No)',
            'Ngày xuất\n(Date)',
            'Số phiếu (Serial)',
            'Số xe (Truck no)',
            'T.Lượng vào (Weight in)',
            'T.Lượng ra (Weight out)',
            'T.Lượng hàng (N.Weight)',
            'Nhập/Xuất (In/Out)',
            'Kho (Warehouse)',
            'Ngày cân vào',
            'Ngày cân ra',
            'Salan',
            'Tàu',
            'Ghi chú'
        ];
        const hRow = sheet.getRow(7);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.border = thinBorder;
        });
        hRow.height = 28;

        tickets.forEach((t, idx) => {
            const rNum = idx + 8;
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
            row.getCell(5).value = round2(t.grossWeight || 0);
            row.getCell(5).numFmt = '#,##0.00';
            row.getCell(6).value = round2(t.tareWeight || 0);
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).value = round2(t.netWeight);
            row.getCell(7).numFmt = '#,##0.00';
            row.getCell(8).value = t.maLenh || 'Xuất';
            row.getCell(9).value = t.sourceOrRemark || warehouseId;
            row.getCell(10).value = t.weighInTime || '';
            row.getCell(11).value = t.weighOutTime || '';
            row.getCell(12).value = t.bargeInfo || '';
            row.getCell(13).value = t.vesselName || '';
            row.getCell(14).value = t.rawNote || '';

            for (let c = 1; c <= 14; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        sheet.columns = [
            { width: 9 }, { width: 13 }, { width: 15 }, { width: 18 }, { width: 16 },
            { width: 16 }, { width: 16 }, { width: 14 }, { width: 15 }, { width: 13 },
            { width: 13 }, { width: 26 }, { width: 20 }, { width: 20 }
        ];
    },

    populateDirectWorksheet(sheet: any, tickets: WarehouseInventoryTicket[]) {
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
        };

        sheet.getCell('A1').value = 'BÁO CÁO CHI TIẾT CÂN XE ĐI THẲNG';
        sheet.getCell('A1').font = { name: 'Times New Roman', size: 13, bold: true };
        sheet.getCell('A2').value = '(WEIGHING LIST REPORT)';
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('A4').value = 'Hàng hóa (Cargo):';
        sheet.getCell('C4').value = 'Viên Nén Gỗ (FSC Mix 1%)';
        sheet.getCell('A5').value = 'Khách hàng (Customer):';
        sheet.getCell('C5').value = tickets[0]?.customerName || '';

        const headers = [
            'STT (No)',
            'Ngày nhập\nDate',
            'Số phiếu (Serial)',
            'Số xe (Truck no)',
            'T.Lượng vào (Weight in)',
            'T.Lượng ra (Weight out)',
            'T.Lượng hàng (N.Weight)',
            'Nhập/ Xuất',
            'Ngày cân vào',
            'Ngày cân ra',
            'Cân Nhà Máy',
            'Chênh lệch',
            'Ghi chú',
            'Nơi nhận',
            'Tàu'
        ];
        const hRow = sheet.getRow(7);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            cell.border = thinBorder;
        });
        hRow.height = 28;

        tickets.forEach((t, idx) => {
            const rNum = idx + 8;
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
            row.getCell(5).value = round2(t.grossWeight || 0);
            row.getCell(5).numFmt = '#,##0.00';
            row.getCell(6).value = round2(t.tareWeight || 0);
            row.getCell(6).numFmt = '#,##0.00';
            row.getCell(7).value = round2(t.netWeight);
            row.getCell(7).numFmt = '#,##0.00';
            row.getCell(8).value = t.maLenh || '';
            row.getCell(9).value = t.weighInTime || '';
            row.getCell(10).value = t.weighOutTime || '';
            if (t.factoryWeight != null && t.factoryWeight > 0) {
                row.getCell(11).value = round2(t.factoryWeight);
                row.getCell(11).numFmt = '#,##0.00';
                row.getCell(12).value = {
                    formula: `G${rNum}-K${rNum}`,
                    result: round2(t.netWeight - t.factoryWeight)
                };
                row.getCell(12).numFmt = '#,##0.00';
            }
            row.getCell(13).value = t.bargeInfo || '';
            row.getCell(14).value = t.sourceOrRemark || '';
            row.getCell(15).value = t.vesselName || '';

            for (let c = 1; c <= 15; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11 };
                row.getCell(c).border = thinBorder;
            }
        });

        const lastDataRow = Math.max(8, tickets.length + 7);
        const totalRowNum = tickets.length + 8;
        const totalRow = sheet.getRow(totalRowNum);
        const totalTons = round2(tickets.reduce((s, t) => s + (Number(t.netWeight) || 0), 0));
        totalRow.getCell(1).value = 'TỔNG CỘNG';
        totalRow.getCell(7).value = { formula: `SUBTOTAL(9,G8:G${lastDataRow})`, result: totalTons };
        for (let c = 1; c <= 15; c++) {
            const cell = totalRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.border = thinBorder;
            if (c === 7) cell.numFmt = '#,##0.00';
        }

        sheet.columns = [
            { width: 9 }, { width: 13 }, { width: 15 }, { width: 18 }, { width: 16 },
            { width: 16 }, { width: 16 }, { width: 12 }, { width: 13 }, { width: 13 },
            { width: 14 }, { width: 13 }, { width: 26 }, { width: 18 }, { width: 18 }
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

        sheet.getCell('A1').value = 'BÁO CÁO NHẬP- XUẤT KHO';
        sheet.getCell('A1').font = { name: 'Times New Roman', size: 14, bold: true };
        sheet.getCell('A2').value = 'DAILY IMPORTED - EXPORTED  REPORT';
        sheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };
        sheet.getCell('A3').value = 'Warehouse:';
        sheet.getCell('B3').value = `Nguyên Ngọc ${warehouseId}`;
        sheet.getCell('A4').value = 'Customer:';
        sheet.getCell('B4').value = customerName || '';
        sheet.getCell('A5').value = 'Cargo:';
        sheet.getCell('B5').value = 'Viên Nén Gỗ';

        const headers = [
            'Ngày\nDate',
            'Trọng lượng nhập \nImported weight',
            'Trọng lượng xuất \nExported weight',
            'Tồn cuối \nStock',
            'Xá thẳng',
            'Ghi chú\nRemarks '
        ];
        const hRow = sheet.getRow(7);
        headers.forEach((h, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value = h;
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = thinBorder;
        });
        hRow.height = 28;

        // Row 8: Tồn đầu row
        const initRow = sheet.getRow(8);
        initRow.getCell(1).value = 'Tồn đầu';
        initRow.getCell(4).value = round2(openingStock);
        initRow.getCell(4).numFmt = '#,##0.00';
        for (let c = 1; c <= 6; c++) {
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

            row.getCell(1).value = excelDate;
            row.getCell(1).numFmt = 'dd/mm/yyyy';

            row.getCell(2).value = {
                formula: `SUMIFS('${importSheetName}'!$G$7:$G$50000,'${importSheetName}'!$B$7:$B$50000,A${rNum})`,
                result: round2(r.importTons)
            };
            row.getCell(2).numFmt = '#,##0.00';

            row.getCell(3).value = {
                formula: `SUMIFS('${exportSheetName}'!$G$8:$G$50000,'${exportSheetName}'!$B$8:$B$50000,A${rNum})`,
                result: round2(r.exportTons)
            };
            row.getCell(3).numFmt = '#,##0.00';

            row.getCell(4).value = {
                formula: `D${rNum - 1}+B${rNum}-C${rNum}`,
                result: round2(r.remainingStockTons)
            };
            row.getCell(4).numFmt = '#,##0.00';

            row.getCell(5).value = {
                formula: `SUMIF('${directSheetName}'!$B$8:$B$50000,A${rNum},'${directSheetName}'!$G$8:$G$50000)`,
                result: round2(r.directTons)
            };
            row.getCell(5).numFmt = '#,##0.00';

            row.getCell(6).value = r.remark || '';

            for (let c = 1; c <= 6; c++) {
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

        totalRow.getCell(1).value = 'Tổng cộng (Total)';
        totalRow.getCell(2).value = { formula: `SUM(B9:B${lastDataRow})`, result: totalImp };
        totalRow.getCell(3).value = { formula: `SUM(C9:C${lastDataRow})`, result: totalExp };
        totalRow.getCell(4).value = { formula: `D${lastDataRow}`, result: round2(closing) };
        totalRow.getCell(5).value = { formula: `SUM(E9:E${lastDataRow})`, result: totalDir };

        for (let c = 1; c <= 6; c++) {
            const cell = totalRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.border = thinBorder;
            if (c >= 2 && c <= 5) cell.numFmt = '#,##0.00';
        }

        sheet.columns = [
            { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 32 }
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
                    formula: `SUMIF('${b.importSheet}'!$B$7:$B$50000,${lDate}${rNum},'${b.importSheet}'!$G$7:$G$50000)`,
                    result: round2(r.importTons)
                };
                row.getCell(cImp).numFmt = '#,##0.00';

                row.getCell(cExp).value = {
                    formula: `SUMIF('${b.exportSheet}'!$B$8:$B$50000,${lDate}${rNum},'${b.exportSheet}'!$G$8:$G$50000)`,
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
