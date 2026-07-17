<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { WeighbridgeService, type Vessel, type Barge, type BargeConfig } from '@/services/excel/WeighbridgeService';
import { StorageService } from '@/services/storage/StorageService';
import { useToast } from '@/composables/useToast';
import { LogService } from '../../services/storage/LogService';
import { authStore, hasDetailPermission } from '@/stores/auth';

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

// Split date/time refs for 24h time input
const editArrivalDate = ref('');
const editArrivalTimeStr = ref('');
const editDepartureDate = ref('');
const editDepartureTimeStr = ref('');

// Sync split refs -> combined ISO string
watch([editArrivalDate, editArrivalTimeStr], () => {
    if (editArrivalDate.value) {
        const t = editArrivalTimeStr.value.trim() || '00:00';
        editArrivalTime.value = `${editArrivalDate.value}T${t}`;
    } else {
        editArrivalTime.value = '';
    }
});
watch([editDepartureDate, editDepartureTimeStr], () => {
    if (editDepartureDate.value) {
        const t = editDepartureTimeStr.value.trim() || '00:00';
        editDepartureTime.value = `${editDepartureDate.value}T${t}`;
    } else {
        editDepartureTime.value = '';
    }
});
const editKhaiHethong = ref('');
const editLastPort = ref('');
const activeSite = ref<'NguyenNgoc' | 'PhuMy'>('NguyenNgoc');
const isSiteDropdownOpen = ref(false);
const siteDropdownRef = ref<HTMLElement | null>(null);
const selectSite = (site: 'NguyenNgoc' | 'PhuMy') => {
    activeSite.value = site;
    activeBargeId.value = null;
    isSiteDropdownOpen.value = false;
};
const isCaptainGradeDropdownOpen = ref(false);
const isChiefEngineerGradeDropdownOpen = ref(false);
const isKhaiHethongDropdownOpen = ref(false);

const captainGradeDropdownRef = ref<HTMLElement | null>(null);
const chiefEngineerGradeDropdownRef = ref<HTMLElement | null>(null);
const khaiHethongDropdownRef = ref<HTMLElement | null>(null);

const selectCaptainGrade = (grade: string) => {
    editCaptainGrade.value = grade;
    isCaptainGradeDropdownOpen.value = false;
};

const selectChiefEngineerGrade = (grade: string) => {
    editChiefEngineerGrade.value = grade;
    isChiefEngineerGradeDropdownOpen.value = false;
};

const selectKhaiHethong = (status: string) => {
    editKhaiHethong.value = status;
    isKhaiHethongDropdownOpen.value = false;
};
const showAddBargeModal = ref(false);
const newBargeName = ref('');
const editGcnImages = ref<string[]>([]);
const editDkImages = ref<string[]>([]);
const editBhImages = ref<string[]>([]);
const editCrewImages = ref<string[]>([]);

const previewImageUrl = ref<string | null>(null);

const activePopover = ref<{ bargeId: number; type: 'doc' | 'crew' } | null>(null);

const expandedVesselIds = ref<Record<number, boolean>>({});

const isOnline = ref(navigator.onLine);
const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine;
};

const togglePopover = (bargeId: number, type: 'doc' | 'crew') => {
    if (activePopover.value && activePopover.value.bargeId === bargeId && activePopover.value.type === type) {
        activePopover.value = null;
    } else {
        activePopover.value = { bargeId, type };
    }
};

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
                const bSite = b.config?.site || 'NguyenNgoc';
                const isPhuMy = bSite === 'PhuMy' || v.name === 'KHU VỰC PHÚ MỸ';
                
                if (activeSite.value === 'PhuMy' && isPhuMy) {
                    list.push({
                        barge: b,
                        vesselName: v.name
                    });
                } else if (activeSite.value === 'NguyenNgoc' && !isPhuMy) {
                    list.push({
                        barge: b,
                        vesselName: v.name
                    });
                }
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

const checkExpiryStatus = (expiryDateStr?: string): string => {
    if (!expiryDateStr) return '';
    if (expiryDateStr === 'Vô thời hạn') return 'CÒN HẠN';
    const expDate = parseLocalDate(expiryDateStr);
    if (!expDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const compareDate = new Date(expDate);
    compareDate.setHours(0, 0, 0, 0);
    
    return compareDate.getTime() < today.getTime() ? 'HẾT HẠN' : 'CÒN HẠN';
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
        vessels.value.forEach(v => {
            if (expandedVesselIds.value[v.id] === undefined) {
                expandedVesselIds.value[v.id] = true;
            }
        });
    } catch (e) {
        console.error('Loi tai danh sach:', e);
        addToast('Loi khi tai danh sach phuong tien!', 'error');
    } finally {
        loading.value = false;
    }
}

