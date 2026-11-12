import type {
    SettlementContract,
    FuelTier,
    BargeDemurrageItem,
    DailyFuelPrice,
    DebitNoteLineItem,
    SettlementSummary,
    SettlementTicketFlows
} from '@/types/settlement';
import { numberToVietnameseWords, numberToEnglishWords } from './numberToWords';

export const DEFAULT_FUEL_TIERS: FuelTier[] = [
    { id: 'tier_1', label: '< 20,000', minPrice: 0, maxPrice: 20000 },
    { id: 'tier_2', label: '20,000 - 25,000', minPrice: 20000, maxPrice: 25000 },
    { id: 'tier_3', label: '25,001 - 30,000', minPrice: 25001, maxPrice: 30000 },
    { id: 'tier_4', label: '30,001 - 35,000', minPrice: 30001, maxPrice: 35000 },
    { id: 'tier_5', label: '35,001 - 40,000', minPrice: 35001, maxPrice: 40000 },
    { id: 'tier_6', label: '40,001 - 45,000', minPrice: 40001, maxPrice: 45000 },
    { id: 'tier_7', label: '45,001 - 50,000', minPrice: 45001, maxPrice: 50000 }
];

export const DEFAULT_GREEN_WOOD_CONTRACT: SettlementContract = {
    id: 'contract_gw_01_2026',
    customerName: 'CÔNG TY CỔ PHẦN GREEN WOOD BÌNH PHƯỚC ENERGY',
    cargoName: 'Viên gỗ nén',
    agreementNo: '01-2026/HDNT/GW-TVPL',
    serviceOrderPrefix: 'SO261014',
    fuelTiers: DEFAULT_FUEL_TIERS,
    freeDemurrageDays: 7,
    demurrageRatePerTonDay: 3000,
    vatRate: 0.08,
    beneficiaryInfo: {
        name: 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG THỊ VẢI',
        accountNo: '111617783979',
        bank: 'Ngân hàng TMCP Công Thương Việt Nam CN BINH DUONG - HOI SO'
    },
    services: [
        {
            id: 'srv_xuat_kho_nha_be',
            code: 'XUAT_KHO_NHA_BE',
            name: 'Phí xuất hàng XÁ từ kho Nguyên Ngọc – xếp lên tàu biển cập Phao Nhà Bè bằng cẩu tàu đối với hàng LƯU KHO Nguyên Ngọc.',
            subTitle: 'Kho Nguyên Ngọc - Sà lan - Phao Nhà Bè - Tàu biển sử dụng CẨU TÀU',
            unit: 'Tấn',
            contractRef: 'Hợp đồng số 01-2026/GW-TVPL và Phụ lục số 2',
            category: 'STEVEDORING',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 165000,
                tier_2: 175000,
                tier_3: 181000,
                tier_4: 187000,
                tier_5: 193000,
                tier_6: 199000,
                tier_7: 205000
            }
        },
        {
            id: 'srv_xe_salan_nha_be',
            code: 'XE_SALAN_NHA_BE',
            name: 'Phí xuất hàng từ xe tải xuống sà lan tại Cảng Nguyên Ngọc và xếp hàng lên tàu biển cập tại phao Nhà Bè bằng cẩu tàu đối với hàng hoá KHÔNG lưu kho Nguyên Ngọc.',
            subTitle: 'Xe - Sà lan Nguyên Ngọc - Phao Nhà Bè - Tàu biển sử dụng CẨU TÀU',
            unit: 'Tấn',
            contractRef: 'Hợp đồng số 01-2026/GW-TVPL và Phụ lục số 2',
            category: 'STEVEDORING',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 125000,
                tier_2: 132000,
                tier_3: 136000,
                tier_4: 140000,
                tier_5: 144000,
                tier_6: 148000,
                tier_7: 152000
            }
        },
        {
            id: 'srv_hai_quan',
            code: 'HAI_QUAN',
            name: 'Phí khai hải quan hàng xuất',
            unit: 'Tấn',
            contractRef: 'Hợp đồng số 01-2026/GW-TVPL và Phụ lục số 2',
            category: 'CUSTOMS',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 3500,
                tier_2: 3500,
                tier_3: 3500,
                tier_4: 3500,
                tier_5: 3500,
                tier_6: 3500,
                tier_7: 3500
            }
        },
        {
            id: 'srv_luu_salan',
            code: 'LUU_SALAN',
            name: 'Phí lưu phương tiện',
            unit: 'VNĐ',
            contractRef: 'LƯU SÀ LAN',
            category: 'DEMURRAGE',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 0,
                tier_2: 0,
                tier_3: 0,
                tier_4: 0,
                tier_5: 0,
                tier_6: 0,
                tier_7: 0
            }
        },
        // Trucking routes
        {
            id: 'truck_binh_phuoc',
            code: 'TRUCK_BINH_PHUOC',
            name: 'Phí vận chuyển hàng gỗ viên nén từ các kho Phường Bình Phước về Cảng Nguyên Ngọc.',
            subTitle: 'Kho Green Wood / Hòa Bình',
            unit: 'Tấn',
            contractRef: 'Phụ lục 3 và Phụ lục 4 - Hợp đồng số 01-2026/GW-TVPL',
            category: 'TRUCKING',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 128000,
                tier_2: 137600,
                tier_3: 147200,
                tier_4: 156800,
                tier_5: 166400,
                tier_6: 176000,
                tier_7: 185600
            }
        },
        {
            id: 'truck_tan_hiep',
            code: 'TRUCK_TAN_HIEP',
            name: 'Phí vận chuyển hàng gỗ viên nén từ các kho Phường Tân Hiệp về Cảng Nguyên Ngọc.',
            subTitle: 'Kho Bảo, Hùng, Minh, Linh, Hào, Nguyễn Huy, Quỳnh Anh...',
            unit: 'Tấn',
            contractRef: 'Phụ lục 3 và Phụ lục 4 - Hợp đồng số 01-2026/GW-TVPL',
            category: 'TRUCKING',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 100000,
                tier_2: 107500,
                tier_3: 115000,
                tier_4: 122500,
                tier_5: 130000,
                tier_6: 137500,
                tier_7: 145000
            }
        },
        {
            id: 'truck_tan_khanh',
            code: 'TRUCK_TAN_KHANH',
            name: 'Phí vận chuyển hàng gỗ viên nén từ các kho Phường Tân Khánh về Cảng Nguyên Ngọc.',
            subTitle: 'Kho Cúc, Ngọc, Năng Lượng Tương Lai...',
            unit: 'Tấn',
            contractRef: 'Phụ lục 3 và Phụ lục 4 - Hợp đồng số 01-2026/GW-TVPL',
            category: 'TRUCKING',
            defaultEnabled: true,
            tierPrices: {
                tier_1: 100000,
                tier_2: 107500,
                tier_3: 115000,
                tier_4: 122500,
                tier_5: 130000,
                tier_6: 137500,
                tier_7: 145000
            }
        }
    ]
};

