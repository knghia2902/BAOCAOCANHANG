<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { WeighbridgeService, type Vessel, type Barge, type BargeConfig } from '@/services/excel/WeighbridgeService';
import { StorageService } from '@/services/storage/StorageService';
import { useToast } from '@/composables/useToast';

const { addToast } = useToast();
const vessels = ref<Vessel[]>([]);
const loading = ref(false);
const saving = ref(false);
const searchQuery = ref('');

// Excel Import state
const excelFileInput = ref<HTMLInputElement | null>(null);

// Edit Workspace state
const activeBargeId = ref<number | null>(null);
const selectedBarge = ref<Barge | null>(null);
const selectedVesselName = ref('');

// Form fields
const editBargeName = ref('');
const editOrderNo = ref('');
const editGoods = ref('');
const editGoodsCode = ref('');
const editOwner = ref('');
const editOperator = ref('');
const editXn = ref('');
const editTicketPrefix = ref('');
const editTicketSeed = ref<number | string>('');
const editChinhpham = ref<number | string>('');
const editPhupham = ref<number | string>('');
const editKetluan = ref('');
const editLocked = ref(false);

// New Structured Profile fields
const editTonnage = ref<number | string>('');
const editHp = ref<number | string>('');
const editGcnNo = ref('');
const editGcnIssuedDate = ref('');
const editGcnExpiryDate = ref('');
const editDkNo = ref('');
const editDkIssuedDate = ref('');
const editDkExpiryDate = ref('');
const editBhNo = ref('');
const editBhIssuedDate = ref('');
const editBhExpiryDate = ref('');

// New Crew & Movement fields
const editCaptain = ref('');
const editCaptainGrade = ref('');
const editChiefEngineer = ref('');
const editChiefEngineerGrade = ref('');
const editSailors = ref('');
const editHasCrewBook = ref(false);
const editArrivalTime = ref('');
const editDepartureTime = ref('');
const editKhaiHethong = ref('');
const editGcnImages = ref<string[]>([]);
const editDkImages = ref<string[]>([]);
const editBhImages = ref<string[]>([]);
const editCrewImages = ref<string[]>([]);

// Custom Metadata fields (for additional barge information)
interface CustomMeta {
    key: string;
    value: string;
}
const customMetas = ref<CustomMeta[]>([]);

// Fetch all barges from all vessels
const allBarges = computed(() => {
    const list: Array<{ barge: Barge; vesselName: string }> = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach(b => {
                list.push({
                    barge: b,
                    vesselName: v.name
                });
            });
        }
    });
    
    // Sap xep giong "Danh sach quan ly tat ca sa lan"
    return list.sort((a, b) => {
        const orderA = a.barge.config?.orderNo ? String(a.barge.config.orderNo).trim() : '';
        const orderB = b.barge.config?.orderNo ? String(b.barge.config.orderNo).trim() : '';
        
        if (!orderA && orderB) return 1;
        if (orderA && !orderB) return -1;
        if (!orderA && !orderB) {
            return a.barge.name.localeCompare(b.barge.name);
        }
        
        return orderA.localeCompare(orderB, undefined, { numeric: true, sensitivity: 'base' });
    });
});

// Filtered list
const filteredBarges = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return allBarges.value;
    return allBarges.value.filter(item => {
        return (
            item.barge.name.toLowerCase().includes(q) ||
            item.vesselName.toLowerCase().includes(q) ||
            (item.barge.config?.goods || '').toLowerCase().includes(q) ||
            (item.barge.config?.owner || '').toLowerCase().includes(q) ||
            (item.barge.config?.operator || '').toLowerCase().includes(q) ||
            (item.barge.config?.orderNo || '').toLowerCase().includes(q)
        );
    });
});

// Helpers to calculate status
const isDocComplete = (config: BargeConfig) => {
    return !!(config.gcnNo && config.dkNo && config.bhNo);
};