const addPhuMyBarge = async () => {
    if (authStore.role !== 'admin' && !hasDetailPermission('vehicles', 'veh_barge_profile')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    const name = newBargeName.value.trim().toUpperCase();
    if (!name) {
        addToast('Vui lòng nhập tên sà lan!', 'info');
        return;
    }
    
    loading.value = true;
    try {
        // Find or create the 'KHU VỰC PHÚ MỸ' vessel
        let pmVessel = vessels.value.find(v => v.name === 'KHU VỰC PHÚ MỸ');
        let vesselId: number;
        if (pmVessel) {
            vesselId = pmVessel.id;
        } else {
            const newV = await WeighbridgeService.createVessel('KHU VỰC PHÚ MỸ');
            if (newV) {
                vesselId = newV.id;
            } else {
                throw new Error('Không thể tạo tàu KHU VỰC PHÚ MỸ');
            }
        }
        
        // Create the sà lan without an order number
        const data = await WeighbridgeService.createBarge(vesselId, name, '');
        if (data) {
            // Update config site to 'PhuMy' and ensure orderNo is empty
            const updatedConfig = {
                ...(data.config || {}),
                site: 'PhuMy',
                orderNo: ''
            };
            await WeighbridgeService.updateBargeConfig(data.id, updatedConfig);
            
            showAddBargeModal.value = false;
            newBargeName.value = '';
            
            await loadData();
            addToast(`Đã thêm sà lan Phú Mỹ: ${name}`, 'success');
        } else {
            addToast('Không thể tạo sà lan mới!', 'error');
        }
    } catch (e) {
        console.error('Lỗi khi tạo sà lan Phú Mỹ:', e);
        addToast('Lỗi khi thêm sà lan Phú Mỹ!', 'error');
    } finally {
        loading.value = false;
    }
};

const deletePhuMyBarge = async (barge: Barge) => {
    if (authStore.role !== 'admin' && !hasDetailPermission('vehicles', 'veh_barge_profile', 'delete')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa sà lan "${barge.name}"?`)) return;
    
    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteBarge(barge.id);
        if (success) {
            addToast(`Đã xóa sà lan: ${barge.name}`, 'success');
            await LogService.logAction('Xóa sà lan', 'Xóa hồ sơ sà lan: ' + barge.name);
            await loadData();
        } else {
            addToast('Không thể xóa sà lan!', 'error');
        }
    } catch (e) {
        console.error('Lỗi khi xóa sà lan:', e);
        addToast('Lỗi khi xóa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};



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
    // Populate split date/time refs from combined ISO strings
    if (editArrivalTime.value && editArrivalTime.value.includes('T')) {
        const parts = editArrivalTime.value.split('T');
        editArrivalDate.value = parts[0] || '';
        editArrivalTimeStr.value = parts[1] ? parts[1].substring(0, 5) : '';
    } else {
        editArrivalDate.value = '';
        editArrivalTimeStr.value = '';
    }
    if (editDepartureTime.value && editDepartureTime.value.includes('T')) {
        const parts2 = editDepartureTime.value.split('T');
        editDepartureDate.value = parts2[0] || '';
        editDepartureTimeStr.value = parts2[1] ? parts2[1].substring(0, 5) : '';
    } else {
        editDepartureDate.value = '';
        editDepartureTimeStr.value = '';
    }
    editLastPort.value = config.lastPort || '';
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
    if (authStore.role !== 'admin' && !hasDetailPermission('vehicles', 'veh_registry_insurance')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
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
            lastPort: editLastPort.value.trim(),
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
        await LogService.logAction('Lưu hồ sơ sà lan', 'Cập nhật hồ sơ: ' + editBargeName.value);
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
        const response = await fetch('/templates/NNP_QL_HO_SO_PHUONG_TIEN_CANG.xlsx?t=' + Date.now());
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
        
        const setCellFill = (cell: any, hexColor: string) => {
            cell.style = {
                ...cell.style,
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: hexColor }
                }
            };
        };

        const clearCellFill = (cell: any) => {
            cell.style = {
                ...cell.style,
                fill: {
                    type: 'pattern',
                    pattern: 'none'
                }
            };
        };

        // Store styles of row 2 from template
        const styleRow1 = getRowStyleTemplate(sheet1.getRow(2));
        const styleRow2 = getRowStyleTemplate(sheet2.getRow(2));
        
        // Populate Sheet 1 (Hồ sơ phương tiện)
        filteredBarges.value.forEach((item, index) => {
            const config = item.barge.config || {} as BargeConfig;
            const rowNum = index + 2;
            const row = sheet1.getRow(rowNum);
            
            applyRowStyleTemplate(row, styleRow1);
            
            for (let c = 5; c <= 13; c++) {
                clearCellFill(row.getCell(c));
            }
            
            row.getCell(1).value = index + 1; // STT
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
            
            const docStatus = isDocComplete(config) ? 'ĐỦ' : 'THIẾU';
            row.getCell(14).value = docStatus;
            
            row.getCell(15).value = checkExpiryStatus(config.gcnExpiryDate);
            row.getCell(16).value = checkExpiryStatus(config.dkExpiryDate);
            row.getCell(17).value = checkExpiryStatus(config.bhExpiryDate);
            
            row.getCell(18).value = config.captain || '';
            row.getCell(19).value = getExpectedCaptainGrade(config.tonnage || 0);
            row.getCell(20).value = config.chiefEngineer || '';
            row.getCell(21).value = getExpectedChiefEngineerGrade(config.hp || 0);
            row.getCell(22).value = config.sailors || '';
            row.getCell(23).value = config.hasCrewBook ? 'Có' : 'Không';
            
            const crew = getCrewStatus(config);
            const crewStatus = crew.status === 'ĐỦ' ? 'PHÙ HỢP' : 'KHÔNG PHÙ HỢP';
            row.getCell(24).value = crewStatus;
            
            row.getCell(25).value = config.khaihethong || '';
            row.getCell(26).value = config.notes || '';
            
            if (docStatus === 'THIẾU') {
                setCellFill(row.getCell(14), 'FFFF00');
            } else {
                clearCellFill(row.getCell(14));
            }
            if (crewStatus === 'KHÔNG PHÙ HỢP') {
                setCellFill(row.getCell(24), 'FFFF00');
            } else {
                clearCellFill(row.getCell(24));
            }
            if (config.khaihethong === 'Không') {
                setCellFill(row.getCell(25), 'B4C6E7');
            } else {
                clearCellFill(row.getCell(25));
            }
            row.commit();
        });
        
        // Delete extra template rows in Sheet 1
        const rowCount1 = sheet1.rowCount;
        if (rowCount1 > filteredBarges.value.length + 1) {
            sheet1.spliceRows(filteredBarges.value.length + 2, rowCount1 - (filteredBarges.value.length + 1));
        }

        // Populate Sheet 2 (Nhật ký vào, rời)
        filteredBarges.value.forEach((item, index) => {
            const config = item.barge.config || {} as BargeConfig;
            const rowNum = index + 2;
            const row = sheet2.getRow(rowNum);
            
            applyRowStyleTemplate(row, styleRow2);
            
            row.getCell(1).value = index + 1; // STT
            row.getCell(2).value = config.arrivalTime ? parseLocalDate(config.arrivalTime.split('T')[0]) : null;
            row.getCell(3).value = config.arrivalTime ? parseLocalTime(config.arrivalTime.split('T')[1]) : null;
            row.getCell(4).value = config.departureTime ? parseLocalDate(config.departureTime.split('T')[0]) : null;
            row.getCell(5).value = config.departureTime ? parseLocalTime(config.departureTime.split('T')[1]) : null;
            row.getCell(6).value = item.barge.name || '';
            row.getCell(7).value = config.gcnNo || '';
            row.getCell(8).value = config.goods || '';
            row.getCell(9).value = config.orderNo || '';
            
            const docStatus = isDocComplete(config) ? 'ĐỦ' : 'THIẾU';
            row.getCell(10).value = docStatus;
            
            const crew = getCrewStatus(config);
            const crewStatus = crew.status === 'ĐỦ' ? 'PHÙ HỢP' : 'KHÔNG PHÙ HỢP';
            row.getCell(11).value = crewStatus;
            
            const ketluanVal = (docStatus === 'ĐỦ' && crewStatus === 'PHÙ HỢP') ? "CHO PHÉP" : "KHÔNG CHO PHÉP";
            row.getCell(12).value = ketluanVal;
            
            if (docStatus === 'THIẾU') {
                setCellFill(row.getCell(10), 'FFFF00');
            } else {
                clearCellFill(row.getCell(10));
            }
            
            clearCellFill(row.getCell(11));

            if (ketluanVal === 'KHÔNG CHO PHÉP') {
                setCellFill(row.getCell(12), 'FFFF00');
            } else {
                clearCellFill(row.getCell(12));
            }
            row.commit();
        });

        // Delete extra template rows in Sheet 2
        const rowCount2 = sheet2.rowCount;
        if (rowCount2 > filteredBarges.value.length + 1) {
            sheet2.spliceRows(filteredBarges.value.length + 2, rowCount2 - (filteredBarges.value.length + 1));
        }

        // Populate Sheet 3 (Dashboard) with direct values
        const sheet3 = workbook.getWorksheet('Dashboard');
        if (sheet3) {
            const totalDocComplete = filteredBarges.value.filter(item => isDocComplete(item.barge.config || {})).length;
            const totalDocMissing = filteredBarges.value.length - totalDocComplete;
            
            sheet3.getRow(2).getCell(2).value = totalDocComplete;
            sheet3.getRow(3).getCell(2).value = totalDocMissing;
            sheet3.getRow(4).getCell(2).value = filteredBarges.value.length;
            
            sheet3.getRow(2).commit();
            sheet3.getRow(3).commit();
            sheet3.getRow(4).commit();
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
    if (authStore.role !== 'admin' && !hasDetailPermission('vehicles', 'veh_crew_profile')) {
        addToast('Bạn không có quyền thực hiện thao tác này!', 'error');
        return;
    }
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
            return (str === 'undefined' || str === 'null') ? '' : str;
        };
        
        const formatNumberCell = (cellValue: any): number | undefined => {
            if (cellValue === null || cellValue === undefined) return undefined;
            if (typeof cellValue === 'number') return cellValue;
            if (typeof cellValue === 'object' && typeof cellValue.result === 'number') return cellValue.result;
            const strVal = String(cellValue).trim();
            if (strVal === 'undefined' || strVal === 'null') return undefined;
            const parsed = parseFloat(strVal.replace(/[^0-9.-]/g, ''));
            return isNaN(parsed) ? undefined : parsed;
        };
        
        const formatStringCell = (cellValue: any): string => {
            if (cellValue === null || cellValue === undefined) return '';
            let val = '';
            if (typeof cellValue === 'object' && cellValue.result !== undefined) {
                val = String(cellValue.result).trim();
            } else {
                val = String(cellValue).trim();
            }
            return (val === 'undefined' || val === 'null') ? '' : val;
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

const handleOutsideClick = (event: MouseEvent) => {
    activePopover.value = null;
    if (isSiteDropdownOpen.value && siteDropdownRef.value && !siteDropdownRef.value.contains(event.target as Node)) {
        isSiteDropdownOpen.value = false;
    }
    if (isCaptainGradeDropdownOpen.value && captainGradeDropdownRef.value && !captainGradeDropdownRef.value.contains(event.target as Node)) {
        isCaptainGradeDropdownOpen.value = false;
    }
    if (isChiefEngineerGradeDropdownOpen.value && chiefEngineerGradeDropdownRef.value && !chiefEngineerGradeDropdownRef.value.contains(event.target as Node)) {
        isChiefEngineerGradeDropdownOpen.value = false;
    }
    if (isKhaiHethongDropdownOpen.value && khaiHethongDropdownRef.value && !khaiHethongDropdownRef.value.contains(event.target as Node)) {
        isKhaiHethongDropdownOpen.value = false;
    }
};

onMounted(() => {
    loadData();
    window.addEventListener('barge-config-updated', loadData);
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
});

onUnmounted(() => {
    window.removeEventListener('barge-config-updated', loadData);
    window.removeEventListener('click', handleOutsideClick);
    window.removeEventListener('online', updateOnlineStatus);
    window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<template>
    <div class="flex-grow flex overflow-hidden gap-4 p-4 h-full bg-transparent font-display text-left justify-center">
        <!-- Details or Master Overview List -->
        <div class="flex-grow flex flex-col h-full min-w-0 max-w-[1500px] mx-auto gap-4 overflow-hidden">
            
            <!-- CASE A: Overview Mode (activeBargeId === null) -->
            <div v-if="activeBargeId === null" class="flex-grow flex flex-col gap-4 min-h-0">
                <!-- Welcome Header banner -->
                <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-4 shrink-0">
                    <div>
                        <div class="text-xs uppercase font-black tracking-widest text-primary mb-0.5">Hệ thống quản lý hồ sơ phương tiện</div>
                        <h1 class="text-base font-black text-[#1e293b] flex items-center gap-1.5 select-none">
                            Báo cáo tổng quan hệ thống hồ sơ phương tiện sà lan
                        </h1>
                    </div>
                    
                    <!-- Tabs site switcher (Custom Dropdown) -->
                    <div ref="siteDropdownRef" class="relative min-w-[190px]">
                        <button 
                            @click="isSiteDropdownOpen = !isSiteDropdownOpen"
                            class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-black focus:outline-none text-left flex items-center text-gray-700 shadow-sm hover:border-gray-300 transition-colors select-none"
                        >
                            <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">
                                {{ activeSite === 'NguyenNgoc' ? 'sailing' : 'location_on' }}
                            </span>
                            <span>{{ activeSite === 'NguyenNgoc' ? 'Cảng Nguyên Ngọc' : 'Khu vực Phú Mỹ' }}</span>
                            <span 
                                class="material-symbols-outlined absolute right-3 text-gray-400 text-sm transition-transform duration-200"
                                :class="{ 'rotate-180': isSiteDropdownOpen }"
                            >
                                expand_more
                            </span>
                        </button>
                        
                        <!-- Dropdown list -->
                        <div 
                            v-if="isSiteDropdownOpen"
                            class="absolute right-0 top-full mt-1.5 w-full bg-white border border-gray-150 rounded shadow-lg py-1 z-50 overflow-hidden"
                        >
                            <div 
                                @click="selectSite('NguyenNgoc')"
                                :class="['px-3 py-2 text-xs font-black flex items-center gap-2 cursor-pointer transition-colors select-none', activeSite === 'NguyenNgoc' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                            >
                                <span class="material-symbols-outlined text-sm">sailing</span>
                                Cảng Nguyên Ngọc
                            </div>
                            <div 
                                @click="selectSite('PhuMy')"
                                :class="['px-3 py-2 text-xs font-black flex items-center gap-2 cursor-pointer transition-colors select-none', activeSite === 'PhuMy' ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                            >
                                <span class="material-symbols-outlined text-sm">location_on</span>
                                Khu vực Phú Mỹ
                            </div>
                        </div>
                    </div>
                </div>


                <!-- Table Card Container -->
                <div class="flex-grow flex flex-col bg-white rounded-[24px] border border-primary/5 overflow-hidden shadow-sm min-h-0">
                <div class="border-b border-primary/10 px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                    <!-- Left: Search input -->
                    <div class="relative w-full sm:max-w-xs">
                        <span class="material-symbols-outlined text-gray-400 text-sm absolute left-3 top-1/2 -translate-y-1/2 select-none">search</span>
                        <input 
                            v-model="searchQuery" 
                            type="text" 
                            placeholder="Tìm sà lan, tàu, chủ hàng..." 
                            class="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-semibold"
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
                        <!-- Add Barge (Only for Phu My area) -->
                        <button 
                            v-if="activeSite === 'PhuMy'"
                            @click="newBargeName = ''; showAddBargeModal = true"
                            class="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/10 shrink-0"
                            title="Tạo sà lan mới thuộc khu vực Phú Mỹ"
                        >
                            <span class="material-symbols-outlined text-sm">add</span>
                            Thêm sà lan mới
                        </button>
                        <button v-if="authStore.role === 'admin' || hasDetailPermission('vehicles', 'veh_barge_profile', 'create')"
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
                        <table class="w-full text-left border-collapse text-xs font-semibold whitespace-nowrap">
                            <thead>
                                <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                    <th class="px-3 py-2.5 w-12 text-center bg-gray-50 sticky top-0 z-10">STT</th>
                                    <th class="px-3 py-2.5 bg-gray-50 sticky top-0 z-10">Tên sà lan</th>
                                    <th v-if="activeSite === 'NguyenNgoc'" class="px-3 py-2.5 bg-gray-50 sticky top-0 z-10">Số lệnh</th>
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
                            <tbody class="divide-y divide-gray-100 text-[#1e293b]/90">
                                <tr v-for="(item, idx) in filteredBarges" :key="item.barge.id" class="hover:bg-gray-50 transition-colors">
                                    <td class="px-3 py-2.5 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                    <td class="px-3 py-2.5 font-bold text-gray-900">{{ item.barge.name }}</td>
                                    <td v-if="activeSite === 'NguyenNgoc'" class="px-3 py-2.5">
                                        <span v-if="item.barge.config?.orderNo" class="px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-xs font-black whitespace-nowrap">
                                            {{ item.barge.config.orderNo }}
                                        </span>
                                        <span v-else class="text-gray-400 italic text-xs">-</span>
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
                                            class="inline-flex text-teal-600 text-xs font-bold whitespace-nowrap"
                                        >
                                            Đủ
                                        </span>
                                        <span 
                                            v-else 
                                            class="inline-flex text-rose-600 text-xs font-bold whitespace-nowrap"
                                        >
                                            Thiếu
                                        </span>

                                        <!-- GCN, DK, BH attachment popover -->
                                        <div v-if="(item.barge.config?.gcnImages?.length || 0) + (item.barge.config?.dkImages?.length || 0) + (item.barge.config?.bhImages?.length || 0) > 0" class="relative inline-block ml-1 align-middle">
                                             <span 
                                                 class="material-symbols-outlined text-[13px] hover:text-primary cursor-pointer select-none transition-colors"
                                                 :class="activePopover?.bargeId === item.barge.id && activePopover?.type === 'doc' ? 'text-primary font-bold' : 'text-gray-400'"
                                                 @click.stop="togglePopover(item.barge.id, 'doc')"
                                             >
                                                 attach_file
                                             </span>
                                             <div 
                                                 v-if="activePopover?.bargeId === item.barge.id && activePopover?.type === 'doc'"
                                                 class="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-60 bg-white border border-primary/10 rounded shadow-xl p-3 z-30 text-left text-xs pointer-events-auto"
                                                 @click.stop
                                             >
                                                <div class="font-black text-primary border-b border-primary/5 pb-1 mb-2 uppercase select-none">Tệp đính kèm</div>
                                                
                                                <div v-if="item.barge.config?.gcnImages?.length" class="mb-2">
                                                    <div class="font-bold text-gray-400 uppercase text-xs mb-1 select-none">GCN Đăng ký</div>
                                                    <div class="grid grid-cols-4 gap-1.5">
                                                        <div 
                                                            v-for="(img, idx) in item.barge.config.gcnImages" 
                                                            :key="idx"
                                                            class="relative aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm hover:shadow hover:border-teal-500 transition-all duration-200 cursor-pointer group/thumb"
                                                            @click="previewImageUrl = img"
                                                            :title="extractFileName(img)"
                                                        >
                                                            <img :src="img" class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110" />
                                                            <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                                <span class="material-symbols-outlined text-xs text-white font-bold">visibility</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div v-if="item.barge.config?.dkImages?.length" class="mb-2">
                                                    <div class="font-bold text-gray-400 uppercase text-xs mb-1 select-none">Đăng kiểm</div>
                                                    <div class="grid grid-cols-4 gap-1.5">
                                                        <div 
                                                            v-for="(img, idx) in item.barge.config.dkImages" 
                                                            :key="idx"
                                                            class="relative aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm hover:shadow hover:border-teal-500 transition-all duration-200 cursor-pointer group/thumb"
                                                            @click="previewImageUrl = img"
                                                            :title="extractFileName(img)"
                                                        >
                                                            <img :src="img" class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110" />
                                                            <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                                <span class="material-symbols-outlined text-xs text-white font-bold">visibility</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div v-if="item.barge.config?.bhImages?.length">
                                                    <div class="font-bold text-gray-400 uppercase text-xs mb-1 select-none">Bảo hiểm</div>
                                                    <div class="grid grid-cols-4 gap-1.5">
                                                        <div 
                                                            v-for="(img, idx) in item.barge.config.bhImages" 
                                                            :key="idx"
                                                            class="relative aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm hover:shadow hover:border-teal-500 transition-all duration-200 cursor-pointer group/thumb"
                                                            @click="previewImageUrl = img"
                                                            :title="extractFileName(img)"
                                                        >
                                                            <img :src="img" class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110" />
                                                            <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                                <span class="material-symbols-outlined text-xs text-white font-bold">visibility</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span 
                                            v-if="getCrewStatus(item.barge.config || {}).status === 'ĐỦ'" 
                                            class="inline-flex text-teal-600 text-xs font-bold whitespace-nowrap cursor-help"
                                            :title="getCrewStatus(item.barge.config || {}).details"
                                        >
                                            Phù hợp
                                        </span>
                                        <span 
                                            v-else 
                                            class="inline-flex text-rose-600 text-xs font-bold whitespace-nowrap cursor-help"
                                            :title="getCrewStatus(item.barge.config || {}).details"
                                        >
                                            Không phù hợp
                                        </span>

                                        <!-- Crew attachment popover -->
                                        <div v-if="item.barge.config?.crewImages?.length" class="relative inline-block ml-1 align-middle">
                                            <span 
                                                class="material-symbols-outlined text-[13px] hover:text-primary cursor-pointer select-none transition-colors"
                                                :class="activePopover?.bargeId === item.barge.id && activePopover?.type === 'crew' ? 'text-primary font-bold' : 'text-gray-400'"
                                                @click.stop="togglePopover(item.barge.id, 'crew')"
                                            >
                                                attach_file
                                            </span>
                                            <div 
                                                v-if="activePopover?.bargeId === item.barge.id && activePopover?.type === 'crew'"
                                                class="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-60 bg-white border border-primary/10 rounded shadow-xl p-3 z-30 text-left text-xs pointer-events-auto"
                                                @click.stop
                                            >
                                                <div class="font-black text-primary border-b border-primary/5 pb-1 mb-2 uppercase select-none">Hồ sơ Thuyền viên</div>
                                                <div class="grid grid-cols-4 gap-1.5">
                                                    <div 
                                                        v-for="(img, idx) in item.barge.config.crewImages" 
                                                        :key="idx"
                                                        class="relative aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm hover:shadow hover:border-teal-500 transition-all duration-200 cursor-pointer group/thumb"
                                                        @click="previewImageUrl = img"
                                                        :title="extractFileName(img)"
                                                    >
                                                        <img :src="img" class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110" />
                                                        <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span class="material-symbols-outlined text-xs text-white font-bold">visibility</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span v-if="isDocComplete(item.barge.config || {}) && getCrewStatus(item.barge.config || {}).status === 'ĐỦ'" class="inline-flex text-emerald-600 text-xs font-bold">Cho phép</span>
                                        <span v-else class="inline-flex text-rose-600 text-xs font-bold">Không cho phép</span>
                                    </td>
                                    <td class="px-3 py-2.5 text-center">
                                        <span v-if="item.barge.config?.khaihethong === 'Có'" class="inline-flex text-blue-600 text-xs font-bold">Có</span>
                                        <span v-else-if="item.barge.config?.khaihethong === 'Không'" class="inline-flex text-amber-600 text-xs font-bold">Không</span>
                                        <span v-else-if="item.barge.config?.khaihethong" class="text-gray-700 font-bold text-xs">{{ item.barge.config.khaihethong }}</span>
                                        <span v-else class="text-gray-400 italic text-xs">-</span>
                                    </td>
                                    <td class="px-3 py-2.5 text-center flex items-center justify-center gap-1.5">
                                        <button 
                                            @click="openEdit(item)"
                                            class="size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95"
                                            title="Chỉnh sửa hồ sơ"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">edit</span>
                                        </button>
                                        <button 
                                            v-if="activeSite === 'PhuMy'" 
                                            @click="deletePhuMyBarge(item.barge)" 
                                            class="size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95"
                                            title="Xóa sà lan"
                                        >
                                            <span class="material-symbols-outlined text-[12px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

            <!-- CASE B: Edit Form Mode (activeBargeId !== null) -->
            <div v-else class="flex-grow flex flex-col min-h-0 bg-white rounded-[24px] border border-primary/5 overflow-hidden shadow-sm">
                <!-- Header of Edit Panel -->
                <div class="border-b border-primary/10 px-6 py-4 flex items-center justify-between bg-slate-50 shrink-0">
                    <div>
                        <h3 class="text-base font-black text-primary uppercase tracking-wider flex items-center gap-2 select-none">
                            <span class="material-symbols-outlined text-lg">edit_note</span>
                            Hồ sơ sà lan: {{ selectedBarge?.name }}
                        </h3>
                        <p class="text-xs text-gray-400 font-bold mt-0.5">
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
                        
                        <div class="grid gap-4" :class="activeSite === 'NguyenNgoc' ? 'grid-cols-2' : 'grid-cols-1'">
                            <div class="space-y-1">
                                <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Tên sà lan</label>
                                <input 
                                    v-model="editBargeName" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-black"
                                />
                            </div>
                            <div v-if="activeSite === 'NguyenNgoc'" class="space-y-1">
                                <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Mã lệnh</label>
                                <input 
                                    v-model="editOrderNo" 
                                    type="text" 
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-black"
                                />
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Tên hàng hóa</label>
                            <input 
                                v-model="editGoods" 
                                type="text" 
                                class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-semibold"
                            />
                        </div>

                        <div class="space-y-1">
                            <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Rời bến cuối cùng (Hàng hóa & Cảng trước đó)</label>
                            <input 
                                v-model="editLastPort" 
                                type="text" 
                                placeholder="Ví dụ: Cát đá - Cảng Thị Vải"
                                class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-semibold"
                            />
                        </div>

                        <!-- Crew members -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1 select-none">
                                <span class="material-symbols-outlined text-sm text-primary">groups</span>
                                Thông tin thuyền viên
                            </span>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Thuyền trưởng</label>
                                    <input v-model="editCaptain" type="text" placeholder="Họ và tên" class="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase flex items-center justify-between">
                                        <span>Hạng thuyền trưởng</span>
                                        <span v-if="computedExpectedCaptainGrade" class="text-teal-600 font-bold normal-case">Yêu cầu: {{ computedExpectedCaptainGrade }}</span>
                                    </label>
                                    <div ref="captainGradeDropdownRef" class="relative">
                                        <button 
                                            @click="isCaptainGradeDropdownOpen = !isCaptainGradeDropdownOpen"
                                            type="button"
                                            class="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none text-left flex items-center justify-between text-[#1e293b] select-none"
                                        >
                                            <span>{{ editCaptainGrade || '- Chọn hạng -' }}</span>
                                            <span 
                                                class="material-symbols-outlined text-gray-400 text-sm transition-transform duration-200"
                                                :class="{ 'rotate-180': isCaptainGradeDropdownOpen }"
                                            >
                                                expand_more
                                            </span>
                                        </button>
                                        <div 
                                            v-if="isCaptainGradeDropdownOpen"
                                            class="absolute left-0 top-full mt-1 w-full bg-white border border-gray-150 rounded shadow-lg py-1 z-50 overflow-hidden"
                                        >
                                            <div 
                                                @click="selectCaptainGrade('')"
                                                :class="['px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors select-none', !editCaptainGrade ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                                            >
                                                - Chọn hạng -
                                            </div>
                                            <div 
                                                v-for="grade in ['T1', 'T2', 'T3']"
                                                :key="grade"
                                                @click="selectCaptainGrade(grade)"
                                                :class="['px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors select-none', editCaptainGrade === grade ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                                            >
                                                {{ grade }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Máy trưởng</label>
                                    <input v-model="editChiefEngineer" type="text" placeholder="Họ và tên" class="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase flex items-center justify-between">
                                        <span>Hạng máy trưởng</span>
                                        <span v-if="computedExpectedChiefEngineerGrade" class="text-teal-600 font-bold normal-case">Yêu cầu: {{ computedExpectedChiefEngineerGrade }}</span>
                                    </label>
                                    <div ref="chiefEngineerGradeDropdownRef" class="relative">
                                        <button 
                                            @click="isChiefEngineerGradeDropdownOpen = !isChiefEngineerGradeDropdownOpen"
                                            type="button"
                                            class="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none text-left flex items-center justify-between text-[#1e293b] select-none"
                                        >
                                            <span>{{ editChiefEngineerGrade || '- Chọn hạng -' }}</span>
                                            <span 
                                                class="material-symbols-outlined text-gray-400 text-sm transition-transform duration-200"
                                                :class="{ 'rotate-180': isChiefEngineerGradeDropdownOpen }"
                                            >
                                                expand_more
                                            </span>
                                        </button>
                                        <div 
                                            v-if="isChiefEngineerGradeDropdownOpen"
                                            class="absolute left-0 top-full mt-1 w-full bg-white border border-gray-150 rounded shadow-lg py-1 z-50 overflow-hidden"
                                        >
                                            <div 
                                                @click="selectChiefEngineerGrade('')"
                                                :class="['px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors select-none', !editChiefEngineerGrade ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                                            >
                                                - Chọn hạng -
                                            </div>
                                            <div 
                                                v-for="grade in ['M1', 'M2', 'M3']"
                                                :key="grade"
                                                @click="selectChiefEngineerGrade(grade)"
                                                :class="['px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors select-none', editChiefEngineerGrade === grade ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                                            >
                                                {{ grade }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-1">
                                <label class="text-xs font-bold text-gray-400 uppercase flex items-center justify-between">
                                    <span>Thủy thủ</span>
                                    <span v-if="isComputedSailorRequired" class="text-teal-600 font-bold normal-case">Bắt buộc (Trọng tải ≥ 500 tấn)</span>
                                    <span v-else class="text-gray-400 font-normal normal-case">Không bắt buộc</span>
                                </label>
                                <textarea 
                                    v-model="editSailors" 
                                    rows="2" 
                                    placeholder="Danh sách thủy thủ đoàn..." 
                                    class="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg text-[#1e293b] resize-none"
                                ></textarea>
                            </div>

                            <div class="flex items-center gap-2 pt-1">
                                <input 
                                    v-model="editHasCrewBook" 
                                    type="checkbox" 
                                    id="crew_book_checkbox" 
                                    class="size-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                                />
                                <label for="crew_book_checkbox" class="text-xs font-black text-[#1e293b] select-none cursor-pointer">
                                    Có sổ danh bạ thuyền viên
                                </label>
                            </div>

                            <!-- Crew File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                        <span class="text-xs font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editCrewImages.length }})</span>
                                    <label class="cursor-pointer text-xs font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'crew')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editCrewImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editCrewImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-xs text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <button @click="previewImageUrl = img" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-xs">visibility</span> Xem
                                            </button>
                                            <button @click="removeImage(idx, 'crew')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Arrival / Departure movement -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">schedule</span>
                                Thời gian cập / rời bến
                            </span>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Thời gian cập bến</label>
                                    <div class="flex gap-1.5">
                                        <input v-model="editArrivalDate" type="date" class="flex-[3] min-w-0 h-8 px-2 text-xs bg-white border border-gray-200 rounded text-[#1e293b] focus:outline-none" />
                                        <input v-model="editArrivalTimeStr" type="time" class="flex-[2] min-w-0 h-8 px-2 text-xs bg-white border border-gray-200 rounded text-[#1e293b] text-center font-semibold focus:outline-none" />
                                    </div>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Thời gian rời bến</label>
                                    <div class="flex gap-1.5">
                                        <input v-model="editDepartureDate" type="date" class="flex-[3] min-w-0 h-8 px-2 text-xs bg-white border border-gray-200 rounded text-[#1e293b] focus:outline-none" />
                                        <input v-model="editDepartureTimeStr" type="time" class="flex-[2] min-w-0 h-8 px-2 text-xs bg-white border border-gray-200 rounded text-[#1e293b] text-center font-semibold focus:outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Results & Declaration -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-3">
                            <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1 select-none">
                                <span class="material-symbols-outlined text-sm text-primary">fact_check</span>
                                Kết quả & Khai báo hệ thống
                            </span>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Kết quả</label>
                                    <div 
                                        class="w-full h-8 px-2.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-black flex items-center text-gray-500 cursor-not-allowed select-none"
                                    >
                                        {{ editKetluan || 'Không cho phép' }}
                                    </div>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Khai hệ thống</label>
                                    <div ref="khaiHethongDropdownRef" class="relative">
                                        <button 
                                            @click="isKhaiHethongDropdownOpen = !isKhaiHethongDropdownOpen"
                                            type="button"
                                            class="w-full h-8 px-2.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none text-left flex items-center justify-between text-[#1e293b] select-none"
                                        >
                                            <span>{{ editKhaiHethong || '- Chọn -' }}</span>
                                            <span 
                                                class="material-symbols-outlined text-gray-400 text-sm transition-transform duration-200"
                                                :class="{ 'rotate-180': isKhaiHethongDropdownOpen }"
                                            >
                                                expand_more
                                            </span>
                                        </button>
                                        <div 
                                            v-if="isKhaiHethongDropdownOpen"
                                            class="absolute left-0 top-full mt-1 w-full bg-white border border-gray-150 rounded shadow-lg py-1 z-50 overflow-hidden"
                                        >
                                            <div 
                                                @click="selectKhaiHethong('')"
                                                :class="['px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors select-none', !editKhaiHethong ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                                            >
                                                - Chọn -
                                            </div>
                                            <div 
                                                v-for="status in ['Có', 'Không']"
                                                :key="status"
                                                @click="selectKhaiHethong(status)"
                                                :class="['px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors select-none', editKhaiHethong === status ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50']"
                                            >
                                                {{ status }}
                                            </div>
                                        </div>
                                    </div>
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
                                <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Trọng tải (Tấn)</label>
                                <input 
                                    v-model="editTonnage" 
                                    type="number" 
                                    placeholder="Ví dụ: 1276"
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-bold"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Công suất (HP)</label>
                                <input 
                                    v-model="editHp" 
                                    type="number" 
                                    placeholder="Ví dụ: 400"
                                    class="w-full h-8 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-bold"
                                />
                            </div>
                        </div>

                        <!-- GCN Đăng ký Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">feed</span>
                                Giấy chứng nhận (GCN) đăng ký
                            </span>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div class="space-y-1 col-span-1">
                                    <div class="h-4 flex items-center">
                                        <label class="text-xs font-bold text-gray-400 uppercase leading-none">Số hiệu GCN</label>
                                    </div>
                                    <input v-model="editGcnNo" type="text" placeholder="Nhập số hiệu" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <div class="h-4 flex items-center">
                                        <label class="text-xs font-bold text-gray-400 uppercase leading-none">Ngày cấp</label>
                                    </div>
                                    <input v-model="editGcnIssuedDate" type="date" class="w-full h-7 px-1.5 text-xs bg-white border border-gray-200 rounded text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <div class="flex items-center justify-between h-4">
                                        <label class="text-xs font-bold text-gray-400 uppercase leading-none">Hạn hiệu lực</label>
                                        <label class="flex items-center gap-0.5 text-xs font-black text-teal-600 cursor-pointer select-none">
                                            <input type="checkbox" :checked="editGcnExpiryDate === 'Vô thời hạn'" @change="toggleGcnNoExpiry" class="size-2.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600" />
                                            <span class="leading-none">Vô hạn</span>
                                        </label>
                                    </div>
                                    <input 
                                        v-if="editGcnExpiryDate !== 'Vô thời hạn'"
                                        v-model="editGcnExpiryDate" 
                                        type="date" 
                                        class="w-full h-7 px-1.5 text-xs bg-white border border-gray-200 rounded text-[#1e293b]" 
                                    />
                                    <div 
                                        v-else 
                                        class="w-full h-7 px-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-700 font-bold flex items-center justify-center select-none"
                                    >
                                        Vô thời hạn
                                    </div>
                                </div>
                            </div>

                            <!-- GCN File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editGcnImages.length }})</span>
                                    <label class="cursor-pointer text-xs font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'gcn')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editGcnImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editGcnImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-xs text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <button @click="previewImageUrl = img" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-xs">visibility</span> Xem
                                            </button>
                                            <button @click="removeImage(idx, 'gcn')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Đăng kiểm Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">gavel</span>
                                Hồ sơ Đăng kiểm phương tiện
                            </span>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div class="space-y-1 col-span-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Số Đăng kiểm</label>
                                    <input v-model="editDkNo" type="text" placeholder="Nhập số DK" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Ngày kiểm</label>
                                    <input v-model="editDkIssuedDate" type="date" class="w-full h-7 px-1.5 text-xs bg-white border border-gray-200 rounded text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Hạn hết hiệu lực</label>
                                    <input v-model="editDkExpiryDate" type="date" class="w-full h-7 px-1.5 text-xs bg-white border border-gray-200 rounded text-[#1e293b]" />
                                </div>
                            </div>

                            <!-- Đăng kiểm File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editDkImages.length }})</span>
                                    <label class="cursor-pointer text-xs font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'dk')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editDkImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editDkImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-xs text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <button @click="previewImageUrl = img" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-xs">visibility</span> Xem
                                            </button>
                                            <button @click="removeImage(idx, 'dk')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Bảo hiểm Group -->
                        <div class="p-3 bg-slate-50 rounded-2xl border border-gray-150 space-y-2">
                            <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm text-primary">verified_user</span>
                                Bảo hiểm trách nhiệm dân sự
                            </span>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div class="space-y-1 col-span-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Số bảo hiểm</label>
                                    <input v-model="editBhNo" type="text" placeholder="Nhập số BH" class="w-full h-7 px-2 text-xs bg-white border border-gray-200 rounded-lg text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Ngày cấp</label>
                                    <input v-model="editBhIssuedDate" type="date" class="w-full h-7 px-1.5 text-xs bg-white border border-gray-200 rounded text-[#1e293b]" />
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-gray-400 uppercase">Hạn bảo hiểm</label>
                                    <input v-model="editBhExpiryDate" type="date" class="w-full h-7 px-1.5 text-xs bg-white border border-gray-200 rounded text-[#1e293b]" />
                                </div>
                            </div>

                            <!-- Bảo hiểm File list and Upload -->
                            <div class="mt-2 pt-2 border-t border-dashed border-gray-150 space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-gray-400 uppercase">Hình ảnh đính kèm ({{ editBhImages.length }})</span>
                                    <label class="cursor-pointer text-xs font-black text-primary hover:text-primary/80 flex items-center gap-0.5 select-none">
                                        <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                                        Tải ảnh
                                        <input type="file" accept="image/*" @change="e => handleImageUpload(e, 'bh')" class="hidden" />
                                    </label>
                                </div>
                                <div v-if="editBhImages.length > 0" class="space-y-1">
                                    <div v-for="(img, idx) in editBhImages" :key="idx" class="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-100 text-xs text-gray-600">
                                        <span class="truncate max-w-[150px] font-medium" :title="extractFileName(img)">{{ extractFileName(img) }}</span>
                                        <div class="flex items-center gap-1.5">
                                            <button @click="previewImageUrl = img" class="text-teal-600 hover:underline font-bold flex items-center gap-0.5">
                                                <span class="material-symbols-outlined text-xs">visibility</span> Xem
                                            </button>
                                            <button @click="removeImage(idx, 'bh')" class="text-rose-600 hover:text-rose-800 font-bold flex items-center">
                                                <span class="material-symbols-outlined text-xs">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Custom Info Fields -->
                        <div class="flex-grow flex flex-col min-h-0 gap-2">
                            <div class="flex items-center justify-between border-b border-gray-200 pb-1 shrink-0">
                                <span class="text-xs font-black text-[#1e293b] uppercase tracking-wider flex items-center gap-1">
                                    <span class="material-symbols-outlined text-sm text-primary">note_add</span>
                                    Thông số phụ khác (Tự chọn)
                                </span>
                                <button 
                                    @click="addCustomMeta"
                                    class="text-xs font-black text-primary hover:underline uppercase flex items-center gap-0.5"
                                >
                                    <span class="material-symbols-outlined text-xs">add</span> Thêm ô nhập
                                </button>
                            </div>
                            
                            <div class="flex-1 overflow-y-auto space-y-2 max-h-44 pr-1">
                                <div v-if="customMetas.length === 0" class="text-center py-4 text-gray-400 text-xs italic">Chưa có thông số tự chọn nào.</div>
                                <div v-for="(meta, idx) in customMetas" :key="idx" class="flex gap-2 items-center">
                                    <input v-model="meta.key" placeholder="Tên thông số" class="flex-1 h-7 px-2 text-xs bg-slate-50 border border-gray-200 rounded-lg text-[#1e293b]" />
                                    <input v-model="meta.value" placeholder="Giá trị" class="flex-1 h-7 px-2 text-xs bg-slate-50 border border-gray-200 rounded-lg text-[#1e293b]" />
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
                        class="h-9 px-6 bg-white hover:bg-gray-150 text-[#1e293b] font-black rounded-xl text-xs active:scale-95 transition-all border border-gray-200"
                    >
                        Hủy
                    </button>
                    <button v-if="authStore.role === 'admin' || hasDetailPermission('vehicles', 'veh_registry_insurance', 'update')"
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
        
        <!-- Image Preview Modal -->
        <div v-if="previewImageUrl" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" @click="previewImageUrl = null">
            <div class="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2.5 flex flex-col items-center animate-scale-up" @click.stop>
                <button @click="previewImageUrl = null" class="absolute top-4 right-4 size-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
                <img :src="previewImageUrl" class="max-w-full max-h-[80vh] object-contain rounded-2xl" />
                <div class="mt-2 text-center text-xs font-black text-gray-700 truncate max-w-xs uppercase tracking-wider select-none">
                    {{ extractFileName(previewImageUrl) }}
                </div>
            </div>
        </div>
        
        <!-- Add Barge Modal -->
        <div v-if="showAddBargeModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div class="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl p-6 flex flex-col gap-4 animate-scale-up" @click.stop>
                <div class="flex items-center justify-between border-b border-gray-150 pb-3">
                    <h3 class="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-1.5 select-none">
                        <span class="material-symbols-outlined text-lg">add_box</span>
                        Thêm sà lan Phú Mỹ mới
                    </h3>
                    <button @click="showAddBargeModal = false" class="size-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors">
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div class="space-y-1">
                        <label class="text-xs font-black text-gray-400 uppercase tracking-widest">Tên sà lan *</label>
                        <input 
                            v-model="newBargeName" 
                            type="text" 
                            placeholder="Nhập tên sà lan..." 
                            class="w-full h-9 px-3 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary/50 text-[#1e293b] font-black placeholder:font-normal"
                            @keyup.enter="addPhuMyBarge"
                        />
                    </div>
                </div>
                
                <div class="flex items-center justify-end gap-2 border-t border-gray-150 pt-4 mt-2">
                    <button 
                        @click="showAddBargeModal = false"
                        class="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-all"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="addPhuMyBarge"
                        :disabled="loading"
                        class="px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span v-if="loading" class="material-symbols-outlined text-sm animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-sm">add</span>
                        Thêm mới
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
