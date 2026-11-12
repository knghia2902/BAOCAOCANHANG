export interface FuelTier {
    id: string;
    label: string; // ví dụ: "< 20,000", "20,000 - 25,000", "25,001 - 30,000", "30,001 - 35,000", "35,001 - 40,000", "40,001 - 45,000", "45,001 - 50,000"
    minPrice: number;
    maxPrice: number;
}

export type ServiceCategory = 'STEVEDORING' | 'TRUCKING' | 'CUSTOMS' | 'DEMURRAGE' | 'OTHER';

export interface ContractServiceItem {
    id: string;
    code: string;
    name: string; // Tên hiển thị dòng chính
    subTitle?: string; // Ghi chú dòng phụ (VD: Kho Nguyên Ngọc - Sà lan - Phao Nhà Bè - Tàu biển sử dụng CẨU TÀU)
    unit: string; // Tấn, VNĐ...
    contractRef: string; // VD: "Hợp đồng số 01-2026/GW-TVPL và Phụ lục số 2"
    category: ServiceCategory;
    tierPrices: Record<string, number>; // fuelTierId -> đơn giá VND
    defaultEnabled?: boolean;
}

export interface SettlementBeneficiaryInfo {
    name: string;
    accountNo: string;
    bank: string;
}

export interface SettlementContract {
    id: string;
    customerName: string;
    cargoName: string;
    agreementNo: string;
    serviceOrderPrefix?: string;
    fuelTiers: FuelTier[];
    services: ContractServiceItem[];
    freeDemurrageDays: number; // Mặc định 7 ngày
    demurrageRatePerTonDay: number; // Mặc định 3,000 đ/tấn/ngày
    vatRate: number; // Mặc định 0.08 (8%)
    beneficiaryInfo: SettlementBeneficiaryInfo;
}

export interface BargeDemurrageItem {
    bargeId: number;
    bargeName: string;
    arrivalTime: string; // Ngày giờ đến cảng YYYY-MM-DDTHH:mm (do người dùng nhập/chỉnh)
    departureTime: string; // Ngày giờ rời phao YYYY-MM-DDTHH:mm (do người dùng nhập/chỉnh)
    receivedTons: number; // Khối lượng thực nhận (tấn)
    dischargedTons: number; // Khối lượng thực giao (tấn)
    totalDays: number; // Tổng ngày thực hiện = ROUND(departure - arrival, 1)
    freeDays: number; // Số ngày lưu cơ bản (7)
    excessDaysRaw: number; // Số ngày vượt lưu thô = totalDays - freeDays
    excessDaysRounded: number; // Số ngày vượt lưu làm tròn (nấc 0.5 ngày hoặc 1 ngày)
    ratePerTonDay: number; // Đơn giá 3,000 đ/tấn/ngày
    amount: number; // Thành tiền = excessDaysRounded * ratePerTonDay * dischargedTons
    area: string; // Khu vực (ví dụ: "Nguyên Ngọc")
}

export interface DailyFuelPrice {
    date: string; // YYYY-MM-DD
    price: number;
}

export interface DebitNoteLineItem {
    id: string;
    stt: number;
    serviceName: string;
    subTitle?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    fuelTierLabel: string;
    contractRef?: string;
    enabled: boolean;
}

export interface SettlementSummary {
    vesselName: string;
    customerName: string;
    cargoName: string;
    agreementNo: string;
    serviceOrderNo: string;
    startingTime: string;
    endingTime: string;
    fuelTier: FuelTier;
    dailyFuelPrices: DailyFuelPrice[];
    averageFuelPrice: number;
    barges: BargeDemurrageItem[];
    itemsDntt1: DebitNoteLineItem[];
    itemsDntt2: DebitNoteLineItem[];
    vatRate: number;
    subTotalDntt1: number;
    vatAmountDntt1: number;
    totalAmountDntt1: number;
    amountInWordsViDntt1: string;
    amountInWordsEnDntt1: string;
    subTotalDntt2: number;
    vatAmountDntt2: number;
    totalAmountDntt2: number;
    amountInWordsViDntt2: string;
    amountInWordsEnDntt2: string;
    beneficiaryInfo: SettlementBeneficiaryInfo;
}

export interface SettlementTicketFlows {
    exportWarehouseTickets: any[]; // Xuất kho ra sà lan
    directBargeTickets: any[]; // Xe sang sà lan trực tiếp
    truckRoadTickets: any[]; // Xe chở về cảng
}
