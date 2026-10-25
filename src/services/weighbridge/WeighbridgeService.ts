import { supabase } from '@/supabase';
import { dbContext } from '@/services/storage/DBContext';

export interface Vessel {
    id: number;
    name: string;
    created_at?: string;
    barges?: Barge[];
    status?: 'in_progress' | 'done';
    customer?: string; // Tên khách hàng / Chủ hàng
    cargo_type?: string; // Loại hàng hóa
    cargo_code?: string; // Mã hàng hóa
}

export interface MasterCargoItem {
    name: string;
    code: string;
}

export interface WeighbridgeMasterData {
    customers: string[];
    goods: MasterCargoItem[];
}

export const DEFAULT_MASTER_DATA: WeighbridgeMasterData = {
    customers: [
        'CÔNG TY TNHH DE HEUS',
        'CÔNG TY CỔ PHẦN CHĂN NUÔI C.P. VIỆT NAM',
        'CÔNG TY TNHH CARGILL VIỆT NAM',
        'CÔNG TY TNHH CJ VINA AGRI',
        'CÔNG TY CỔ PHẦN JAPFA COMFEED VIỆT NAM',
        'CÔNG TY TNHH SUNJIN VINA',
        'CÔNG TY CỔ PHẦN GREENFEED VIỆT NAM',
        'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC'
    ],
    goods: [
        { name: 'BẮP HẠT', code: 'BH' },
        { name: 'BÃ ĐẬU NÀNH', code: 'BDN' },
        { name: 'LÚA MÌ', code: 'LM' },
        { name: 'CÁM MÌ', code: 'CM' },
        { name: 'BÃ HẠT CẢI', code: 'BHC' },
        { name: 'BỘT MÌ', code: 'BM' },
        { name: 'CÁM GẠO', code: 'CG' },
        { name: 'BÃ RƯỢU DDGS', code: 'DDGS' },
        { name: 'KHÔ ĐẬU TƯƠNG', code: 'KDT' }
    ]
};

export interface WeighbridgeStandardTemplate {
    printFields: CustomFieldConfig[];
    printElements: PrintElement[];
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    ticketTitle: string;
    signatures: string[];
    updatedAt: number;
}

export const getDefaultPrintFields = (): CustomFieldConfig[] => [
    { id: 'plateNumber', label: 'Số xe', visible: true, column: 'left', order: 1 },
    { id: 'goods', label: 'Hàng hóa', visible: true, column: 'left', order: 2 },
    { id: 'owner', label: 'Tên chủ hàng', visible: true, column: 'left', order: 3 },
    { id: 'weight1', label: 'Trọng lượng lần 1', visible: true, column: 'left', order: 4 },
    { id: 'weight2', label: 'Trọng lượng lần 2', visible: true, column: 'left', order: 5 },
    { id: 'weightNet', label: 'Trọng lượng hàng', visible: true, column: 'left', order: 6 },
    { id: 'words', label: 'Bằng chữ', visible: true, column: 'left', order: 7 },
    { id: 'barge', label: 'Sà lan', visible: true, column: 'left', order: 8 },
    { id: 'note', label: 'Ghi chú', visible: true, column: 'left', order: 9 },
    
    { id: 'driver', label: 'Tài xế', visible: true, column: 'right', order: 1 },
    { id: 'goodsCode', label: 'Mã hàng', visible: true, column: 'right', order: 2 },
    { id: 'xn', label: 'X/N', visible: true, column: 'right', order: 3 },
    { id: 'chinhpham', label: '*Chính phẩm', visible: true, column: 'right', order: 4 },
    { id: 'phupham', label: '*Phụ phẩm', visible: true, column: 'right', order: 5 },
    { id: 'ketluan', label: 'Kết luận', visible: true, column: 'right', order: 6 }
];