/**
 * Phân tích chuỗi ngày giờ linh hoạt (ISO, date string, excel timestamp).
 */
export function parseDateTimeFlexible(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val;
    }
    const str = String(val).trim();
    if (!str || str === '-') return null;

    // Check ISO format YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm
    if (str.includes('-')) {
        const d = new Date(str.replace(' ', 'T'));
        if (!isNaN(d.getTime())) return d;
    }

    // Check DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1]!, 10);
        const month = parseInt(dmyMatch[2]!, 10) - 1;
        const year = parseInt(dmyMatch[3]!, 10);
        const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
        const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
        const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
        const d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) return d;
    }

    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Tính số ngày lưu sà lan và thành tiền theo quy tắc cảng biển:
 * - Tổng ngày = ROUND((ngày rời - ngày đến), 1)
 * - Vượt lưu thô = Tổng ngày - 7
 * - Làm tròn: <= 0 -> 0; > 0: phần lẻ <= 0.5 cộng 0.5, > 0.5 cộng 1.0.
 * - Thành tiền = Số ngày làm tròn * đơn giá * khối lượng thực giao (tấn).
 */
export function calculateBargeDemurrage(
    arrivalRaw: any,
    departureRaw: any,
    dischargedTons: number,
    freeDays = 7,
    ratePerTonDay = 3000
): {
    totalDays: number;
    freeDays: number;
    excessDaysRaw: number;
    excessDaysRounded: number;
    amount: number;
} {
    const arr = parseDateTimeFlexible(arrivalRaw);
    const dep = parseDateTimeFlexible(departureRaw);

    if (!arr || !dep || dep.getTime() < arr.getTime()) {
        return {
            totalDays: 0,
            freeDays,
            excessDaysRaw: 0,
            excessDaysRounded: 0,
            amount: 0
        };
    }

    const diffMs = dep.getTime() - arr.getTime();
    const diffDaysFloat = diffMs / (1000 * 60 * 60 * 24);
    // Excel formula: ROUND(C16-B16, 1)
    const totalDays = Math.round(diffDaysFloat * 10) / 10;

    const excessDaysRaw = Math.round((totalDays - freeDays) * 10) / 10;

    let excessDaysRounded = 0;
    if (excessDaysRaw > 0) {
        const intPart = Math.floor(excessDaysRaw);
        const frac = Math.round((excessDaysRaw - intPart) * 10) / 10;
        if (frac === 0) {
            excessDaysRounded = intPart;
        } else if (frac <= 0.5) {
            excessDaysRounded = intPart + 0.5;
        } else {
            excessDaysRounded = intPart + 1.0;
        }
    }

    const amount = excessDaysRounded > 0
        ? Math.round(excessDaysRounded * ratePerTonDay * dischargedTons)
        : 0;

    return {
        totalDays,
        freeDays,
        excessDaysRaw,
        excessDaysRounded,
        amount
    };
}