const formatDateTime = (dtStr?: string) => {
    if (!dtStr) return '-';
    if (dtStr === 'Vô thời hạn') return 'Vô thời hạn';
    try {
        const parts = dtStr.split('T');
        const firstPart = parts[0];
        if (firstPart) {
            const dateParts = firstPart.split('-');
            const timeStr = parts[1] || '';
            if (dateParts.length === 3) {
                return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timeStr}`;
            }
        }
    } catch (e) {}
    return dtStr.replace('T', ' ');
};

const parseLocalDate = (dateStr?: string): Date | null => {
    if (!dateStr || dateStr === 'Vô thời hạn') return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0] || '0', 10);
        const month = parseInt(parts[1] || '1', 10) - 1;
        const day = parseInt(parts[2] || '1', 10);
        return new Date(year, month, day, 12, 0, 0);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

const parseLocalTime = (timeStr?: string): Date | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        const hr = parseInt(parts[0] || '0', 10);
        const min = parseInt(parts[1] || '0', 10);
        return new Date(1899, 11, 30, hr, min, 0);
    }
    return null;
};

const getExpectedCaptainGrade = (tonnage: number): string => {
    if (isNaN(tonnage) || tonnage <= 0) return '';
    if (tonnage > 1000) return 'T1';
    if (tonnage >= 500) return 'T2';
    return 'T3';
};

const getExpectedChiefEngineerGrade = (hp: number): string => {
    if (isNaN(hp) || hp <= 0) return '';
    if (hp <= 250) return 'M3';
    if (hp <= 1000) return 'M2';
    return 'M1';
};

const isSailorRequired = (tonnage: number): boolean => {
    return !isNaN(tonnage) && tonnage >= 500;
};

const isCaptainGradeSufficient = (entered: string, expected: string): boolean => {
    if (!expected) return true;
    if (!entered) return false;
    const enteredNorm = entered.trim().toUpperCase();
    const expectedNorm = expected.trim().toUpperCase();
    
    const grades = ['T3', 'T2', 'T1'];
    const enteredIdx = grades.indexOf(enteredNorm);
    const expectedIdx = grades.indexOf(expectedNorm);
    
    if (enteredIdx === -1) {
        if (expectedNorm === 'T3') return true;
        if (expectedNorm === 'T2') return enteredNorm === 'T2' || enteredNorm === 'T1' || enteredNorm.includes('T2') || enteredNorm.includes('T1') || enteredNorm.includes('HANG 2') || enteredNorm.includes('HẠNG 2') || enteredNorm.includes('HANG 1') || enteredNorm.includes('HẠNG 1');
        if (expectedNorm === 'T1') return enteredNorm === 'T1' || enteredNorm.includes('T1') || enteredNorm.includes('HANG 1') || enteredNorm.includes('HẠNG 1');
        return false;
    }
    return enteredIdx >= expectedIdx;
};

const isChiefEngineerGradeSufficient = (entered: string, expected: string): boolean => {
    if (!expected) return true;
    if (!entered) return false;
    const enteredNorm = entered.trim().toUpperCase();
    const expectedNorm = expected.trim().toUpperCase();
    
    const grades = ['M3', 'M2', 'M1'];
    const enteredIdx = grades.indexOf(enteredNorm);
    const expectedIdx = grades.indexOf(expectedNorm);
    
    if (enteredIdx === -1) {
        if (expectedNorm === 'M3') return true;
        if (expectedNorm === 'M2') return enteredNorm === 'M2' || enteredNorm === 'M1' || enteredNorm.includes('M2') || enteredNorm.includes('M1') || enteredNorm.includes('HANG 2') || enteredNorm.includes('HẠNG 2') || enteredNorm.includes('HANG 1') || enteredNorm.includes('HẠNG 1');
        if (expectedNorm === 'M1') return enteredNorm === 'M1' || enteredNorm.includes('M1') || enteredNorm.includes('HANG 1') || enteredNorm.includes('HẠNG 1');
        return false;
    }
    return enteredIdx >= expectedIdx;
};

const getCrewStatus = (config: BargeConfig): { status: 'ĐỦ' | 'THIẾU'; details: string } => {
    const t = config.tonnage !== undefined ? Number(config.tonnage) : NaN;
    const hp = config.hp !== undefined ? Number(config.hp) : NaN;
    
    if (!config.captain || !config.captain.trim()) {
        return { status: 'THIẾU', details: 'Thiếu Thuyền trưởng' };
    }
    
    const expCap = getExpectedCaptainGrade(t);
    if (expCap) {
        const enteredCap = config.captainGrade || '';
        if (!isCaptainGradeSufficient(enteredCap, expCap)) {
            return { status: 'THIẾU', details: `Hạng Thuyền trưởng < ${expCap}` };
        }
    }
    
    if (!config.chiefEngineer || !config.chiefEngineer.trim()) {
        return { status: 'THIẾU', details: 'Thiếu Máy trưởng' };
    }
    
    const expChief = getExpectedChiefEngineerGrade(hp);
    if (expChief) {
        const enteredChief = config.chiefEngineerGrade || '';
        if (!isChiefEngineerGradeSufficient(enteredChief, expChief)) {
            return { status: 'THIẾU', details: `Hạng Máy trưởng < ${expChief}` };
        }
    }
    
    if (isSailorRequired(t)) {
        if (!config.sailors || !config.sailors.trim()) {
            return { status: 'THIẾU', details: 'Yêu cầu có Thủy thủ' };
        }
    }
    
    return { status: 'ĐỦ', details: 'Hợp lệ' };
};

const computedExpectedCaptainGrade = computed(() => {
    const t = Number(editTonnage.value);
    return getExpectedCaptainGrade(t);
});

const computedExpectedChiefEngineerGrade = computed(() => {
    const hp = Number(editHp.value);
    return getExpectedChiefEngineerGrade(hp);
});

const isComputedSailorRequired = computed(() => {
    const t = Number(editTonnage.value);
    return isSailorRequired(t);
});

watch(computedExpectedCaptainGrade, (newExpected) => {
    if (newExpected && !editCaptainGrade.value) {
        editCaptainGrade.value = newExpected;
    }
});

watch(computedExpectedChiefEngineerGrade, (newExpected) => {
    if (newExpected && !editChiefEngineerGrade.value) {
        editChiefEngineerGrade.value = newExpected;
    }
});

const isEditDocComplete = computed(() => {
    return !!(editGcnNo.value.trim() && editDkNo.value.trim() && editBhNo.value.trim());
});

const isEditCrewFit = computed(() => {
    const t = editTonnage.value !== '' ? Number(editTonnage.value) : NaN;
    const hp = editHp.value !== '' ? Number(editHp.value) : NaN;
    
    if (!editCaptain.value.trim()) return false;
    const expCap = getExpectedCaptainGrade(t);
    if (expCap) {
        if (!isCaptainGradeSufficient(editCaptainGrade.value, expCap)) return false;
    }
    
    if (!editChiefEngineer.value.trim()) return false;
    const expChief = getExpectedChiefEngineerGrade(hp);
    if (expChief) {
        if (!isChiefEngineerGradeSufficient(editChiefEngineerGrade.value, expChief)) return false;
    }
    
    if (isSailorRequired(t)) {
        if (!editSailors.value.trim()) return false;
    }
    
    return true;
});

watch(
    [isEditDocComplete, isEditCrewFit],
    ([docOk, crewOk]) => {
        if (docOk && crewOk) {
            editKetluan.value = 'Cho phép';
        } else {
            editKetluan.value = 'Không cho phép';
        }
    },
    { immediate: true }
);

async function loadData() {
    loading.value = true;
    try {
        vessels.value = await WeighbridgeService.getVessels() || [];
    } catch (e) {
        console.error('Loi tai danh sach:', e);
        addToast('Loi khi tai danh sach phuong tien!', 'error');
    } finally {
        loading.value = false;
    }
}

function openEdit(item: { barge: Barge; vesselName: string }) {
    selectedBarge.value = item.barge;
    selectedVesselName.value = item.vesselName;
    
    const config = item.barge.config || {} as BargeConfig;
    editBargeName.value = item.barge.name || '';
    editOrderNo.value = config.orderNo || '';
    editGoods.value = config.goods || '';
    editGoodsCode.value = config.goodsCode || '';
    editOwner.value = config.owner || '';
    editOperator.value = config.operator || '';
    editXn.value = config.xn || 'XUAT';
    editTicketPrefix.value = config.ticketPrefix || '';
    editTicketSeed.value = config.ticketSeed !== undefined ? config.ticketSeed : '';
    editChinhpham.value = config.chinhpham !== undefined ? config.chinhpham : '';
    editPhupham.value = config.phupham !== undefined ? config.phupham : '';
    editKetluan.value = config.ketluan || '';
    editLocked.value = config.locked || false;
    
    // Set new profile fields
    editTonnage.value = config.tonnage !== undefined ? config.tonnage : '';
    editHp.value = config.hp !== undefined ? config.hp : '';
    editGcnNo.value = config.gcnNo || '';
    editGcnIssuedDate.value = config.gcnIssuedDate || '';
    editGcnExpiryDate.value = config.gcnExpiryDate || '';
    editDkNo.value = config.dkNo || '';
    editDkIssuedDate.value = config.dkIssuedDate || '';
    editDkExpiryDate.value = config.dkExpiryDate || '';
    editBhNo.value = config.bhNo || '';
    editBhIssuedDate.value = config.bhIssuedDate || '';
    editBhExpiryDate.value = config.bhExpiryDate || '';
    
    // Set crew & movement fields
    editCaptain.value = config.captain || '';
    editCaptainGrade.value = config.captainGrade || '';
    editChiefEngineer.value = config.chiefEngineer || '';
    editChiefEngineerGrade.value = config.chiefEngineerGrade || '';
    editSailors.value = config.sailors || '';
    editHasCrewBook.value = config.hasCrewBook || false;
    editArrivalTime.value = config.arrivalTime || '';
    editDepartureTime.value = config.departureTime || '';
    const rawKhai = config.khaihethong || '';
    if (rawKhai.toUpperCase() === 'CÓ' || rawKhai.toUpperCase() === 'ĐÃ KHAI') {
        editKhaiHethong.value = 'Có';
    } else if (rawKhai.toUpperCase() === 'KHÔNG' || rawKhai.toUpperCase() === 'CHƯA KHAI') {
        editKhaiHethong.value = 'Không';
    } else {
        editKhaiHethong.value = rawKhai;
    }
    
    // Parse custom metadata
    const customObj = config.customProfileInfo || {};
    customMetas.value = Object.entries(customObj).map(([key, value]) => ({
        key,
        value: String(value)
    }));
    
    editGcnImages.value = Array.isArray(config.gcnImages) ? [...config.gcnImages] : [];
    editDkImages.value = Array.isArray(config.dkImages) ? [...config.dkImages] : [];
    editBhImages.value = Array.isArray(config.bhImages) ? [...config.bhImages] : [];
    editCrewImages.value = Array.isArray(config.crewImages) ? [...config.crewImages] : [];
    
    activeBargeId.value = item.barge.id;
}

function toggleGcnNoExpiry(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
        editGcnExpiryDate.value = 'Vô thời hạn';
    } else {
        editGcnExpiryDate.value = '';
    }
}

async function handleImageUpload(e: Event, type: 'gcn' | 'dk' | 'bh' | 'crew') {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    
    addToast('Đang tải hình ảnh lên... ⏳', 'info');
    
    const file = target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        addToast('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn tệp nhỏ hơn!', 'error');
        target.value = '';
        return;
    }
    
    const folder = `barge-profiles/${type}`;
    const url = await StorageService.uploadImage(file, folder);
    
    if (url) {
        if (type === 'gcn') editGcnImages.value.push(url);
        else if (type === 'dk') editDkImages.value.push(url);
        else if (type === 'bh') editBhImages.value.push(url);
        else if (type === 'crew') editCrewImages.value.push(url);
        addToast('Tải ảnh lên thành công!', 'success');
    } else {
        addToast('Lỗi khi tải ảnh lên!', 'error');
    }
    
    target.value = '';
}

async function removeImage(index: number, type: 'gcn' | 'dk' | 'bh' | 'crew') {
    let urlToDelete = '';
    if (type === 'gcn') {
        urlToDelete = editGcnImages.value[index] || '';
        editGcnImages.value.splice(index, 1);
    } else if (type === 'dk') {
        urlToDelete = editDkImages.value[index] || '';
        editDkImages.value.splice(index, 1);
    } else if (type === 'bh') {
        urlToDelete = editBhImages.value[index] || '';
        editBhImages.value.splice(index, 1);
    } else if (type === 'crew') {
        urlToDelete = editCrewImages.value[index] || '';
        editCrewImages.value.splice(index, 1);
    }
    
    if (urlToDelete) {
        StorageService.deleteImage(urlToDelete).then(ok => {
            if (ok) console.log('Deleted file from storage:', urlToDelete);
        });
    }
    addToast('Đã xóa hình ảnh!', 'success');
}

function extractFileName(url: string): string {
    if (!url) return '';
    try {
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
            const nameParts = lastPart.split('_');
            if (nameParts.length > 1) {
                return decodeURIComponent(nameParts.slice(1).join('_'));
            }
            return decodeURIComponent(lastPart);
        }
    } catch (e) {}
    return 'image.png';
}

function addCustomMeta() {
    customMetas.value.push({ key: '', value: '' });
}

function removeCustomMeta(index: number) {
    customMetas.value.splice(index, 1);
}

async function saveProfile() {
    if (!selectedBarge.value) return;
    saving.value = true;
    try {
        const id = selectedBarge.value.id;
        const name = editBargeName.value.trim().toUpperCase();
        if (!name) {
            addToast('Ten sa lan khong duoc de trong!', 'info');
            saving.value = false;
            return;
        }
        
        const customProfileInfo: Record<string, string> = {};
        customMetas.value.forEach(m => {
            const k = m.key.trim();
            if (k) {
                customProfileInfo[k] = m.value.trim();
            }
        });
        
        const updatedConfig: BargeConfig = {
            ...(selectedBarge.value.config || {}),
            orderNo: editOrderNo.value.trim().toUpperCase(),
            goods: editGoods.value.trim(),
            goodsCode: editGoodsCode.value.trim().toUpperCase(),
            owner: editOwner.value.trim(),
            operator: editOperator.value.trim(),
            xn: editXn.value.trim().toUpperCase(),
            ticketPrefix: editTicketPrefix.value.trim().toUpperCase(),
            ticketSeed: editTicketSeed.value,
            chinhpham: editChinhpham.value,
            phupham: editPhupham.value,
            ketluan: editKetluan.value.trim(),
            locked: editLocked.value,
            
            tonnage: editTonnage.value !== '' ? Number(editTonnage.value) : undefined,
            hp: editHp.value !== '' ? Number(editHp.value) : undefined,
            gcnNo: editGcnNo.value.trim(),
            gcnIssuedDate: editGcnIssuedDate.value,
            gcnExpiryDate: editGcnExpiryDate.value,
            dkNo: editDkNo.value.trim(),
            dkIssuedDate: editDkIssuedDate.value,
            dkExpiryDate: editDkExpiryDate.value,
            bhNo: editBhNo.value.trim(),
            bhIssuedDate: editBhIssuedDate.value,
            bhExpiryDate: editBhExpiryDate.value,
            
            customProfileInfo: customProfileInfo,
            
            captain: editCaptain.value.trim(),
            captainGrade: editCaptainGrade.value.trim(),
            chiefEngineer: editChiefEngineer.value.trim(),
            chiefEngineerGrade: editChiefEngineerGrade.value.trim(),
            sailors: editSailors.value.trim(),
            hasCrewBook: editHasCrewBook.value,
            arrivalTime: editArrivalTime.value,
            departureTime: editDepartureTime.value,
            khaihethong: editKhaiHethong.value.trim(),
            gcnImages: [...editGcnImages.value],
            dkImages: [...editDkImages.value],
            bhImages: [...editBhImages.value],
            crewImages: [...editCrewImages.value]
        };
        
        if (selectedBarge.value.name !== name) {
            await WeighbridgeService.updateBarge(id, name);
        }
        
        await WeighbridgeService.updateBargeConfig(id, updatedConfig);
        
        addToast('Luu ho so sa lan thanh cong!', 'success');
        window.dispatchEvent(new CustomEvent('barge-config-updated', { detail: { bargeId: id } }));
        
        activeBargeId.value = null;
        await loadData();
    } catch (e) {
        console.error('Loi khi luu ho so:', e);
        addToast('Gap su co khi luu ho so sa lan!', 'error');
    } finally {
        saving.value = false;
    }
}

function triggerExcelUpload() {
    excelFileInput.value?.click();
}

async function exportToExcel() {
    try {
        addToast('Đang tải và khởi tạo tệp mẫu Excel... ⏳', 'info');
        const ExcelJS = (await import('exceljs')).default;
        
        // Fetch the template excel file from public/templates
        const response = await fetch('/templates/NNP_QL_HO_SO_PHUONG_TIEN_CANG.xlsx');
        if (!response.ok) {
            throw new Error('Không thể tải tệp mẫu Excel');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        
        const sheet1 = workbook.getWorksheet('Hồ sơ phương tiện');
        const sheet2 = workbook.getWorksheet('Nhật ký vào, rời');
        
        if (!sheet1 || !sheet2) {
            throw new Error('Tệp mẫu Excel thiếu các sheet cần thiết!');
        }
        
        // Helper to extract style information from row 2
        const getRowStyleTemplate = (row: any) => {
            const cellStyles: any[] = [];
            for (let c = 1; c <= 30; c++) {
                const cell = row.getCell(c);
                cellStyles.push({
                    font: cell.font ? JSON.parse(JSON.stringify(cell.font)) : undefined,
                    fill: cell.fill ? JSON.parse(JSON.stringify(cell.fill)) : undefined,
                    border: cell.border ? JSON.parse(JSON.stringify(cell.border)) : undefined,
                    alignment: cell.alignment ? JSON.parse(JSON.stringify(cell.alignment)) : undefined,
                    numFmt: cell.numFmt
                });
            }
            return {
                height: row.height,
                cellStyles
            };
        };
        
        const applyRowStyleTemplate = (row: any, template: any) => {
            if (template.height) row.height = template.height;
            template.cellStyles.forEach((style: any, idx: number) => {
                const cell = row.getCell(idx + 1);
                if (style.font) cell.font = style.font;
                if (style.fill) cell.fill = style.fill;
                if (style.border) cell.border = style.border;
                if (style.alignment) cell.alignment = style.alignment;
                if (style.numFmt) cell.numFmt = style.numFmt;
            });
        };
        
        // Store styles of row 2 from template
        const styleRow1 = getRowStyleTemplate(sheet1.getRow(2));
        const styleRow2 = getRowStyleTemplate(sheet2.getRow(2));
        
        // Populate Sheet 1 (Hồ sơ phương tiện)
        const maxRow1 = Math.max(sheet1.rowCount, filteredBarges.value.length + 1);
        for (let rowNum = 2; rowNum <= maxRow1; rowNum++) {
            const row = sheet1.getRow(rowNum);
            const index = rowNum - 2;
            if (index < filteredBarges.value.length) {
                const item = filteredBarges.value[index];
                if (item) {
                    const config = item.barge.config || {} as BargeConfig;
                    
                    row.getCell(1).value = { formula: 'ROW()-1' };
                    row.getCell(2).value = item.barge.name || '';
                row.getCell(3).value = typeof config.tonnage === 'number' ? config.tonnage : null;
                row.getCell(4).value = typeof config.hp === 'number' ? config.hp : null;
                row.getCell(5).value = config.gcnNo || '';
                row.getCell(6).value = config.gcnIssuedDate ? parseLocalDate(config.gcnIssuedDate) : null;
                row.getCell(7).value = config.gcnExpiryDate === 'Vô thời hạn' ? 'Không thời hạn' : (config.gcnExpiryDate ? parseLocalDate(config.gcnExpiryDate) : null);
                row.getCell(8).value = config.dkNo || '';
                row.getCell(9).value = config.dkIssuedDate ? parseLocalDate(config.dkIssuedDate) : null;
                row.getCell(10).value = config.dkExpiryDate ? parseLocalDate(config.dkExpiryDate) : null;
                row.getCell(11).value = config.bhNo || '';
                row.getCell(12).value = config.bhIssuedDate ? parseLocalDate(config.bhIssuedDate) : null;
                row.getCell(13).value = config.bhExpiryDate ? parseLocalDate(config.bhExpiryDate) : null;
                
                row.getCell(14).value = { formula: `IF(AND(E${rowNum}<>"",H${rowNum}<>"",K${rowNum}<>""),"ĐỦ","THIẾU")` };
                row.getCell(15).value = { formula: `IF(G${rowNum}="","",IF(G${rowNum}<TODAY(),"HẾT HẠN","CÒN HẠN"))` };
                row.getCell(16).value = { formula: `IF(J${rowNum}="","",IF(J${rowNum}<TODAY(),"HẾT HẠN","CÒN HẠN"))` };
                row.getCell(17).value = { formula: `IF(M${rowNum}="","",IF(M${rowNum}<TODAY(),"HẾT HẠN","CÒN HẠN"))` };
                
                row.getCell(18).value = config.captain || '';
                row.getCell(19).value = { formula: `IF(C${rowNum}>1000,"T1",IF(C${rowNum}>=500,"T2","T3"))` };
                row.getCell(20).value = config.chiefEngineer || '';
                row.getCell(21).value = { formula: `IF(D${rowNum}<=250,"M3",IF(D${rowNum}<=1000,"M2","M1"))` };
                row.getCell(22).value = config.sailors || '';
                row.getCell(23).value = config.hasCrewBook ? 'Có' : 'Không';
                row.getCell(24).value = { formula: `IF(AND(R${rowNum}<>"",T${rowNum}<>"",W${rowNum}="Có"),"PHÙ HỢP","KHÔNG PHÙ HỢP")` };
                row.getCell(25).value = config.khaihethong || '';
                row.getCell(26).value = config.notes || '';
                
                applyRowStyleTemplate(row, styleRow1);
                }
            } else {
                // Clear input cells, write formulas for extra rows
                row.getCell(2).value = null;
                row.getCell(3).value = null;
                row.getCell(4).value = null;
                row.getCell(5).value = null;
                row.getCell(6).value = null;
                row.getCell(7).value = null;
                row.getCell(8).value = null;
                row.getCell(9).value = null;
                row.getCell(10).value = null;
                row.getCell(11).value = null;
                row.getCell(12).value = null;
                row.getCell(13).value = null;
                row.getCell(18).value = null;
                row.getCell(20).value = null;
                row.getCell(22).value = null;
                row.getCell(23).value = null;
                row.getCell(25).value = null;
                row.getCell(26).value = null;
                
                row.getCell(1).value = { formula: 'ROW()-1' };
                row.getCell(14).value = { formula: `IF(AND(E${rowNum}<>"",H${rowNum}<>"",K${rowNum}<>""),"ĐỦ","THIẾU")` };
                row.getCell(15).value = { formula: `IF(G${rowNum}="","",IF(G${rowNum}<TODAY(),"HẾT HẠN","CÒN HẠN"))` };
                row.getCell(16).value = { formula: `IF(J${rowNum}="","",IF(J${rowNum}<TODAY(),"HẾT HẠN","CÒN HẠN"))` };
                row.getCell(17).value = { formula: `IF(M${rowNum}="","",IF(M${rowNum}<TODAY(),"HẾT HẠN","CÒN HẠN"))` };
                row.getCell(19).value = { formula: `IF(C${rowNum}>1000,"T1",IF(C${rowNum}>=500,"T2","T3"))` };
                row.getCell(21).value = { formula: `IF(D${rowNum}<=250,"M3",IF(D${rowNum}<=1000,"M2","M1"))` };
                row.getCell(24).value = { formula: `IF(AND(R${rowNum}<>"",T${rowNum}<>"",W${rowNum}="Có"),"PHÙ HỢP","KHÔNG PHÙ HỢP")` };
                
                applyRowStyleTemplate(row, styleRow1);
            }
            row.commit();
        }
        
        // Populate Sheet 2 (Nhật ký vào, rời)
        const maxRow2 = Math.max(sheet2.rowCount, filteredBarges.value.length + 1);
        for (let rowNum = 2; rowNum <= maxRow2; rowNum++) {
            const row = sheet2.getRow(rowNum);
            const index = rowNum - 2;
            if (index < filteredBarges.value.length) {
                const item = filteredBarges.value[index];
                if (item) {
                    const config = item.barge.config || {} as BargeConfig;
                    
                    row.getCell(1).value = { formula: 'ROW()-1' };
                    row.getCell(2).value = config.arrivalTime ? parseLocalDate(config.arrivalTime.split('T')[0]) : null;
                    row.getCell(3).value = config.arrivalTime ? parseLocalTime(config.arrivalTime.split('T')[1]) : null;
                    row.getCell(4).value = config.departureTime ? parseLocalDate(config.departureTime.split('T')[0]) : null;
                    row.getCell(5).value = config.departureTime ? parseLocalTime(config.departureTime.split('T')[1]) : null;
                    row.getCell(6).value = item.barge.name || '';
                    
                    // 1. "Số đăng ký" chính là "GCN đăng ký" -> Lấy trực tiếp từ hệ thống
                    row.getCell(7).value = config.gcnNo || '';
                    
                    row.getCell(8).value = config.goods || '';
                    row.getCell(9).value = config.orderNo || '';
                    
                    // 2. "Hồ sơ PT", "Hồ sơ thuyền viên", "Kết quả" lấy trực tiếp từ hệ thống, không dùng công thức
                    row.getCell(10).value = isDocComplete(config) ? 'ĐỦ' : 'THIẾU';
                    
                    const crew = getCrewStatus(config);
                    row.getCell(11).value = crew.status === 'ĐỦ' ? 'PHÙ HỢP' : 'KHÔNG PHÙ HỢP';
                    
                    row.getCell(12).value = config.ketluan === "Cho phép" ? "CHO PHÉP" : (config.ketluan === "Không cho phép" ? "KHÔNG CHO PHÉP" : "KHÔNG ĐỦ HỒ SƠ");
                    
                    applyRowStyleTemplate(row, styleRow2);
                }
            } else {
                // Clear input cells, write formulas for extra rows
                row.getCell(2).value = null;
                row.getCell(3).value = null;
                row.getCell(4).value = null;
                row.getCell(5).value = null;
                row.getCell(6).value = null;
                row.getCell(8).value = null;
                row.getCell(9).value = null;
                
                row.getCell(1).value = { formula: 'ROW()-1' };
                row.getCell(7).value = { formula: `IFERROR(XLOOKUP(F${rowNum},'Hồ sơ phương tiện'!$B:$B,'Hồ sơ phương tiện'!$E:$E),"")` };
                row.getCell(10).value = { formula: `IFERROR(XLOOKUP(F${rowNum},'Hồ sơ phương tiện'!$B:$B,'Hồ sơ phương tiện'!$N:$N),"")` };
                row.getCell(11).value = { formula: `IFERROR(XLOOKUP(F${rowNum},'Hồ sơ phương tiện'!$B:$B,'Hồ sơ phương tiện'!$X:$X),"")` };
                row.getCell(12).value = { formula: `IF(AND(J${rowNum}="Đủ",K${rowNum}="PHÙ HỢP"),"CHO PHÉP","KHÔNG ĐỦ HỒ SƠ")` };
                
                applyRowStyleTemplate(row, styleRow2);
            }
            row.commit();
        }
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DANH_SACH_HO_SO_PHUONG_TIEN_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addToast('Xuất báo cáo Excel theo mẫu thành công! 📥', 'success');
    } catch (e) {
        console.error('Error exporting template-based excel:', e);
        addToast('Gặp sự cố khi xuất Excel theo mẫu!', 'error');
    }
}

async function handleExcelImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    loading.value = true;
    
    try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        const sheetName = 'Hồ sơ phương tiện';
        let sheet = workbook.getWorksheet(sheetName);
        if (!sheet) {
            sheet = workbook.worksheets[0];
        }
        
        if (!sheet) {
            addToast('Khong the doc du lieu tu file Excel!', 'error');
            loading.value = false;
            return;
        }
        
        let matchCount = 0;
        
        const formatDateCell = (cellValue: any): string => {
            if (!cellValue) return '';
            if (cellValue instanceof Date) {
                return cellValue.toISOString().slice(0, 10);
            }
            if (typeof cellValue === 'object' && cellValue.result instanceof Date) {
                return cellValue.result.toISOString().slice(0, 10);
            }
            if (typeof cellValue === 'number') {
                const date = new Date(Math.round((cellValue - 25569) * 86400 * 1000));
                return date.toISOString().slice(0, 10);
            }
            const str = String(cellValue).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                return str.slice(0, 10);
            }
            return str;
        };
        
        const formatNumberCell = (cellValue: any): number | undefined => {
            if (cellValue === null || cellValue === undefined) return undefined;
            if (typeof cellValue === 'number') return cellValue;
            if (typeof cellValue === 'object' && typeof cellValue.result === 'number') return cellValue.result;
            const parsed = parseFloat(String(cellValue).replace(/[^0-9.-]/g, ''));
            return isNaN(parsed) ? undefined : parsed;
        };
        
        const formatStringCell = (cellValue: any): string => {
            if (cellValue === null || cellValue === undefined) return '';
            if (typeof cellValue === 'object' && cellValue.result !== undefined) {
                return String(cellValue.result).trim();
            }
            return String(cellValue).trim();
        };

        const normalizeBargeName = (name: string): string => {
            return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
        };
        
        const systemBargesMap = new Map<string, Barge>();
        vessels.value.forEach(v => {
            if (v.barges) {
                v.barges.forEach(b => {
                    systemBargesMap.set(normalizeBargeName(b.name), b);
                });
            }
        });
        
        for (let r = 2; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const rawName = formatStringCell(row.getCell(2).value);
            if (!rawName) continue;
            
            const normName = normalizeBargeName(rawName);
            const barge = systemBargesMap.get(normName);
            
            if (barge) {
                const tonnage = formatNumberCell(row.getCell(3).value);
                const hp = formatNumberCell(row.getCell(4).value);
                const gcnNo = formatStringCell(row.getCell(5).value);
                const gcnIssuedDate = formatDateCell(row.getCell(6).value);
                const gcnExpiryDate = formatDateCell(row.getCell(7).value);
                const dkNo = formatStringCell(row.getCell(8).value);
                const dkIssuedDate = formatDateCell(row.getCell(9).value);
                const dkExpiryDate = formatDateCell(row.getCell(10).value);
                const bhNo = formatStringCell(row.getCell(11).value);
                const bhIssuedDate = formatDateCell(row.getCell(12).value);
                const bhExpiryDate = formatDateCell(row.getCell(13).value);
                
                const updatedConfig: BargeConfig = {
                    ...(barge.config || {}),
                    tonnage,
                    hp,
                    gcnNo,
                    gcnIssuedDate,
                    gcnExpiryDate,
                    dkNo,
                    dkIssuedDate,
                    dkExpiryDate,
                    bhNo,
                    bhIssuedDate,
                    bhExpiryDate,
                    updatedAt: Date.now()
                };
                
                await WeighbridgeService.updateBargeConfig(barge.id, updatedConfig);
                matchCount++;
            }
        }
        
        if (matchCount > 0) {
            addToast(`Da nap ho so thanh cong cho ${matchCount} sa lan!`, 'success');
            window.dispatchEvent(new CustomEvent('barge-config-updated', { detail: { batch: true } }));
            await loadData();
        } else {
            addToast('Khong tim thay sa lan trung khop ten!', 'info');
        }
    } catch (e) {
        console.error('Loi nhap Excel:', e);
        addToast('Loi khi doc file Excel!', 'error');
    } finally {
        loading.value = false;
        if (excelFileInput.value) {
            excelFileInput.value.value = '';
        }
    }
}

onMounted(() => {
    loadData();
    window.addEventListener('barge-config-updated', loadData);
});
</script>

<template>
    <div class="flex-grow flex overflow-hidden gap-4 p-4 h-full bg-slate-50 font-display text-left">
        <!-- Details or Master Overview List -->
        <div class="flex-grow flex flex-col h-full min-w-0 bg-white rounded-[24px] border border-primary/5 overflow-hidden shadow-sm">
            
            <!-- CASE A: Overview Mode (activeBargeId === null) -->
            <div v-if="activeBargeId === null" class="flex-grow flex flex-col min-h-0">
                <!-- Control Bar -->
                <div class="border-b border-primary/10 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
                    <!-- Left: Search input -->
                    <div class="relative w-full max-w-xs">
                        <span class="material-symbols-outlined text-gray-400 text-sm absolute left-3 top-1/2 -translate-y-1/2 select-none">search</span>
                        <input 
                            v-model="searchQuery" 
                            type="text" 
                            placeholder="Tìm sà lan, tàu, chủ hàng..." 
                            class="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                        />
                    </div>
                    
                    <!-- Right: Excel Actions -->
                    <div class="flex items-center gap-2 shrink-0">
                        <!-- Excel Import -->
                        <input 
                            type="file" 
                            ref="excelFileInput" 
                            @change="handleExcelImport" 
                            accept=".xlsx" 
                            class="hidden" 
                        />
                        <button 
                            @click="triggerExcelUpload"
                            class="h-8 px-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-teal-600/10 shrink-0"
                            title="Nhập dữ liệu hồ sơ từ file Excel"
                        >
                            <span class="material-symbols-outlined text-sm">upload_file</span>
                            Nhập từ Excel
                        </button>
                        <button 
                            @click="exportToExcel"
                            class="h-8 px-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-primary/10 shrink-0"
                            title="Xuất dữ liệu hồ sơ sà lan sang file Excel"
                        >
                            <span class="material-symbols-outlined text-sm">download</span>
                            Xuất Excel
                        </button>
                    </div>
                </div>

                <!-- Table Content -->
                <div class="flex-grow overflow-auto p-6 min-h-0 flex flex-col">
                    <div v-if="loading" class="flex-grow flex flex-col justify-center items-center text-gray-400 text-xs gap-2">
                        <span class="material-symbols-outlined text-3xl animate-spin text-primary">sync</span>
                        <span>Đang tải thông tin sà lan...</span>
                    </div>
                    <div v-else-if="filteredBarges.length === 0" class="flex-grow flex flex-col justify-center items-center text-gray-400 text-xs italic gap-1">
                        <span class="material-symbols-outlined text-3xl text-gray-300">sailing</span>
                        <span>Không tìm thấy sà lan nào. Vui lòng thêm sà lan mới bên tab "In Phiếu Cân Xe".</span>
                    </div>
                    <div v-else class="flex-grow overflow-auto rounded-[16px] border border-gray-100 min-h-0">
                        <table class="w-full text-left border-collapse text-xs font-semibold">
                            <thead>
                                <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                    <th class="px-3 py-2.5 w-12 text-center bg-gray-50 sticky top-0 z-10">STT</th>
                                    <th class="px-3 py-2.5 bg-gray-50 sticky top-0 z-10">Tên sà lan</th>
                                    <th class="px-3 py-2.5 bg-gray-50 sticky top-0 z-10">Số lệnh</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">Trọng tải (Tấn)</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">Thời gian cập</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">Thời gian rời</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">TT Hồ sơ</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">TT Thuyền viên</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">Kết quả</th>
                                    <th class="px-3 py-2.5 text-center bg-gray-50 sticky top-0 z-10">Khai hệ thống</th>
                                    <th class="px-3 py-2.5 text-center w-28 bg-gray-50 sticky top-0 z-10">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                <tr v-for="(item, idx) in filteredBarges" :key="item.barge.id" class="hover:bg-gray-50 transition-colors">
                                    <td class="px-3 py-2.5 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                    <td class="px-3 py-2.5 font-bold text-gray-900">{{ item.barge.name }}</td>
                                    <td class="px-3 py-2.5">
                                        <span v-if="item.barge.config?.orderNo" class="px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-black whitespace-nowrap">
                                            {{ item.barge.config.orderNo }}
                                        </span>
                                        <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                    </td>
                                    <td class="px-3 py-2.5 text-center text-gray-700">
                                        {{ item.barge.config?.tonnage !== undefined ? item.barge.config.tonnage.toLocaleString() : '-' }}
                                    </td>
                                    <td class="px-3 py-2.5 text-center text-gray-700">
                                        {{ formatDateTime(item.barge.config?.arrivalTime) }}
                                    </td>
                                    <td class="px-3 py-2.5 text-center text-gray-700">
                                        {{ formatDateTime(item.barge.config?.departureTime) }}
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span 
                                            v-if="isDocComplete(item.barge.config || {})" 
                                            class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap"
                                        >
                                            <span class="material-symbols-outlined text-[11px]">task_alt</span> ĐỦ
                                        </span>
                                        <span 
                                            v-else 
                                            class="inline-flex px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap"
                                        >
                                            <span class="material-symbols-outlined text-[11px]">warning</span> THIẾU
                                        </span>

                                        <!-- GCN, DK, BH attachment popover -->
                                        <div v-if="(item.barge.config?.gcnImages?.length || 0) + (item.barge.config?.dkImages?.length || 0) + (item.barge.config?.bhImages?.length || 0) > 0" class="relative group inline-block ml-1 align-middle">
                                            <span class="material-symbols-outlined text-[13px] text-gray-400 hover:text-primary cursor-pointer select-none">attach_file</span>
                                            <div class="absolute hidden group-hover:block left-1/2 -translate-x-1/2 bottom-full mb-1 w-48 bg-white border border-primary/10 rounded-xl shadow-xl p-2.5 z-30 text-left text-[10px] pointer-events-auto">
                                                <div class="font-black text-primary border-b border-primary/5 pb-1 mb-1.5 uppercase select-none">Tệp đính kèm</div>
                                                
                                                <div v-if="item.barge.config?.gcnImages?.length" class="mb-1.5">
                                                    <div class="font-bold text-gray-400 uppercase text-[8px] mb-0.5 select-none">GCN Đăng ký</div>
                                                    <div class="space-y-0.5">
                                                        <a v-for="(img, idx) in item.barge.config.gcnImages" :key="idx" :href="img" target="_blank" class="block text-teal-600 hover:underline truncate font-medium">
                                                            📄 {{ extractFileName(img) }}
                                                        </a>
                                                    </div>
                                                </div>
                                                
                                                <div v-if="item.barge.config?.dkImages?.length" class="mb-1.5">
                                                    <div class="font-bold text-gray-400 uppercase text-[8px] mb-0.5 select-none">Đăng kiểm</div>
                                                    <div class="space-y-0.5">
                                                        <a v-for="(img, idx) in item.barge.config.dkImages" :key="idx" :href="img" target="_blank" class="block text-teal-600 hover:underline truncate font-medium">
                                                            📄 {{ extractFileName(img) }}
                                                        </a>
                                                    </div>
                                                </div>
                                                
                                                <div v-if="item.barge.config?.bhImages?.length">
                                                    <div class="font-bold text-gray-400 uppercase text-[8px] mb-0.5 select-none">Bảo hiểm</div>
                                                    <div class="space-y-0.5">
                                                        <a v-for="(img, idx) in item.barge.config.bhImages" :key="idx" :href="img" target="_blank" class="block text-teal-600 hover:underline truncate font-medium">
                                                            📄 {{ extractFileName(img) }}
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span 
                                            v-if="getCrewStatus(item.barge.config || {}).status === 'ĐỦ'" 
                                            class="inline-flex px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap cursor-help"
                                            :title="getCrewStatus(item.barge.config || {}).details"
                                        >
                                            <span class="material-symbols-outlined text-[11px]">how_to_reg</span> Phù hợp
                                        </span>
                                        <span 
                                            v-else 
                                            class="inline-flex px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[10px] font-bold items-center gap-1 whitespace-nowrap cursor-help"
                                            :title="getCrewStatus(item.barge.config || {}).details"
                                        >
                                            <span class="material-symbols-outlined text-[11px]">person_off</span> Không phù hợp
                                        </span>

                                        <!-- Crew attachment popover -->
                                        <div v-if="item.barge.config?.crewImages?.length" class="relative group inline-block ml-1 align-middle">
                                            <span class="material-symbols-outlined text-[13px] text-gray-400 hover:text-primary cursor-pointer select-none">attach_file</span>
                                            <div class="absolute hidden group-hover:block left-1/2 -translate-x-1/2 bottom-full mb-1 w-48 bg-white border border-primary/10 rounded-xl shadow-xl p-2.5 z-30 text-left text-[10px] pointer-events-auto">
                                                <div class="font-black text-primary border-b border-primary/5 pb-1 mb-1.5 uppercase select-none">Hồ sơ Thuyền viên</div>
                                                <div class="space-y-1">
                                                    <a v-for="(img, idx) in item.barge.config.crewImages" :key="idx" :href="img" target="_blank" class="block text-teal-600 hover:underline truncate font-medium">
                                                        📄 {{ extractFileName(img) }}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span v-if="item.barge.config?.ketluan === 'Cho phép'" class="inline-flex px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black">Cho phép</span>
                                        <span v-else-if="item.barge.config?.ketluan === 'Không cho phép'" class="inline-flex px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full text-[10px] font-black">Không cho phép</span>
                                        <span v-else-if="item.barge.config?.ketluan" class="text-gray-700 font-semibold">{{ item.barge.config.ketluan }}</span>
                                        <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span v-if="item.barge.config?.khaihethong === 'Có'" class="inline-flex px-2.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-[10px] font-black">Có</span>
                                        <span v-else-if="item.barge.config?.khaihethong === 'Không'" class="inline-flex px-2.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[10px] font-black">Không</span>
                                        <span v-else-if="item.barge.config?.khaihethong" class="text-gray-700 font-semibold">{{ item.barge.config.khaihethong }}</span>
                                        <span v-else class="text-gray-400 italic text-[10px]">-</span>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <button 
                                            @click="openEdit(item)" 
                                            class="px-3 py-1 bg-[#fcf8f9] hover:bg-primary hover:text-white border border-soft-pink text-primary font-black rounded-xl text-[10px] transition-all whitespace-nowrap shadow-sm"
                                        >
                                            Chỉnh sửa
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- CASE B: Edit Form Mode (activeBargeId !== null) -->
            <div v-else class="flex-grow flex flex-col min-h-0 bg-white">
                <!-- Header of Edit Panel -->
                <div class="border-b border-primary/10 px-6 py-4 flex items-center justify-between bg-slate-50 shrink-0">
                    <div>
                        <h3 class="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2 select-none">
                            <span class="material-symbols-outlined text-lg">edit_note</span>
                            Hồ sơ sà lan: {{ selectedBarge?.name }}
                        </h3>
                        <p class="text-[10px] text-gray-400 font-bold mt-0.5">
                            Thuộc tàu vận tải: <span class="text-primary font-black">{{ selectedVesselName }}</span>
                        </p>
                    </div>
                    <button 
                        @click="activeBargeId = null" 
                        class="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-gray-600 hover:text-primary font-bold rounded-xl text-xs flex items-center gap-1 transition-all border border-gray-200 shadow-sm"
                    >
                        <span class="material-symbols-outlined text-sm">arrow_back</span>
                        Quay lại Tổng quan
                    </button>
                </div>

                <!-- Form Panel (Scrollable, Two Columns) -->
                <div class="flex-grow overflow-y-auto p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0 custom-scrollbar">
                    <!-- Left: Administrative & Crew & Movement details -->
                    <div class="space-y-4">
                        <h4 class="text-xs font-black text-primary uppercase tracking-wider border-b border-dashed border-gray-200 pb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-base">settings</span>
                            Thông tin hành chính & Hành trình
                        </h4>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tên sà lan</label>
                                <input 
                                    v-model="editBargeName" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-black"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Mã lệnh</label>
                                <input 
                                    v-model="editOrderNo" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-black"
                                />
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tên hàng hóa</label>
                            <input 
                                v-model="editGoods" 
                                type="text" 
                                class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-semibold"
                            />
                        </div>

                        <!-- Crew members -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1 select-none">
                                <span class="material-symbols-outlined text-sm text-primary">groups</span>
                                Thông tin thuyền viên
                            </span>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Thuyền trưởng</label>
                                    <input v-model="editCaptain" type="text" placeholder="Họ và tên" class="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                        <span>Hạng thuyền trưởng</span>
                                        <span v-if="computedExpectedCaptainGrade" class="text-teal-600 font-bold normal-case">Yêu cầu: {{ computedExpectedCaptainGrade }}</span>
                                    </label>
                                    <select v-model="editCaptainGrade" class="w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32] cursor-pointer">
                                        <option value="">- Chọn hạng -</option>
                                        <option value="T1">T1</option>
                                        <option value="T2">T2</option>
                                        <option value="T3">T3</option>
                                    </select>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Máy trưởng</label>
                                    <input v-model="editChiefEngineer" type="text" placeholder="Họ và tên" class="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                        <span>Hạng máy trưởng</span>
                                        <span v-if="computedExpectedChiefEngineerGrade" class="text-teal-600 font-bold normal-case">Yêu cầu: {{ computedExpectedChiefEngineerGrade }}</span>
                                    </label>
                                    <select v-model="editChiefEngineerGrade" class="w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32] cursor-pointer">
                                        <option value="">- Chọn hạng -</option>
                                        <option value="M1">M1</option>
                                        <option value="M2">M2</option>
                                        <option value="M3">M3</option>
                                    </select>
                                </div>
                            </div>

                            <div class="space-y-1">
                                <label class="text-[8px] font-bold text-gray-400 uppercase flex items-center justify-between">
                                    <span>Thủy thủ</span>
                                    <span v-if="isComputedSailorRequired" class="text-teal-600 font-bold normal-case">Bắt buộc (Trọng tải ≥ 500 tấn)</span>
                                    <span v-else class="text-gray-400 font-normal normal-case">Không bắt buộc</span>
                                </label>
                                <textarea 
                                    v-model="editSailors" 
                                    rows="2" 
                                    placeholder="Danh sách thủy thủ đoàn..." 
                                    class="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32] resize-none"
                                ></textarea>
                            </div>

                            <div class="flex items-center gap-2 pt-1">
                                <input 
                                    v-model="editHasCrewBook" 
                                    type="checkbox" 
                                    id="crew_book_checkbox" 
                                    class="size-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                                />
                                <label for="crew_book_checkbox" class="text-xs font-black text-[#4a2c32] select-none cursor-pointer">
                                    Có sổ danh bạ thuyền viên
                                </label>
                            </div>

                            <!-- Crew File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-[8px] font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editCrewImages.length }})</span>
                                    <label class="cursor-pointer text-[9px] font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'crew')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editCrewImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editCrewImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-[9px] text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <a :href="img" target="_blank" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-[10px]">open_in_new</span> Xem
                                            </a>
                                            <button @click="removeImage(idx, 'crew')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-[10px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Arrival / Departure movement -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">schedule</span>
                                Thời gian cập / rời bến
                            </span>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Thời gian cập bến</label>
                                    <input v-model="editArrivalTime" type="datetime-local" class="w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Thời gian rời bến</label>
                                    <input v-model="editDepartureTime" type="datetime-local" class="w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                            </div>
                        </div>

                        <!-- Results & Declaration -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-3">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1 select-none">
                                <span class="material-symbols-outlined text-sm text-primary">fact_check</span>
                                Kết quả & Khai báo hệ thống
                            </span>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Kết quả</label>
                                    <select v-model="editKetluan" disabled class="w-full h-8 px-2 text-xs bg-gray-100 border border-gray-200 rounded-lg text-[#4a2c32] cursor-not-allowed font-black">
                                        <option value="Cho phép">Cho phép</option>
                                        <option value="Không cho phép">Không cho phép</option>
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Khai hệ thống</label>
                                    <select v-model="editKhaiHethong" class="w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#4a2c32] cursor-pointer font-bold">
                                        <option value="">- Chọn -</option>
                                        <option value="Có">Có</option>
                                        <option value="Không">Không</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Technical profiles (Structured Excel fields + Custom fields) -->
                    <div class="space-y-4 flex flex-col min-h-0">
                        <h4 class="text-xs font-black text-primary uppercase tracking-wider border-b border-dashed border-gray-200 pb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-base">engineering</span>
                            Hồ sơ kỹ thuật & Pháp lý (Excel)
                        </h4>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Trọng tải (Tấn)</label>
                                <input 
                                    v-model="editTonnage" 
                                    type="number" 
                                    placeholder="Ví dụ: 1276"
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[9px] font-black text-gray-400 uppercase tracking-widest">Công suất (HP)</label>
                                <input 
                                    v-model="editHp" 
                                    type="number" 
                                    placeholder="Ví dụ: 400"
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#4a2c32] font-bold"
                                />
                            </div>
                        </div>

                        <!-- GCN Đăng ký Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">feed</span>
                                Giấy chứng nhận (GCN) đăng ký
                            </span>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="space-y-1 col-span-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Số hiệu GCN</label>
                                    <input v-model="editGcnNo" type="text" placeholder="Nhập số hiệu" class="w-full h-7 px-2 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Ngày cấp</label>
                                    <input v-model="editGcnIssuedDate" type="date" class="w-full h-7 px-1.5 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between">
                                        <label class="text-[8px] font-bold text-gray-400 uppercase">Hạn hiệu lực</label>
                                        <label class="flex items-center gap-0.5 text-[8px] font-black text-teal-600 cursor-pointer select-none">
                                            <input type="checkbox" :checked="editGcnExpiryDate === 'Vô thời hạn'" @change="toggleGcnNoExpiry" class="size-2.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600" />
                                            <span>Vô hạn</span>
                                        </label>
                                    </div>
                                    <input 
                                        v-if="editGcnExpiryDate !== 'Vô thời hạn'"
                                        v-model="editGcnExpiryDate" 
                                        type="date" 
                                        class="w-full h-7 px-1.5 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" 
                                    />
                                    <div 
                                        v-else 
                                        class="w-full h-7 px-2 bg-teal-50 border border-teal-200 rounded-lg text-[10px] text-teal-700 font-bold flex items-center justify-center select-none"
                                    >
                                        Vô thời hạn
                                    </div>
                                </div>
                            </div>

                            <!-- GCN File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-[8px] font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editGcnImages.length }})</span>
                                    <label class="cursor-pointer text-[9px] font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'gcn')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editGcnImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editGcnImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-[9px] text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <a :href="img" target="_blank" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-[10px]">open_in_new</span> Xem
                                            </a>
                                            <button @click="removeImage(idx, 'gcn')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-[10px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Đăng kiểm Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">gavel</span>
                                Hồ sơ Đăng kiểm phương tiện
                            </span>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="space-y-1 col-span-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Số Đăng kiểm</label>
                                    <input v-model="editDkNo" type="text" placeholder="Nhập số DK" class="w-full h-7 px-2 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Ngày kiểm</label>
                                    <input v-model="editDkIssuedDate" type="date" class="w-full h-7 px-1.5 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Hạn hết hiệu lực</label>
                                    <input v-model="editDkExpiryDate" type="date" class="w-full h-7 px-1.5 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                            </div>

                            <!-- Đăng kiểm File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-[8px] font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editDkImages.length }})</span>
                                    <label class="cursor-pointer text-[9px] font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'dk')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editDkImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editDkImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-[9px] text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <a :href="img" target="_blank" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-[10px]">open_in_new</span> Xem
                                            </a>
                                            <button @click="removeImage(idx, 'dk')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-[10px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Bảo hiểm Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">verified_user</span>
                                Bảo hiểm trách nhiệm dân sự
                            </span>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="space-y-1 col-span-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Số bảo hiểm</label>
                                    <input v-model="editBhNo" type="text" placeholder="Nhập số BH" class="w-full h-7 px-2 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Ngày cấp</label>
                                    <input v-model="editBhIssuedDate" type="date" class="w-full h-7 px-1.5 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[8px] font-bold text-gray-400 uppercase">Hạn bảo hiểm</label>
                                    <input v-model="editBhExpiryDate" type="date" class="w-full h-7 px-1.5 text-[10px] bg-white border border-gray-200 rounded-lg text-[#4a2c32]" />
                                </div>
                            </div>

                            <!-- Bảo hiểm File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-[8px] font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editBhImages.length }})</span>
                                    <label class="cursor-pointer text-[9px] font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'bh')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editBhImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editBhImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-[9px] text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <a :href="img" target="_blank" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-[10px]">open_in_new</span> Xem
                                            </a>
                                            <button @click="removeImage(idx, 'bh')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-[10px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Custom Info Fields -->
                        <div class="flex-grow flex flex-col min-h-0 gap-2">
                            <div class="flex items-center justify-between border-b border-gray-200 pb-1 shrink-0">
                                <span class="text-[10px] font-black text-[#4a2c32] uppercase tracking-wider flex items-center gap-1">
                                    <span class="material-symbols-outlined text-sm text-primary">note_add</span>
                                    Thông số phụ khác (Tự chọn)
                                </span>
                                <button 
                                    @click="addCustomMeta"
                                    class="text-[9px] font-black text-primary hover:underline uppercase flex items-center gap-0.5"
                                >
                                    <span class="material-symbols-outlined text-xs">add</span> Thêm ô nhập
                                </button>
                            </div>
                            
                            <div class="flex-1 overflow-y-auto space-y-2 max-h-44 pr-1">
                                <div v-if="customMetas.length === 0" class="text-center py-4 text-gray-400 text-[10px] italic">Chưa có thông số tự chọn nào.</div>
                                <div v-for="(meta, idx) in customMetas" :key="idx" class="flex gap-2 items-center">
                                    <input v-model="meta.key" placeholder="Tên thông số" class="flex-1 h-7 px-2 text-[10px] bg-slate-50 border border-gray-200 rounded-lg text-[#4a2c32]" />
                                    <input v-model="meta.value" placeholder="Giá trị" class="flex-1 h-7 px-2 text-[10px] bg-slate-50 border border-gray-200 rounded-lg text-[#4a2c32]" />
                                    <button @click="removeCustomMeta(idx)" class="size-7 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center border border-gray-200 shrink-0">
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-8 py-5 border-t border-primary/10 flex items-center justify-end gap-3 bg-slate-50 shrink-0">
                    <button 
                        @click="activeBargeId = null"
                        class="h-9 px-6 bg-white hover:bg-gray-150 text-[#4a2c32] font-black rounded-xl text-xs active:scale-95 transition-all border border-gray-200"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="saveProfile"
                        :disabled="saving"
                        class="h-9 px-6 bg-primary hover:bg-primary-dark text-white font-black rounded-xl text-xs active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-primary/10 disabled:opacity-50"
                    >
                        <span v-if="saving" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-sm">save</span>
                        Lưu hồ sơ
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-scale-up {
    animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-fade-in {
    animation: fadeIn 0.15s ease-out forwards;
}

@keyframes scaleUp {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