export const getDefaultPrintElements = (): PrintElement[] => [
    { id: 'companyName', type: 'text', x: 9, y: 18, width: 140, height: 5, text: 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC', fontSize: 13, fontWeight: 'bold' },
    { id: 'companyAddress', type: 'text', x: 9, y: 25, width: 150, height: 4, text: 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam', fontSize: 10, fontWeight: 'normal' },
    { id: 'companyPhone', type: 'text', x: 9, y: 30.5, width: 140, height: 4, text: 'ĐT: 0964 258 671 / Fax:', fontSize: 10, fontWeight: 'normal' },
    { id: 'ticketNo', type: 'field', x: 145.5, y: 34.5, width: 45, height: 5, label: 'Phiếu số', fieldId: 'ticketNo', labelWidth: 15, fontSize: 10, fontWeight: 'normal' },
    { id: 'title', type: 'text', x: 0, y: 38, width: 198.5, height: 9.5, text: 'PHIẾU CÂN XE', fontSize: 24, fontWeight: 'bold', align: 'center' },
    { id: 'dateIn', type: 'field', x: 60, y: 49, width: 75, height: 4, label: 'Ngày, giờ vào', fieldId: 'dateIn', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    { id: 'dateOut', type: 'field', x: 60, y: 54.5, width: 75, height: 4, label: 'Ngày, giờ ra', fieldId: 'dateOut', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    
    // Left Column Fields
    { id: 'plateNumber', type: 'field', x: 9, y: 61.5, width: 85, height: 5, label: 'Số xe', fieldId: 'plateNumber', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'goods', type: 'field', x: 9, y: 66.5, width: 85, height: 5, label: 'Hàng hóa', fieldId: 'goods', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'owner', type: 'field', x: 9, y: 73, width: 100.5, height: 5, label: 'Tên chủ hàng', fieldId: 'owner', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'weight1', type: 'field', x: 9, y: 79, width: 85, height: 5, label: 'Trọng lượng lần 1', fieldId: 'weight1', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'weight2', type: 'field', x: 9, y: 85.5, width: 85, height: 5, label: 'Trọng lượng lần 2', fieldId: 'weight2', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'weightNet', type: 'field', x: 9, y: 92.5, width: 85, height: 5, label: 'Trọng lượng hàng', fieldId: 'weightNet', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'words', type: 'field', x: 9, y: 97.5, width: 100, height: 8.5, label: 'Bằng chữ', fieldId: 'words', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'barge', type: 'field', x: 9, y: 106, width: 85, height: 5, label: 'Sà lan', fieldId: 'barge', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },
    
    // Right Column Fields
    { id: 'driver', type: 'field', x: 80.5, y: 61.5, width: 85, height: 5, label: 'Tài xế', fieldId: 'driver', labelWidth: 11, fontSize: 10, fontWeight: 'normal' },
    { id: 'goodsCode', type: 'field', x: 114.5, y: 66.5, width: 85, height: 5, label: 'Mã hàng', fieldId: 'goodsCode', labelWidth: 15.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'xn', type: 'field', x: 114.5, y: 73, width: 85, height: 5, label: 'X/N', fieldId: 'xn', labelWidth: 15.5, fontSize: 10, fontWeight: 'normal' },
    { id: 'qualityHeader', type: 'text', x: 114.5, y: 79, width: 85, height: 4, text: 'ĐÁNH GIÁ CHẤT LƯỢNG HÀNG HÓA', fontSize: 10, fontWeight: 'normal' },
    { id: 'chinhpham', type: 'field', x: 114.5, y: 85.5, width: 85, height: 5, label: '*Chính phẩm', fieldId: 'chinhpham', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    { id: 'phupham', type: 'field', x: 114.5, y: 91.5, width: 85, height: 5, label: '*Phụ phẩm', fieldId: 'phupham', labelWidth: 24, fontSize: 10, fontWeight: 'normal' },
    { id: 'ketluan', type: 'field', x: 116, y: 97.5, width: 85, height: 11.5, label: 'Kết luận', fieldId: 'ketluan', labelWidth: 22.5, fontSize: 10, fontWeight: 'normal' },
    
    // Note Field
    { id: 'field_note_1782290495031', type: 'field', x: 9, y: 111, width: 80, height: 5, label: 'Ghi chú', fieldId: 'note', labelWidth: 33.5, fontSize: 10, fontWeight: 'normal' },

    // Footer
    { id: 'sig1', type: 'text', x: 18.5, y: 118, width: 30, height: 4, text: 'NV TRẠM CÂN', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig1_name', type: 'field', x: 18.5, y: 133, width: 30, height: 4, label: '', fieldId: 'operator', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig2', type: 'text', x: 60, y: 118, width: 25, height: 4, text: 'BẢO VỆ', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig3', type: 'text', x: 86, y: 118, width: 25, height: 4, text: 'CHỦ HÀNG', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig4', type: 'text', x: 116, y: 118, width: 25, height: 4, text: 'THỦ KHO', align: 'center', fontSize: 10, fontWeight: 'bold' },
    { id: 'sig5', type: 'text', x: 141, y: 118, width: 20, height: 4, text: 'TÀI XẾ', align: 'center', fontSize: 10, fontWeight: 'bold' }
];

export interface CustomFieldConfig {
    id: string;
    label: string;
    visible: boolean;
    column: 'left' | 'right';
    order: number;
}

export interface PrintElement {
    id: string;
    type: 'text' | 'field' | 'line' | 'rect';
    x: number; // in mm
    y: number; // in mm
    width: number; // in mm
    height: number; // in mm
    text?: string;
    label?: string; // (for type='field')
    fieldId?: string;
    labelWidth?: number; // in mm (for type='field')
    fontSize?: number; // in pt
    fontWeight?: 'normal' | 'bold' | 'black';
    fontStyle?: 'normal' | 'italic';
    align?: 'left' | 'center' | 'right';
    borderStyle?: 'solid' | 'dashed' | 'double';
}

export interface BargeConfig {
    [key: string]: any;
    goods: string;
    goodsCode: string;
    owner: string;
    operator: string;
    xn: string;
    ticketPrefix: string;
    ticketSeed: string | number;
    chinhpham: number | string;
    phupham: number | string;
    ketluan: string;
    locked?: boolean;
    orderNo?: string;
    printFields?: CustomFieldConfig[];
    printElements?: PrintElement[];
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    ticketTitle?: string;
    signatures?: string[];
    goodsList?: string[];
    updatedAt?: number;
    // Hồ sơ phương tiện (NNP QL HỒ SƠ PHƯƠNG TIỆN CẢNG)
    tonnage?: number;
    hp?: number;
    gcnNo?: string;
    gcnIssuedDate?: string;
    gcnExpiryDate?: string;
    dkNo?: string;
    dkIssuedDate?: string;
    dkExpiryDate?: string;
    bhNo?: string;
    bhIssuedDate?: string;
    bhExpiryDate?: string;
    // Crew & Movement details
    captain?: string;
    captainGrade?: string;
    captainCccd?: string;
    chiefEngineer?: string;
    chiefEngineerGrade?: string;
    chiefEngineerCccd?: string;
    sailors?: string;
    sailorsCccd?: string;
    hasCrewBook?: boolean;
    arrivalTime?: string;
    departureTime?: string;
    lastPort?: string;
}

export interface Barge {
    id: number;
    vessel_id: number;
    name: string;
    config: BargeConfig;
    created_at?: string;
    trucks?: Truck[];
    order_no?: string;
    goods?: string;
    goods_code?: string;
    owner?: string;
    operator?: string;
    tonnage?: number;
    hp?: number;
    gcn_no?: string;
    gcn_expiry_date?: string;
    dk_no?: string;
    bh_no?: string;
    bh_expiry_date?: string;
    captain?: string;
    chief_engineer?: string;
    arrival_time?: string;
    departure_time?: string;
}

export interface Truck {
    id: number;
    barge_id: number;
    ticketNo: string;
    plateNumber: string;
    driver: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    dateIn: string;
    dateOut: string;
    note: string;
    created_at?: string;
    sourceTicketNo?: string; // Original CSV ticketNo used for sync dedup (not persisted to DB)
}

// Local IndexedDB cache helpers
async function getLocalVessels(): Promise<Vessel[]> {
    const list = (await dbContext.get<Vessel[]>('wb_vessels')) || [];
    return list.map(v => ({
        ...v,
        status: v.status || 'in_progress',
        customer: v.customer || '',
        cargo_type: v.cargo_type || '',
        cargo_code: v.cargo_code || ''
    }));
}

async function saveLocalVessels(vessels: Vessel[]) {
    await dbContext.set('wb_vessels', vessels);
}

export const WeighbridgeService = {
    /**
     * Get Master Data (customers and cargo goods)
     */
    async getMasterData(): Promise<WeighbridgeMasterData> {
        try {
            const cached = await dbContext.get<WeighbridgeMasterData>('weighbridge_master_data');
            
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();
                
            if (!error && data?.settings?.weighbridge_master_data) {
                const remote = data.settings.weighbridge_master_data as WeighbridgeMasterData;
                await dbContext.set('weighbridge_master_data', remote);
                return remote;
            }

            if (cached && (cached.customers?.length || cached.goods?.length)) {
                return cached;
            }

            return DEFAULT_MASTER_DATA;
        } catch (e) {
            console.warn('Error fetching master data:', e);
            const cached = await dbContext.get<WeighbridgeMasterData>('weighbridge_master_data');
            return cached || DEFAULT_MASTER_DATA;
        }
    },

    /**
     * Save Master Data (customers and cargo goods)
     */
    async saveMasterData(masterData: WeighbridgeMasterData): Promise<boolean> {
        try {
            await dbContext.set('weighbridge_master_data', masterData);
            try {
                localStorage.setItem('weighbridge_master_data', JSON.stringify(masterData));
            } catch (_) {}

            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();

            if (!fetchError && current?.settings) {
                const newSettings = {
                    ...current.settings,
                    weighbridge_master_data: masterData
                };
                await supabase
                    .from('content')
                    .update({ settings: newSettings })
                    .eq('id', 'main');
            }
            return true;
        } catch (e) {
            console.error('Error saving master data:', e);
            return false;
        }
    },

    /**
     * Get Global Standard Weigh Ticket Template
     */
    async getGlobalTicketTemplate(): Promise<WeighbridgeStandardTemplate> {
        try {
            const cached = await dbContext.get<WeighbridgeStandardTemplate>('weighbridge_standard_template');
            
            const { data, error } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();

            if (!error && data?.settings?.weighbridge_standard_template) {
                const remote = data.settings.weighbridge_standard_template as WeighbridgeStandardTemplate;
                await dbContext.set('weighbridge_standard_template', remote);
                return remote;
            }

            if (cached && cached.printElements?.length) {
                return cached;
            }

            let savedElements: any = null;
            let savedDetails: any = null;
            try {
                const strEl = localStorage.getItem('weighbridge_default_layout');
                if (strEl) savedElements = JSON.parse(strEl);
                const strDet = localStorage.getItem('weighbridge_default_company_details');
                if (strDet) savedDetails = JSON.parse(strDet);
            } catch (_) {}

            return {
                printFields: getDefaultPrintFields(),
                printElements: savedElements || getDefaultPrintElements(),
                companyName: savedDetails?.companyName || 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC',
                companyAddress: savedDetails?.companyAddress || 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam',
                companyPhone: savedDetails?.companyPhone || 'ĐT: 0964 258 671 / Fax:',
                ticketTitle: savedDetails?.ticketTitle || 'PHIẾU CÂN XE',
                signatures: savedDetails?.signatures || ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'],
                updatedAt: Date.now()
            };
        } catch (e) {
            console.warn('Error fetching global ticket template:', e);
            return {
                printFields: getDefaultPrintFields(),
                printElements: getDefaultPrintElements(),
                companyName: 'CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC',
                companyAddress: 'Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam',
                companyPhone: 'ĐT: 0964 258 671 / Fax:',
                ticketTitle: 'PHIẾU CÂN XE',
                signatures: ['NV TRẠM CÂN', 'BẢO VỆ', 'CHỦ HÀNG', 'THỦ KHO', 'TÀI XẾ'],
                updatedAt: Date.now()
            };
        }
    },

    /**
     * Save Global Standard Weigh Ticket Template
     */
    async saveGlobalTicketTemplate(template: WeighbridgeStandardTemplate): Promise<boolean> {
        try {
            template.updatedAt = Date.now();
            await dbContext.set('weighbridge_standard_template', template);
            try {
                localStorage.setItem('weighbridge_default_layout', JSON.stringify(template.printElements));
                localStorage.setItem('weighbridge_default_company_details', JSON.stringify({
                    companyName: template.companyName,
                    companyAddress: template.companyAddress,
                    companyPhone: template.companyPhone,
                    ticketTitle: template.ticketTitle,
                    signatures: template.signatures
                }));
            } catch (_) {}

            const { data: current, error: fetchError } = await supabase
                .from('content')
                .select('settings')
                .eq('id', 'main')
                .single();

            if (!fetchError && current?.settings) {
                const newSettings = {
                    ...current.settings,
                    weighbridge_standard_template: template
                };
                await supabase
                    .from('content')
                    .update({ settings: newSettings })
                    .eq('id', 'main');
            }
            return true;
        } catch (e) {
            console.error('Error saving global ticket template:', e);
            return false;
        }
    },

    /**
     * Fetch all vessels along with their barges
     */
    async getVessels(): Promise<Vessel[]> {
        const local = await getLocalVessels();
        let localStatusMap: Record<string, 'in_progress' | 'done'> = {};
        try {
            localStatusMap = await dbContext.get<Record<string, 'in_progress' | 'done'>>('weighbridge_vessel_statuses') || {};
        } catch (_) {}

        try {
            const { data, error } = await supabase
                .from('weighbridge_vessels')
                .select('*, barges:weighbridge_barges(*)')
                .order('created_at', { ascending: true });

            if (error) {
                console.warn('Supabase fetch failed, loading local vessels:', error);
                return local;
            }

            const formatted = (data || []).map((vessel: any) => {
                const localVessel = local.find(v => String(v.id) === String(vessel.id));
                const resolvedCustomer = vessel.customer || localVessel?.customer || '';
                const resolvedCargoType = vessel.cargo_type || localVessel?.cargo_type || '';
                const resolvedCargoCode = vessel.cargo_code || localVessel?.cargo_code || '';

                const barges = (vessel.barges || []).map((remoteBarge: any) => {
                    // Search if local has a newer config
                    const localBarge = localVessel?.barges?.find(b => String(b.id) === String(remoteBarge.id));
                    if (localBarge && localBarge.config) {
                        const localTime = localBarge.config.updatedAt || 0;
                        const remoteTime = remoteBarge.config?.updatedAt || 0;
                        if (localTime > remoteTime) {
                            console.log(`Preserving newer local config for barge ${remoteBarge.name} (${remoteBarge.id})`);
                            // Sync local config back to Supabase in the background
                            WeighbridgeService.updateBargeConfig(remoteBarge.id, localBarge.config).catch(err => {
                                console.warn('Background sync config failed:', err);
                            });
                            const bargeConfig = { ...localBarge.config };
                            if (resolvedCustomer) bargeConfig.owner = resolvedCustomer;
                            if (resolvedCargoType) bargeConfig.goods = resolvedCargoType;
                            if (resolvedCargoCode) bargeConfig.goodsCode = resolvedCargoCode;
                            return {
                                ...remoteBarge,
                                config: bargeConfig
                            };
                        }
                    }

                    const mergedConfig = {
                        ...(remoteBarge.config || {}),
                        ...(remoteBarge.order_no ? { orderNo: remoteBarge.order_no } : {}),
                        ...(remoteBarge.goods ? { goods: remoteBarge.goods } : {}),
                        ...(remoteBarge.goods_code ? { goodsCode: remoteBarge.goods_code } : {}),
                        ...(remoteBarge.owner ? { owner: remoteBarge.owner } : {}),
                        ...(remoteBarge.operator ? { operator: remoteBarge.operator } : {}),
                        ...(remoteBarge.tonnage !== undefined && remoteBarge.tonnage !== null ? { tonnage: remoteBarge.tonnage } : {}),
                        ...(remoteBarge.hp !== undefined && remoteBarge.hp !== null ? { hp: remoteBarge.hp } : {}),
                        ...(remoteBarge.gcn_no ? { gcnNo: remoteBarge.gcn_no } : {}),
                        ...(remoteBarge.gcn_expiry_date ? { gcnExpiryDate: remoteBarge.gcn_expiry_date } : {}),
                        ...(remoteBarge.dk_no ? { dkNo: remoteBarge.dk_no } : {}),
                        ...(remoteBarge.bh_no ? { bhNo: remoteBarge.bh_no } : {}),
                        ...(remoteBarge.bh_expiry_date ? { bhExpiryDate: remoteBarge.bh_expiry_date } : {}),
                        ...(remoteBarge.captain ? { captain: remoteBarge.captain } : {}),
                        ...(remoteBarge.chief_engineer ? { chiefEngineer: remoteBarge.chief_engineer } : {}),
                        ...(remoteBarge.arrival_time ? { arrivalTime: remoteBarge.arrival_time } : {}),
                        ...(remoteBarge.departure_time ? { departureTime: remoteBarge.departure_time } : {})
                    };

                    // Enforce 100% inheritance from vessel
                    if (resolvedCustomer) mergedConfig.owner = resolvedCustomer;
                    if (resolvedCargoType) mergedConfig.goods = resolvedCargoType;
                    if (resolvedCargoCode) mergedConfig.goodsCode = resolvedCargoCode;

                    return {
                        ...remoteBarge,
                        config: mergedConfig
                    };
                }).sort((a: any, b: any) => {
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return dateA - dateB;
                });

                // Status priority:
                // 1. Direct column on weighbridge_vessels (if table column added)
                // 2. Local status map (IndexedDB persistent)
                // 3. Local cached vessel status
                // 4. Default 'in_progress'
                const resolvedStatus = (vessel.status as ('in_progress' | 'done') | undefined)
                    || localStatusMap[String(vessel.id)]
                    || localVessel?.status
                    || 'in_progress';

                return {
                    ...vessel,
                    status: resolvedStatus,
                    customer: resolvedCustomer,
                    cargo_type: resolvedCargoType,
                    cargo_code: resolvedCargoCode,
                    barges
                };
            });

            // Cache locally
            await saveLocalVessels(formatted);
            return formatted;
        } catch (e) {
            console.warn('Network offline or error fetching vessels, loading local vessels:', e);
            return await getLocalVessels();
        }
    },

    /**
     * Create a new vessel with optional master data fields
     */
    async createVessel(name: string, customer?: string, cargo_type?: string, cargo_code?: string): Promise<Vessel | null> {
        const newVessel: Vessel = {
            id: Date.now(),
            name: name.trim().toUpperCase(),
            status: 'in_progress',
            customer: customer?.trim() || '',
            cargo_type: cargo_type?.trim() || '',
            cargo_code: cargo_code?.trim() || '',
            barges: []
        };
        try {
            let { data, error } = await supabase
                .from('weighbridge_vessels')
                .insert([{ 
                    id: newVessel.id, 
                    name: newVessel.name, 
                    status: 'in_progress',
                    customer: newVessel.customer,
                    cargo_type: newVessel.cargo_type,
                    cargo_code: newVessel.cargo_code
                }])
                .select()
                .single();

            // If table does not have some columns, retry with minimal fields
            if (error) {
                const retry = await supabase
                    .from('weighbridge_vessels')
                    .insert([{ id: newVessel.id, name: newVessel.name }])
                    .select()
                    .single();
                data = retry.data;
                error = retry.error;
            }

            if (error) {
                console.warn('Supabase create vessel failed, saving locally:', error);
                const local = await getLocalVessels();
                local.push(newVessel);
                await saveLocalVessels(local);
                return newVessel;
            }
            const syncedVessel = { 
                ...data, 
                status: data?.status || 'in_progress',
                customer: data?.customer || newVessel.customer,
                cargo_type: data?.cargo_type || newVessel.cargo_type,
                cargo_code: data?.cargo_code || newVessel.cargo_code,
                barges: [] 
            };
            const local = await getLocalVessels();
            local.push(syncedVessel);
            await saveLocalVessels(local);
            return syncedVessel;
        } catch (e) {
            console.warn('Supabase offline, saving vessel locally:', e);
            const local = await getLocalVessels();
            local.push(newVessel);
            await saveLocalVessels(local);
            return newVessel;
        }
    },

    /**
     * Update vessel status ('in_progress' | 'done')
     */
    async updateVesselStatus(id: number, status: 'in_progress' | 'done'): Promise<boolean> {
        const local = await getLocalVessels();
        const vessel = local.find(v => String(v.id) === String(id));
        if (vessel) {
            vessel.status = status;
            await saveLocalVessels(local);
        }

        // Keep an isolated persistent status map in IndexedDB to survive any cache flushes
        try {
            const statusMap = await dbContext.get<Record<string, 'in_progress' | 'done'>>('weighbridge_vessel_statuses') || {};
            statusMap[String(id)] = status;
            await dbContext.set('weighbridge_vessel_statuses', statusMap);
        } catch (_) {}

        // Update weighbridge_vessels table directly in Supabase
        try {
            const { error } = await supabase
                .from('weighbridge_vessels')
                .update({ status })
                .eq('id', id);

            if (error) {
                console.warn('Supabase weighbridge_vessels.status update skipped/failed (schema column might be pending):', error.message || error);
            }
        } catch (e) {
            console.warn('Supabase offline or update failed:', e);
        }

        return true;
    },

    /**
     * Update vessel name and fixed cargo info
     */
    async updateVessel(id: number, updatesOrName: string | { name?: string; customer?: string; cargo_type?: string; cargo_code?: string }): Promise<boolean> {
        const payload: { name?: string; customer?: string; cargo_type?: string; cargo_code?: string } = 
            typeof updatesOrName === 'string' ? { name: updatesOrName.trim().toUpperCase() } : { ...updatesOrName };
            
        if (payload.name) payload.name = payload.name.trim().toUpperCase();

        const local = await getLocalVessels();
        const vessel = local.find(v => v.id === id);
        if (vessel) {
            if (payload.name !== undefined) vessel.name = payload.name;
            if (payload.customer !== undefined) vessel.customer = payload.customer;
            if (payload.cargo_type !== undefined) vessel.cargo_type = payload.cargo_type;
            if (payload.cargo_code !== undefined) vessel.cargo_code = payload.cargo_code;

            // Enforce on child barges locally
            if (vessel.barges) {
                for (const b of vessel.barges) {
                    if (b.config) {
                        if (vessel.customer) b.config.owner = vessel.customer;
                        if (vessel.cargo_type) b.config.goods = vessel.cargo_type;
                        if (vessel.cargo_code) b.config.goodsCode = vessel.cargo_code;
                    }
                }
            }
            await saveLocalVessels(local);
        }

        try {
            let { error } = await supabase
                .from('weighbridge_vessels')
                .update(payload)
                .eq('id', id);

            if (error) {
                // Retry with name only if columns don't exist yet
                const retryPayload: { name?: string } = {};
                if (payload.name) retryPayload.name = payload.name;
                const retry = await supabase
                    .from('weighbridge_vessels')
                    .update(retryPayload)
                    .eq('id', id);
                error = retry.error;
            }

            if (error) {
                console.warn('Supabase update vessel failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, updated vessel locally:', e);
            return true;
        }
    },

    /**
     * Delete a vessel
     */
    async deleteVessel(id: number): Promise<boolean> {
        const local = await getLocalVessels();
        const vessel = local.find(v => v.id === id);
        if (vessel) {
            if (vessel.barges) {
                for (const barge of vessel.barges) {
                    await dbContext.delete(`wb_trucks_${barge.id}`);
                }
            }
            const updated = local.filter(v => v.id !== id);
            await saveLocalVessels(updated);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_vessels')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete vessel failed, kept local deletion:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted vessel locally:', e);
            return true;
        }
    },

    /**
     * Create a new barge
     */
    async createBarge(vesselId: number, name: string, customOrderNo?: string): Promise<Barge | null> {
        const local = await getLocalVessels();

        let nextOrderNo = '';
        if (customOrderNo !== undefined) {
            nextOrderNo = customOrderNo;
        } else {
            // Calculate next orderNo sequentially based on max orderNo across all barges
            let maxNum = 0;
            for (const vessel of local) {
                if (vessel.barges) {
                    for (const barge of vessel.barges) {
                        const orderStr = barge.config?.orderNo || '';
                        const match = orderStr.match(/(\d+)$/);
                        if (match) {
                            const num = parseInt(match[1] || '', 10);
                            if (num > maxNum) {
                                maxNum = num;
                            }
                        } else {
                            const num = parseInt(orderStr, 10);
                            if (!isNaN(num) && num > maxNum) {
                                maxNum = num;
                            }
                        }
                    }
                }
            }
            nextOrderNo = String(maxNum + 1);
        }

        const defaultConfig: BargeConfig = {
            goods: '',
            goodsCode: '',
            owner: '',
            operator: '',
            xn: 'XUẤT KHẨU',
            ticketPrefix: 'PC-',
            ticketSeed: 1,
            chinhpham: '------------',
            phupham: '------------',
            ketluan: '[ ] Đạt\n[ ] Không đạt',
            orderNo: nextOrderNo,
            updatedAt: Date.now()
        };
        const newBarge: Barge = {
            id: Date.now(),
            vessel_id: vesselId,
            name: name.trim().toUpperCase(),
            config: defaultConfig,
            trucks: []
        };

        const vessel = local.find(v => v.id === vesselId);
        if (vessel) {
            if (!vessel.barges) vessel.barges = [];
            vessel.barges.push(newBarge);
            await saveLocalVessels(local);
        }

        try {
            const rowData: Record<string, any> = {
                id: newBarge.id,
                vessel_id: vesselId,
                name: newBarge.name,
                config: defaultConfig,
                order_no: nextOrderNo
            };

            let { data, error } = await supabase
                .from('weighbridge_barges')
                .insert([rowData])
                .select()
                .single();

            // If order_no column doesn't exist yet, retry with just config
            if (error && (error.code === 'PGRST204' || error.message?.includes('order_no'))) {
                const retry = await supabase
                    .from('weighbridge_barges')
                    .insert([{
                        id: newBarge.id,
                        vessel_id: vesselId,
                        name: newBarge.name,
                        config: defaultConfig
                    }])
                    .select()
                    .single();
                data = retry.data;
                error = retry.error;
            }

            if (error) {
                console.warn('Supabase create barge failed, saved locally:', error);
                return newBarge;
            }
            return { ...data, config: data.config || defaultConfig };
        } catch (e) {
            console.warn('Supabase offline, created barge locally:', e);
            return newBarge;
        }
    },

    /**
     * Update barge name
     */
    async updateBarge(id: number, name: string): Promise<boolean> {
        const cleanName = name.trim().toUpperCase();
        
        const local = await getLocalVessels();
        let found = false;
        for (const vessel of local) {
            const barge = vessel.barges?.find(b => b.id === id);
            if (barge) {
                barge.name = cleanName;
                found = true;
                break;
            }
        }
        if (found) {
            await saveLocalVessels(local);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_barges')
                .update({ name: cleanName })
                .eq('id', id);

            if (error) {
                console.warn('Supabase update barge failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, updated barge locally:', e);
            return true;
        }
    },

    /**
     * Update barge config
     */
    async updateBargeConfig(id: number, config: BargeConfig): Promise<boolean> {
        const local = await getLocalVessels();
        
        // 1. Fetch current config from Supabase to perform a safe merge
        let remoteConfig: BargeConfig = {} as BargeConfig;
        try {
            const { data, error } = await supabase
                .from('weighbridge_barges')
                .select('config')
                .eq('id', id)
                .single();
            if (!error && data && data.config) {
                remoteConfig = data.config;
            }
        } catch (e) {
            console.warn('Failed to fetch remote config for merge:', e);
        }
        
        // 2. Perform merge
        const finalConfig = { ...remoteConfig, ...config, updatedAt: Date.now() };
        
        // 3. Update local cache
        let found = false;
        for (const vessel of local) {
            const barge = vessel.barges?.find(b => b.id === id);
            if (barge) {
                barge.config = finalConfig;
                found = true;
                break;
            }
        }
        if (found) {
            await saveLocalVessels(local);
        }

        // 4. Update Supabase
        try {
            // Clean config so it doesn't duplicate relational columns on remote DB
            const cleanConfig: any = { ...finalConfig };
            delete cleanConfig.orderNo;
            delete cleanConfig.goods;
            delete cleanConfig.goodsCode;
            delete cleanConfig.owner;
            delete cleanConfig.operator;
            delete cleanConfig.tonnage;
            delete cleanConfig.hp;
            delete cleanConfig.gcnNo;
            delete cleanConfig.gcnExpiryDate;
            delete cleanConfig.dkNo;
            delete cleanConfig.bhNo;
            delete cleanConfig.bhExpiryDate;
            delete cleanConfig.captain;
            delete cleanConfig.chiefEngineer;
            delete cleanConfig.arrivalTime;
            delete cleanConfig.departureTime;

            const updates: Record<string, any> = { config: cleanConfig };
            if (finalConfig.orderNo !== undefined) updates.order_no = String(finalConfig.orderNo);
            if (finalConfig.goods !== undefined) updates.goods = finalConfig.goods;
            if (finalConfig.goodsCode !== undefined) updates.goods_code = finalConfig.goodsCode;
            if (finalConfig.owner !== undefined) updates.owner = finalConfig.owner;
            if (finalConfig.operator !== undefined) updates.operator = finalConfig.operator;
            if (finalConfig.tonnage !== undefined) updates.tonnage = finalConfig.tonnage ? Number(finalConfig.tonnage) || null : null;
            if (finalConfig.hp !== undefined) updates.hp = finalConfig.hp ? Number(finalConfig.hp) || null : null;
            if (finalConfig.gcnNo !== undefined) updates.gcn_no = finalConfig.gcnNo;
            if (finalConfig.gcnExpiryDate !== undefined) updates.gcn_expiry_date = finalConfig.gcnExpiryDate;
            if (finalConfig.dkNo !== undefined) updates.dk_no = finalConfig.dkNo;
            if (finalConfig.bhNo !== undefined) updates.bh_no = finalConfig.bhNo;
            if (finalConfig.bhExpiryDate !== undefined) updates.bh_expiry_date = finalConfig.bhExpiryDate;
            if (finalConfig.captain !== undefined) updates.captain = finalConfig.captain;
            if (finalConfig.chiefEngineer !== undefined) updates.chief_engineer = finalConfig.chiefEngineer;
            if (finalConfig.arrivalTime !== undefined) updates.arrival_time = finalConfig.arrivalTime;
            if (finalConfig.departureTime !== undefined) updates.departure_time = finalConfig.departureTime;

            let { error } = await supabase
                .from('weighbridge_barges')
                .update(updates)
                .eq('id', id);

            // Fallback if columns not yet added on Supabase
            if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
                const retry = await supabase
                    .from('weighbridge_barges')
                    .update({ config: finalConfig })
                    .eq('id', id);
                error = retry.error;
            }

            if (error) {
                console.warn('Supabase update config failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, updated config locally:', e);
            return true;
        }
    },

    /**
     * Delete a barge
     */
    async deleteBarge(id: number): Promise<boolean> {
        const local = await getLocalVessels();
        let found = false;
        for (const vessel of local) {
            if (vessel.barges) {
                const initialLength = vessel.barges.length;
                vessel.barges = vessel.barges.filter(b => b.id !== id);
                if (vessel.barges.length !== initialLength) {
                    found = true;
                    break;
                }
            }
        }
        if (found) {
            await saveLocalVessels(local);
            await dbContext.delete(`wb_trucks_${id}`);
        }

        try {
            const { error } = await supabase
                .from('weighbridge_barges')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete barge failed, kept local deletion:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted barge locally:', e);
            return true;
        }
    },

    /**
     * Move a barge from its current vessel to a target vessel
     */
    async moveBarge(bargeId: number, targetVesselId: number): Promise<boolean> {
        const local = await getLocalVessels();
        let targetBarge: Barge | null = null;
        let sourceVessel: Vessel | null = null;
        const targetVessel = local.find(v => String(v.id) === String(targetVesselId));

        if (!targetVessel) {
            console.error('Target vessel not found:', targetVesselId);
            return false;
        }

        // Find the barge and its source vessel
        for (const vessel of local) {
            if (vessel.barges) {
                const bIdx = vessel.barges.findIndex(b => String(b.id) === String(bargeId));
                if (bIdx !== -1) {
                    sourceVessel = vessel;
                    targetBarge = vessel.barges[bIdx] || null;
                    // Remove from source vessel
                    vessel.barges.splice(bIdx, 1);
                    break;
                }
            }
        }

        if (!targetBarge || !sourceVessel) {
            console.error('Source barge or vessel not found:', bargeId);
            return false;
        }

        if (String(sourceVessel.id) === String(targetVesselId)) {
            // Already in target vessel, nothing to do
            return true;
        }

        // Update barge's vessel_id
        targetBarge.vessel_id = targetVessel.id;
        if (!targetVessel.barges) {
            targetVessel.barges = [];
        }
        targetVessel.barges.push(targetBarge);

        // Save updated local vessels cache
        await saveLocalVessels(local);

        // Update Supabase
        try {
            const { error } = await supabase
                .from('weighbridge_barges')
                .update({ vessel_id: targetVessel.id })
                .eq('id', bargeId);

            if (error) {
                console.warn('Supabase move barge failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, moved barge locally:', e);
            return true;
        }
    },

    /**
     * Get all trucks for a specific barge
     */
    async getTrucks(bargeId: number): Promise<Truck[]> {
        const getLocalTrucks = async () => {
            return (await dbContext.get<Truck[]>(`wb_trucks_${bargeId}`)) || [];
        };

        try {
            const { data, error } = await supabase
                .from('weighbridge_trucks')
                .select('*')
                .eq('barge_id', bargeId)
                .order('created_at', { ascending: true });

            if (error) {
                console.warn('Supabase fetch trucks failed, loading locally:', error);
                return await getLocalTrucks();
            }

            const formatted = (data || []).map((t: any) => ({
                id: t.id,
                barge_id: t.barge_id,
                ticketNo: t.ticket_no,
                plateNumber: t.plate_number,
                driver: t.driver || '',
                weight1: Number(t.weight_1),
                weight2: Number(t.weight_2),
                weightNet: Number(t.weight_net),
                dateIn: t.date_in || '',
                dateOut: t.date_out || '',
                note: t.note || '',
                created_at: t.created_at
            }));

            await dbContext.set(`wb_trucks_${bargeId}`, formatted);
            return formatted;
        } catch (e) {
            console.warn('Supabase offline, loading trucks locally:', e);
            return await getLocalTrucks();
        }
    },

    /**
     * Delete all trucks for a barge (used when overwriting)
     */
    async deleteAllTrucksForBarge(bargeId: number): Promise<boolean> {
        await dbContext.delete(`wb_trucks_${bargeId}`);
        try {
            const { error } = await supabase
                .from('weighbridge_trucks')
                .delete()
                .eq('barge_id', bargeId);
            if (error) {
                console.warn('Supabase delete all trucks for barge failed:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted all trucks locally:', e);
            return true;
        }
    },

    /**
     * Upsert multiple trucks (used in Excel import or bulk edits)
     */
    async saveTrucks(bargeId: number, trucks: any[]): Promise<boolean> {
        await dbContext.set(`wb_trucks_${bargeId}`, trucks);

        try {
            if (trucks.length === 0) return true;

            const dbTrucks = trucks.map(t => ({
                id: t.id,
                barge_id: bargeId,
                ticket_no: t.ticketNo,
                plate_number: t.plateNumber,
                driver: t.driver || null,
                weight_1: t.weight1,
                weight_2: t.weight2,
                weight_net: t.weightNet,
                date_in: t.dateIn || null,
                date_out: t.dateOut || null,
                note: t.note || null
            }));

            const chunkSize = 100;
            for (let i = 0; i < dbTrucks.length; i += chunkSize) {
                const chunk = dbTrucks.slice(i, i + chunkSize);
                const { error } = await supabase
                    .from('weighbridge_trucks')
                    .upsert(chunk);

                if (error) {
                    console.warn(`Supabase save trucks chunk ${i}-${i + chunkSize} failed:`, error);
                }
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, saved trucks locally:', e);
            return true;
        }
    },

    /**
     * Save or update a single truck
     */
    async saveSingleTruck(bargeId: number, truck: any): Promise<boolean> {
        const localTrucks = (await dbContext.get<Truck[]>(`wb_trucks_${bargeId}`)) || [];
        const index = localTrucks.findIndex(t => t.id === truck.id);
        if (index !== -1) {
            localTrucks[index] = { ...truck, barge_id: bargeId };
        } else {
            localTrucks.push({ ...truck, barge_id: bargeId });
        }
        await dbContext.set(`wb_trucks_${bargeId}`, localTrucks);

        try {
            const dbTruck = {
                id: truck.id,
                barge_id: bargeId,
                ticket_no: truck.ticketNo,
                plate_number: truck.plateNumber,
                driver: truck.driver || null,
                weight_1: truck.weight1,
                weight_2: truck.weight2,
                weight_net: truck.weightNet,
                date_in: truck.dateIn || null,
                date_out: truck.dateOut || null,
                note: truck.note || null
            };

            const { error } = await supabase
                .from('weighbridge_trucks')
                .upsert([dbTruck]);

            if (error) {
                console.warn('Supabase save single truck failed, kept local change:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, saved single truck locally:', e);
            return true;
        }
    },

    /**
     * Delete a single truck
     */
    async deleteTruck(id: number): Promise<boolean> {
        const localVessels = await getLocalVessels();
        const bargeIds: number[] = [];
        for (const vessel of localVessels) {
            if (vessel.barges) {
                vessel.barges.forEach(b => bargeIds.push(b.id));
            }
        }
        
        for (const bargeId of bargeIds) {
            const localTrucks = await dbContext.get<Truck[]>(`wb_trucks_${bargeId}`);
            if (localTrucks) {
                const initialLength = localTrucks.length;
                const updated = localTrucks.filter(t => t.id !== id);
                if (updated.length !== initialLength) {
                    await dbContext.set(`wb_trucks_${bargeId}`, updated);
                    break;
                }
            }
        }

        try {
            const { error } = await supabase
                .from('weighbridge_trucks')
                .delete()
                .eq('id', id);

            if (error) {
                console.warn('Supabase delete truck failed, kept local deletion:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, deleted truck locally:', e);
            return true;
        }
    },

    /**
     * Clear all trucks for a specific barge
     */
    async clearBargeTrucks(bargeId: number): Promise<boolean> {
        await dbContext.set(`wb_trucks_${bargeId}`, []);

        try {
            const { error } = await supabase
                .from('weighbridge_trucks')
                .delete()
                .eq('barge_id', bargeId);

            if (error) {
                console.warn('Supabase clear trucks failed, cleared locally:', error);
            }
            return true;
        } catch (e) {
            console.warn('Supabase offline, cleared trucks locally:', e);
            return true;
        }
    }
};