/**
 * Tính giá dầu bình quân từ nhật ký giá DO từng ngày.
 */
export function calculateAverageFuelPrice(prices: DailyFuelPrice[]): number {
    if (!prices || prices.length === 0) return 0;
    const valid = prices.filter(p => typeof p.price === 'number' && p.price > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, p) => acc + p.price, 0);
    return Math.round(sum / valid.length);
}

/**
 * Xác định bậc giá dầu tương ứng với giá bình quân.
 */
export function resolveFuelTier(avgPrice: number, tiers = DEFAULT_FUEL_TIERS): FuelTier {
    if (avgPrice <= 0) return tiers[2] || tiers[0]!; // Mặc định bậc 25,001 - 30,000
    for (const t of tiers) {
        if (t.minPrice === 0 && avgPrice <= t.maxPrice) return t;
        if (avgPrice >= t.minPrice && avgPrice <= t.maxPrice) return t;
    }
    return tiers[tiers.length - 1]!;
}

/**
 * Phân loại các phiếu cân của tàu thành 3 luồng:
 * - EXPORT: Xe xuất từ kho ra sà lan
 * - DIRECT: Xe từ nhà máy xuất thẳng xuống sà lan tại cảng
 * - TRUCK: Xe vận chuyển đường bộ từ nhà máy/kho vệ tinh về cảng
 */
export function splitTicketsByFlowType(allTickets: any[]): SettlementTicketFlows {
    const exportWarehouseTickets: any[] = [];
    const directBargeTickets: any[] = [];
    const truckRoadTickets: any[] = [];

    if (!Array.isArray(allTickets)) {
        return { exportWarehouseTickets, directBargeTickets, truckRoadTickets };
    }

    for (const t of allTickets) {
        const flow = String(t.flowType || t.flow_type || '').toUpperCase();
        const note = String(t.note || t.sourceOrRemark || '').toUpperCase();
        const yard = String(t.yard || t.originWarehouseName || '').toUpperCase();

        if (flow === 'EXPORT' || note.includes('XUẤT KHO') || yard.includes('KHO')) {
            exportWarehouseTickets.push(t);
        } else if (flow === 'DIRECT' || note.includes('XÁ THẲNG') || note.includes('SÀ LAN')) {
            directBargeTickets.push(t);
        } else {
            truckRoadTickets.push(t);
        }
    }

    return { exportWarehouseTickets, directBargeTickets, truckRoadTickets };
}

/**
 * Lập tổng hợp quyết toán (SettlementSummary) cho chuyến tàu.
 */
export function computeSettlementSummary(params: {
    vesselName: string;
    contract?: SettlementContract;
    fuelTierId?: string;
    dailyFuelPrices?: DailyFuelPrice[];
    barges: Array<{
        bargeId: number;
        bargeName: string;
        arrivalTime: string;
        departureTime: string;
        dischargedTons: number;
        area?: string;
    }>;
    serviceSelections?: Record<string, { enabled?: boolean; customPrice?: number; customQuantity?: number }>;
    startingTime?: string;
    endingTime?: string;
    totalExportWarehouseTons?: number;
    totalDirectBargeTons?: number;
    totalCustomsTons?: number;
    truckingDetails?: Array<{
        serviceId: string;
        quantityTons: number;
    }>;
}): SettlementSummary {
    const contract = params.contract || DEFAULT_GREEN_WOOD_CONTRACT;
    const dailyPrices = params.dailyFuelPrices && params.dailyFuelPrices.length > 0
        ? params.dailyFuelPrices
        : [
            { date: '2026-10-19', price: 28800 },
            { date: '2026-10-20', price: 28800 },
            { date: '2026-10-21', price: 28800 },
            { date: '2026-10-22', price: 29250 },
            { date: '2026-10-23', price: 29250 },
            { date: '2026-10-24', price: 29250 },
            { date: '2026-10-25', price: 29250 },
            { date: '2026-10-26', price: 29250 },
            { date: '2026-10-27', price: 29250 },
            { date: '2026-10-28', price: 29250 },
            { date: '2026-10-29', price: 30240 },
            { date: '2026-10-30', price: 30240 }
        ];

    const avgFuel = calculateAverageFuelPrice(dailyPrices);
    const resolvedTier = params.fuelTierId
        ? (contract.fuelTiers.find(t => t.id === params.fuelTierId) || resolveFuelTier(avgFuel, contract.fuelTiers))
        : resolveFuelTier(avgFuel, contract.fuelTiers);

    // Tính toán bảng sà lan lưu neo
    const demurrageItems: BargeDemurrageItem[] = params.barges.map(b => {
        const res = calculateBargeDemurrage(
            b.arrivalTime,
            b.departureTime,
            b.dischargedTons,
            contract.freeDemurrageDays,
            contract.demurrageRatePerTonDay
        );
        return {
            bargeId: b.bargeId,
            bargeName: b.bargeName,
            arrivalTime: b.arrivalTime,
            departureTime: b.departureTime,
            receivedTons: b.dischargedTons,
            dischargedTons: b.dischargedTons,
            totalDays: res.totalDays,
            freeDays: res.freeDays,
            excessDaysRaw: res.excessDaysRaw,
            excessDaysRounded: res.excessDaysRounded,
            ratePerTonDay: contract.demurrageRatePerTonDay,
            amount: res.amount,
            area: b.area || 'Nguyên Ngọc'
        };
    });

    const totalDemurrageFee = demurrageItems.reduce((acc, b) => acc + b.amount, 0);

    // Xây dựng DNTT 1
    const itemsDntt1: DebitNoteLineItem[] = [];
    let stt1 = 1;

    for (const srv of contract.services) {
        if (srv.category === 'TRUCKING') continue;

        const sel = params.serviceSelections?.[srv.id];
        const isEnabled = sel?.enabled !== undefined ? sel.enabled : (srv.defaultEnabled !== false);

        let qty = 0;
        let unitPrice = sel?.customPrice !== undefined ? sel.customPrice : (srv.tierPrices[resolvedTier.id] || 0);

        if (srv.code === 'XUAT_KHO_NHA_BE') {
            qty = sel?.customQuantity !== undefined ? sel.customQuantity : (params.totalExportWarehouseTons || 0);
        } else if (srv.code === 'XE_SALAN_NHA_BE') {
            qty = sel?.customQuantity !== undefined ? sel.customQuantity : (params.totalDirectBargeTons || 0);
        } else if (srv.code === 'HAI_QUAN') {
            qty = sel?.customQuantity !== undefined ? sel.customQuantity : (params.totalCustomsTons || (params.totalExportWarehouseTons || 0) + (params.totalDirectBargeTons || 0));
        } else if (srv.code === 'LUU_SALAN') {
            qty = 1;
            unitPrice = totalDemurrageFee;
        }

        const amount = Math.round(qty * unitPrice);

        itemsDntt1.push({
            id: srv.id,
            stt: stt1++,
            serviceName: srv.name,
            subTitle: srv.subTitle,
            unit: srv.unit,
            quantity: qty,
            unitPrice: srv.code === 'LUU_SALAN' ? 0 : unitPrice,
            amount: srv.code === 'LUU_SALAN' ? totalDemurrageFee : amount,
            fuelTierLabel: resolvedTier.label,
            contractRef: srv.contractRef,
            enabled: isEnabled
        });
    }

    const subTotalDntt1 = itemsDntt1.filter(i => i.enabled).reduce((acc, i) => acc + i.amount, 0);
    const vatAmountDntt1 = Math.round(subTotalDntt1 * contract.vatRate);
    const totalAmountDntt1 = subTotalDntt1 + vatAmountDntt1;

    // Xây dựng DNTT 2 (Road trucking)
    const itemsDntt2: DebitNoteLineItem[] = [];
    let stt2 = 1;

    for (const srv of contract.services) {
        if (srv.category !== 'TRUCKING') continue;

        const sel = params.serviceSelections?.[srv.id];
        const isEnabled = sel?.enabled !== undefined ? sel.enabled : true;

        const truckDetail = params.truckingDetails?.find(td => td.serviceId === srv.id);
        const qty = sel?.customQuantity !== undefined ? sel.customQuantity : (truckDetail?.quantityTons || 0);
        const unitPrice = sel?.customPrice !== undefined ? sel.customPrice : (srv.tierPrices[resolvedTier.id] || 0);
        const amount = Math.round(qty * unitPrice);

        itemsDntt2.push({
            id: srv.id,
            stt: stt2++,
            serviceName: srv.name,
            subTitle: srv.subTitle,
            unit: srv.unit,
            quantity: qty,
            unitPrice,
            amount,
            fuelTierLabel: resolvedTier.label,
            contractRef: srv.contractRef,
            enabled: isEnabled
        });
    }

    const subTotalDntt2 = itemsDntt2.filter(i => i.enabled).reduce((acc, i) => acc + i.amount, 0);
    const vatAmountDntt2 = Math.round(subTotalDntt2 * contract.vatRate);
    const totalAmountDntt2 = subTotalDntt2 + vatAmountDntt2;

    return {
        vesselName: params.vesselName,
        customerName: contract.customerName,
        cargoName: contract.cargoName,
        agreementNo: contract.agreementNo,
        serviceOrderNo: `${contract.serviceOrderPrefix || 'SO261014'}012`,
        startingTime: params.startingTime || '2026-10-19',
        endingTime: params.endingTime || '2026-10-30',
        fuelTier: resolvedTier,
        dailyFuelPrices: dailyPrices,
        averageFuelPrice: avgFuel,
        barges: demurrageItems,
        itemsDntt1,
        itemsDntt2,
        vatRate: contract.vatRate,
        subTotalDntt1,
        vatAmountDntt1,
        totalAmountDntt1,
        amountInWordsViDntt1: numberToVietnameseWords(totalAmountDntt1),
        amountInWordsEnDntt1: numberToEnglishWords(totalAmountDntt1),
        subTotalDntt2,
        vatAmountDntt2,
        totalAmountDntt2,
        amountInWordsViDntt2: numberToVietnameseWords(totalAmountDntt2),
        amountInWordsEnDntt2: numberToEnglishWords(totalAmountDntt2),
        beneficiaryInfo: contract.beneficiaryInfo
    };
}
