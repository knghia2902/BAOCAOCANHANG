<script setup lang="ts">
import { ref, computed } from 'vue';

// Toast and notifications
const toast = ref<{ msg: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    toast.value = { msg, type };
    setTimeout(() => {
        if (toast.value?.msg === msg) toast.value = null;
    }, 4000);
};

// Files
const wlFile = ref<File | null>(null);
const templateFile = ref<File | null>(null);
const loading = ref(false);
const processing = ref(false);

// Extracted Data
interface VoyageOption {
    rawName: string;
    bargeName: string;
    totalXe: number;
    totalKg: number;
    weightKho: number;
    weightXaThang: number;
    minDate: Date | null;
    maxDate: Date | null;
    portOfLoading: string;
}

const detectedVoyages = ref<VoyageOption[]>([]);
const selectedVoyage = ref<string>('');

// Metadata extracted from Weight List
const extVessel = ref('');
const extCustomer = ref('');
const extCargo = ref('');

// Form inputs for BB
const soBienBan = ref('');
const chuHang = ref('');
const tenHang = ref('');
const tauQuocTe = ref('');
const tenSaLan = ref('');
const quocTich = ref('Việt Nam');
const cangNhan = ref('Cảng Nguyên Ngọc - TPHCM');
const cangGiao = ref('PHAO THIỀNG LIỀNG');
const soSeal = ref(14);
const soHam = ref('');

// Date and Time inputs
const dateIn = ref('');
const timeIn = ref('');
const dateInspection = ref('');
const timeInspection = ref('');
const dateCommenced = ref('');
const timeCommenced = ref('');
const dateCompleted = ref('');
const timeCompleted = ref('');
const dateDepart = ref('');
const timeDepart = ref('');

// Computed option details
const currentVoyageDetails = computed(() => {
    return detectedVoyages.value.find(v => v.rawName === selectedVoyage.value) || null;
});

// Helper: Parse date
function parseDateValue(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    const str = String(val).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    
    const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
        const day = parseInt(match[1] || '0');
        const month = parseInt(match[2] || '1') - 1;
        const year = parseInt(match[3] || '2000');
        return new Date(year, month, day);
    }
    return null;
}

// Helper: Format date/time to local strings
const formatDateToInput = (d: Date): string => d.toISOString().split('T')[0] || '';
const formatTimeToInput = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Parse Weight List Excel
async function handleWlUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    wlFile.value = file;
    loading.value = true;
    detectedVoyages.value = [];
    selectedVoyage.value = '';
    
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        // Extract metadata (Vessel, Customer, Cargo)
        let vessel = '';
        let customer = '';
        let cargo = '';

        const sheetsToScan = ['Truck XUẤT KHO', 'Truck XUẤT SALAN', 'EXPORT XUẤT KHO', 'WL XUẤT SALAN'];
        sheetsToScan.forEach(name => {
            const sheet = workbook.getWorksheet(name);
            if (!sheet) return;
            
            for (let r = 1; r <= 20; r++) {
                const row = sheet.getRow(r);
                if (!row) continue;
                const cellA = String(row.getCell(1).value || '').toLowerCase();
                if (cellA.includes('vessel') || cellA.includes('tàu')) {
                    const val = getCellValueString(row.getCell(3));
                    if (val && !vessel) vessel = val;
                }
                if (cellA.includes('customer') || cellA.includes('khách hàng')) {
                    const val = getCellValueString(row.getCell(3));
                    if (val && !customer) customer = val;
                }
                if (cellA.includes('cargo') || cellA.includes('hàng hóa')) {
                    const val = getCellValueString(row.getCell(3));
                    if (val && !cargo) cargo = val;
                }
            }
        });

        // Clean extracted values
        extVessel.value = vessel.replace(/^\((.*)\)$/, '$1').trim();
        extCustomer.value = customer.replace(/^CÔNG TY (CP|CỔ PHẦN)\s+/, '').trim();
        extCargo.value = cargo.replace(/^\((.*)\)$/, '$1').trim();

        // Initialize form parameters with defaults
        tauQuocTe.value = extVessel.value;
        chuHang.value = extCustomer.value;
        tenHang.value = extCargo.value;

        // Read BK SALAN to map barge names to ports
        const bargePortMap = new Map<string, string>();
        const bkSalanSheet = workbook.getWorksheet('BK SALAN');
        if (bkSalanSheet) {
            for (let r = 14; r <= bkSalanSheet.rowCount; r++) {
                const row = bkSalanSheet.getRow(r);
                if (!row) continue;
                const bargeName = getCellValueString(row.getCell(3)).trim();
                const port = getCellValueString(row.getCell(4)).trim();
                if (bargeName) {
                    // Mapped to uppercase for clean match
                    bargePortMap.set(bargeName.toUpperCase().replace(/[^A-Z0-9]/g, ''), port);
                }
            }
        }

        const getBargePort = (voyageStr: string): string => {
            const match = voyageStr.match(/([a-zA-ZđĐ]+-[a-zA-ZđĐ]+\s*\d+|[a-zA-ZđĐ]+\s*\d+)/);
            const bargeName = match ? match[0].toUpperCase() : voyageStr.toUpperCase();
            const key = bargeName.replace(/[^A-Z0-9]/g, '');
            return bargePortMap.get(key) || '';
        };

        // Group records by voyage
        const voyageMap = new Map<string, {
            xeCount: number;
            totalKg: number;
            weightKho: number;
            weightXaThang: number;
            dates: Date[];
        }>();

        const addRecord = (voyage: string, weight: number, dateVal: any, timeVal: any, isKho: boolean) => {
            const cleanVoyage = voyage.trim();
            if (!cleanVoyage) return;

            let parsedDate = parseDateValue(dateVal);
            if (parsedDate && timeVal) {
                const parsedTime = parseDateValue(timeVal);
                if (parsedTime) {
                    parsedDate = new Date(parsedDate.getTime());
                    parsedDate.setHours(parsedTime.getHours());
                    parsedDate.setMinutes(parsedTime.getMinutes());
                    parsedDate.setSeconds(parsedTime.getSeconds());
                }
            }

            if (!voyageMap.has(cleanVoyage)) {
                voyageMap.set(cleanVoyage, { xeCount: 0, totalKg: 0, weightKho: 0, weightXaThang: 0, dates: [] });
            }

            const data = voyageMap.get(cleanVoyage)!;
            data.xeCount += 1;
            data.totalKg += weight;
            if (isKho) data.weightKho += weight;
            else data.weightXaThang += weight;
            if (parsedDate) data.dates.push(parsedDate);
        };

        // 1. Truck XUẤT KHO
        const s1 = workbook.getWorksheet('Truck XUẤT KHO');
        if (s1) {
            for (let r = 18; r <= s1.rowCount; r++) {
                const row = s1.getRow(r);
                if (!row) continue;
                const voyage = getCellValueString(row.getCell(9));
                const weight = parseFloat(getCellValueString(row.getCell(7))) || 0;
                const dateVal = row.getCell(2).value;
                if (voyage) {
                    const port = getBargePort(voyage);
                    if (port.toLowerCase() === 'nguyên ngọc' || port.toLowerCase() === 'nguyen ngoc') {
                        continue;
                    }
                    addRecord(voyage, weight, dateVal, null, true);
                }
            }
        }

        // 2. Truck XUẤT SALAN
        const s2 = workbook.getWorksheet('Truck XUẤT SALAN');
        if (s2) {
            for (let r = 18; r <= s2.rowCount; r++) {
                const row = s2.getRow(r);
                if (!row) continue;
                const voyage = getCellValueString(row.getCell(9));
                const weight = parseFloat(getCellValueString(row.getCell(6))) || 0;
                const dateVal = row.getCell(7).value;
                if (voyage) {
                    const port = getBargePort(voyage);
                    if (port.toLowerCase() === 'nguyên ngọc' || port.toLowerCase() === 'nguyen ngoc') {
                        continue;
                    }
                    addRecord(voyage, weight, dateVal, null, false);
                }
            }
        }

        // 3. EXPORT XUẤT KHO
        const s3 = workbook.getWorksheet('EXPORT XUẤT KHO');
        if (s3) {
            for (let r = 19; r <= s3.rowCount; r++) {
                const row = s3.getRow(r);
                if (!row) continue;
                const voyage = getCellValueString(row.getCell(11));
                const weight = parseFloat(getCellValueString(row.getCell(7))) || 0;
                const dateVal = row.getCell(2).value;
                const timeVal = row.getCell(9).value;
                if (voyage) {
                    const port = getBargePort(voyage);
                    if (port.toLowerCase() !== 'nguyên ngọc' && port.toLowerCase() !== 'nguyen ngoc') {
                        continue;
                    }
                    addRecord(voyage, weight, dateVal, timeVal, true);
                }
            }
        }

        // 4. WL XUẤT SALAN
        const s4 = workbook.getWorksheet('WL XUẤT SALAN');
        if (s4) {
            for (let r = 17; r <= s4.rowCount; r++) {
                const row = s4.getRow(r);
                if (!row) continue;
                const voyage = getCellValueString(row.getCell(12));
                const weight = parseFloat(getCellValueString(row.getCell(7))) || 0;
                const dateVal = row.getCell(2).value;
                const timeVal = row.getCell(8).value;
                if (voyage) {
                    const port = getBargePort(voyage);
                    if (port.toLowerCase() !== 'nguyên ngọc' && port.toLowerCase() !== 'nguyen ngoc') {
                        continue;
                    }
                    addRecord(voyage, weight, dateVal, timeVal, false);
                }
            }
        }

        // Build Voyage Options
        const options: VoyageOption[] = [];
        voyageMap.forEach((data, rawName) => {
            // Extract clean barge name
            const match = rawName.match(/([a-zA-ZđĐ]+-[a-zA-ZđĐ]+\s*\d+|[a-zA-ZđĐ]+\s*\d+)/);
            const bargeName = match ? match[0].toUpperCase() : rawName;

            let minDate: Date | null = null;
            let maxDate: Date | null = null;
            if (data.dates.length > 0) {
                const times = data.dates.map(d => d.getTime());
                minDate = new Date(Math.min(...times));
                maxDate = new Date(Math.max(...times));
            }

            options.push({
                rawName,
                bargeName,
                totalXe: data.xeCount,
                totalKg: data.totalKg,
                weightKho: data.weightKho,
                weightXaThang: data.weightXaThang,
                minDate,
                maxDate,
                portOfLoading: getBargePort(rawName)
            });
        });

        // Sort options logically
        options.sort((a, b) => a.rawName.localeCompare(b.rawName, undefined, { numeric: true, sensitivity: 'base' }));
        detectedVoyages.value = options;

        if (options.length > 0 && options[0]) {
            selectedVoyage.value = options[0].rawName;
            applySelectedVoyage(options[0]);
            showToast(`Đã phân tích Weight List thành công, tìm thấy ${options.length} chuyến sà lan!`, 'success');
        } else {
            showToast('Không tìm thấy thông tin sà lan nào trong file Weight List!', 'warning');
        }

    } catch (e) {
        console.error(e);
        showToast('Lỗi khi đọc tệp Weight List!', 'error');
    } finally {
        loading.value = false;
    }
}

// Apply selected voyage details to input fields
function applySelectedVoyage(voyage: VoyageOption) {
    tenSaLan.value = voyage.bargeName;
    soHam.value = '';

    // Suggest port of loading
    const port = voyage.portOfLoading;
    if (port) {
        if (port.toLowerCase() === 'nguyên ngọc' || port.toLowerCase() === 'nguyen ngoc') {
            cangNhan.value = 'Cảng Nguyên Ngọc - TPHCM';
        } else if (port.toLowerCase().startsWith('cảng') || port.toLowerCase().startsWith('cang')) {
            cangNhan.value = port;
        } else {
            cangNhan.value = 'Cảng ' + port;
        }
    } else {
        cangNhan.value = 'Cảng Nguyên Ngọc - TPHCM';
    }

    // Auto calculate default dates
    if (voyage.minDate && voyage.maxDate) {
        // Arrival time: 2 hours before commencing
        const arrival = new Date(voyage.minDate.getTime() - 2 * 60 * 60 * 1000);
        dateIn.value = formatDateToInput(arrival);
        timeIn.value = formatTimeToInput(arrival);

        // Inspection time: 1 hour before commencing
        const inspection = new Date(voyage.minDate.getTime() - 1 * 60 * 60 * 1000);
        dateInspection.value = formatDateToInput(inspection);
        timeInspection.value = formatTimeToInput(inspection);

        // Commenced
        dateCommenced.value = formatDateToInput(voyage.minDate);
        timeCommenced.value = formatTimeToInput(voyage.minDate);

        // Completed
        dateCompleted.value = formatDateToInput(voyage.maxDate);
        timeCompleted.value = formatTimeToInput(voyage.maxDate);

        // Departure: 1 hour after completed
        const depart = new Date(voyage.maxDate.getTime() + 1 * 60 * 60 * 1000);
        dateDepart.value = formatDateToInput(depart);
        timeDepart.value = formatTimeToInput(depart);
    } else {
        // Clear times
        dateIn.value = ''; timeIn.value = '';
        dateInspection.value = ''; timeInspection.value = '';
        dateCommenced.value = ''; timeCommenced.value = '';
        dateCompleted.value = ''; timeCompleted.value = '';
        dateDepart.value = ''; timeDepart.value = '';
    }
}

function handleVoyageChange() {
    const v = currentVoyageDetails.value;
    if (v) {
        applySelectedVoyage(v);
    }
}

function handleTemplateUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        templateFile.value = file;
        showToast('Đã nhận tệp Biên bản mẫu tùy chỉnh!', 'success');
    }
}

function getCellValueString(cell: any): string {
    if (!cell) return '';
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val.formula) {
            return String(val.result !== undefined ? val.result : '');
        }
        if (val.richText) {
            return val.richText.map((t: any) => t.text).join('');
        }
        return '';
    }
    return String(val);
}

// Format date back to excel DD/MM/YYYY
function formatExcelDateStr(isoDate: string): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
}

// Generate minutes file
async function generateMinutes() {
    if (!wlFile.value) {
        showToast('Vui lòng tải lên tệp Weight List trước!', 'error');
        return;
    }
    const voyage = currentVoyageDetails.value;
    if (!voyage) {
        showToast('Vui lòng chọn chuyến sà lan cần kết xuất!', 'error');
        return;
    }

    processing.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();

        if (templateFile.value) {
            // Load custom template
            const arrayBuffer = await templateFile.value.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
        } else {
            // Fetch default template
            const response = await fetch('/templates/MinutesTemplate.xlsx');
            if (!response.ok) throw new Error('Không thể tải tệp mẫu mặc định');
            const arrayBuffer = await response.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
        }

        const tsc = workbook.getWorksheet('Thong so chung');
        if (!tsc) {
            throw new Error('Không tìm thấy sheet "Thong so chung" trong biên bản mẫu!');
        }

        // Dynamic row lookup to support auto-sums and offsets
        let rowXe = 7;
        let rowKg = 8;
        let rowKho = 9;
        let rowCont = 10;
        let rowXaThang = 11;
        let rowBarge = 12;
        let rowNationality = 13;
        let rowLoadingPort = 14;
        let rowDischargingPort = 15;
        let rowVessel = 16;
        let rowTimeArrival = 18;
        let rowTimeInspection = 19;
        let rowTimeStart = 20;
        let rowTimeEnd = 21;
        let rowTimeDepart = 22;
        let rowSeal = 24;
        let rowHamIndex = 25;

        for (let r = 1; r <= tsc.rowCount; r++) {
            const label = String(tsc.getCell(`A${r}`).value || '').toLowerCase();
            const unit = String(tsc.getCell(`B${r}`).value || '').toLowerCase().trim();
            
            if (label.includes('lượng hàng thực giao') && unit === 'xe') rowXe = r;
            else if (label.includes('lượng hàng thực giao') && unit === 'kg') rowKg = r;
            else if (label.includes('kho - sà lan')) rowKho = r;
            else if (label.includes('cont - sà lan')) rowCont = r;
            else if (label.includes('xá thẳng')) rowXaThang = r;
            else if (label.includes('tên sà lan nhận hàng')) rowBarge = r;
            else if (label.includes('quốc tịch')) rowNationality = r;
            else if (label.includes('cảng nhận hàng')) rowLoadingPort = r;
            else if (label.includes('cảng giao hàng')) rowDischargingPort = r;
            else if (label.includes('tàu quốc tế')) rowVessel = r;
            else if (label.includes('đến cảng nhận hàng')) rowTimeArrival = r;
            else if (label.includes('kiểm tra hầm hàng')) rowTimeInspection = r;
            else if (label.includes('bắt đầu làm hàng')) rowTimeStart = r;
            else if (label.includes('kết thúc làm hàng')) rowTimeEnd = r;
            else if (label.includes('tàu rời cảng')) rowTimeDepart = r;
            else if (label.includes('số lượng seal')) rowSeal = r;
            else if (label.includes('số hầm sà lan')) rowHamIndex = r;
        }

        // Fill Thong so chung worksheet
        tsc.getCell('C3').value = soBienBan.value;
        tsc.getCell('C4').value = chuHang.value;
        tsc.getCell('C5').value = tenHang.value;
        
        tsc.getCell(`C${rowXe}`).value = voyage.totalXe;
        // Total weight is SUM of Kho, Cont, XaThang
        tsc.getCell(`C${rowKg}`).value = {
            formula: `SUM(C${rowKho}:C${rowXaThang})`,
            result: voyage.totalKg
        };
        tsc.getCell(`C${rowKho}`).value = voyage.weightKho;
        tsc.getCell(`C${rowCont}`).value = 0;
        tsc.getCell(`C${rowXaThang}`).value = voyage.weightXaThang;
        
        tsc.getCell(`C${rowBarge}`).value = tenSaLan.value;
        tsc.getCell(`C${rowNationality}`).value = quocTich.value;
        tsc.getCell(`C${rowLoadingPort}`).value = cangNhan.value;
        tsc.getCell(`C${rowDischargingPort}`).value = cangGiao.value;
        tsc.getCell(`C${rowVessel}`).value = tauQuocTe.value;

        // Times
        tsc.getCell(`B${rowTimeArrival}`).value = timeIn.value;
        tsc.getCell(`C${rowTimeArrival}`).value = formatExcelDateStr(dateIn.value);

        tsc.getCell(`B${rowTimeInspection}`).value = timeInspection.value;
        tsc.getCell(`C${rowTimeInspection}`).value = formatExcelDateStr(dateInspection.value);

        tsc.getCell(`B${rowTimeStart}`).value = timeCommenced.value;
        tsc.getCell(`C${rowTimeStart}`).value = formatExcelDateStr(dateCommenced.value);

        tsc.getCell(`B${rowTimeEnd}`).value = timeCompleted.value;
        tsc.getCell(`C${rowTimeEnd}`).value = formatExcelDateStr(dateCompleted.value);

        tsc.getCell(`B${rowTimeDepart}`).value = timeDepart.value;
        tsc.getCell(`C${rowTimeDepart}`).value = formatExcelDateStr(dateDepart.value);

        tsc.getCell(`C${rowSeal}`).value = soSeal.value;
        tsc.getCell(`C${rowHamIndex}`).value = soHam.value ? parseInt(soHam.value) || null : null;

        // Compile values for helper formula updater
        const compileValues = {
            soBienBan: soBienBan.value,
            chuHang: chuHang.value,
            tenHang: tenHang.value,
            tongXe: voyage.totalXe,
            tongKg: voyage.totalKg,
            weightKho: voyage.weightKho,
            weightCont: 0,
            weightXaThang: voyage.weightXaThang,
            tenSaLan: tenSaLan.value,
            quocTich: quocTich.value,
            cangNhan: cangNhan.value,
            cangGiao: cangGiao.value,
            tauQuocTe: tauQuocTe.value,
            timeIn: timeIn.value,
            dateIn: formatExcelDateStr(dateIn.value),
            timeInspection: timeInspection.value,
            dateInspection: formatExcelDateStr(dateInspection.value),
            timeCommenced: timeCommenced.value,
            dateCommenced: formatExcelDateStr(dateCommenced.value),
            timeCompleted: timeCompleted.value,
            dateCompleted: formatExcelDateStr(dateCompleted.value),
            timeDepart: timeDepart.value,
            dateDepart: formatExcelDateStr(dateDepart.value),
            soSeal: soSeal.value,
            soHam: soHam.value
        };

        // Update all formula caches on other sheets
        workbook.worksheets.forEach((sheet: any) => {
            if (sheet.name === 'Thong so chung') return;
            sheet.eachRow((row: any) => {
                row.eachCell((cell: any) => {
                    if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
                        const formula = cell.value.formula.replace(/\s+/g, '');
                        let res: any = null;
                        
                        if (formula === "'Thongsochung'!C3") res = compileValues.soBienBan;
                        else if (formula === "'Thongsochung'!C4") res = compileValues.chuHang;
                        else if (formula === "'Thongsochung'!C5") res = compileValues.tenHang;
                        else if (formula === "'Thongsochung'!C7") res = compileValues.tongXe;
                        else if (formula === "'Thongsochung'!C8") res = compileValues.tongKg;
                        else if (formula === "'Thongsochung'!C9") res = compileValues.weightKho;
                        else if (formula === "'Thongsochung'!C10") res = compileValues.weightCont;
                        else if (formula === "'Thongsochung'!C11") res = compileValues.weightXaThang;
                        else if (formula === "'Thongsochung'!C12") res = compileValues.tenSaLan;
                        else if (formula === "'Thongsochung'!C13") res = compileValues.quocTich;
                        else if (formula === "'Thongsochung'!C14") res = compileValues.cangNhan;
                        else if (formula === "'Thongsochung'!C15" || formula === "+'Thongsochung'!C15") res = compileValues.cangGiao;
                        else if (formula === "'Thongsochung'!C16") res = compileValues.tauQuocTe;
                        else if (formula === "'Thongsochung'!C18") res = compileValues.dateIn;
                        else if (formula === "'Thongsochung'!C21") res = compileValues.dateCompleted;
                        else if (formula === "'Thongsochung'!C22") res = compileValues.dateDepart;
                        else if (formula === "'Thongsochung'!C24" || formula === "+'Thongsochung'!C24") res = compileValues.soSeal;
                        
                        else if (formula === "'Thongsochung'!B18&\",\"&\"\"&\"Ngày\"&\"\"&'Thongsochung'!C18") {
                            res = `${compileValues.timeIn}, Ngày ${compileValues.dateIn}`;
                        }
                        else if (formula === "'Thongsochung'!B19&\",\"&\"\"&\"Ngày\"&\"\"&'Thongsochung'!C19") {
                            res = `${compileValues.timeInspection}, Ngày ${compileValues.dateInspection}`;
                        }
                        else if (formula === "'Thongsochung'!B20&\",\"&\"\"&\"Ngày\"&\"\"&'Thongsochung'!C20") {
                            res = `${compileValues.timeCommenced}, Ngày ${compileValues.dateCommenced}`;
                        }
                        else if (formula === "'Thongsochung'!B20&\"\"&\"-\"&\"\"&'Thongsochung'!C20") {
                            res = `${compileValues.timeCommenced} - ${compileValues.dateCommenced}`;
                        }
                        else if (formula === "'Thongsochung'!B21&\"\"&\"-\"&\"\"&'Thongsochung'!C21") {
                            res = `${compileValues.timeCompleted} - ${compileValues.dateCompleted}`;
                        }
                        
                        else if (formula === "F15") res = compileValues.tongXe;
                        else if (formula === "H15") res = compileValues.tongXe;
                        else if (formula === "J15") res = compileValues.tongKg;
                        
                        if (res !== null) {
                            cell.value = { formula: cell.value.formula, result: res };
                        }
                    }
                });
            });
        });

        // Write to buffer and trigger download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Clean filename
        const safeBargeName = tenSaLan.value.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
        link.download = `BIÊN BẢN GIAO NHẬN SÀ LAN_${safeBargeName}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Đã tạo và tải bộ biên bản thành công!', 'success');
    } catch (e: any) {
        console.error(e);
        showToast(`Lỗi khi tạo biên bản: ${e.message}`, 'error');
    } finally {
        processing.value = false;
    }
}
</script>

<template>
    <div class="flex flex-col gap-6 w-full max-w-[1200px] mx-auto pb-8 fade-in">
        <!-- Header Banner -->
        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 gap-4">
            <div>
                <div class="text-[9px] uppercase font-black tracking-widest text-emerald-600 mb-0.5">Tiện ích cảng biển</div>
                <h1 class="text-base font-black text-[#4a2c32] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-emerald-600 text-lg">description</span>
                    Tạo Biên Bản Giao Nhận Sà Lan Tự Động
                </h1>
                <p class="text-[10px] opacity-60 mt-0.5">Tự động tính toán số liệu xuất kho, xá thẳng và lập bộ 4 biên bản làm hàng.</p>
            </div>
        </div>

        <!-- Main Body Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <!-- Left Side: Upload & Voyage Selection (4 Cols) -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <!-- Weight List Card -->
                <div class="bg-white rounded-[24px] p-5 border border-primary/5 soft-shadow flex flex-col gap-4">
                    <h3 class="text-xs font-black text-[#4a2c32] border-b border-primary/5 pb-2 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-sm font-bold">upload_file</span>
                        1. Tải lên tệp Weight List
                    </h3>
                    
                    <div class="flex flex-col gap-3">
                        <label class="border-2 border-dashed border-gray-200 hover:border-primary/50 transition-all rounded-[16px] p-4 text-center cursor-pointer bg-gray-50/50 hover:bg-primary/5 flex flex-col items-center gap-2">
                            <span class="material-symbols-outlined text-gray-400 text-3xl">table_chart</span>
                            <span class="text-[11px] font-black text-[#4a2c32]">{{ wlFile ? wlFile.name : 'Chọn file Weight List (.xlsx)' }}</span>
                            <span class="text-[9px] opacity-60">Sử dụng 4 sheet xuất hàng</span>
                            <input type="file" accept=".xlsx" @change="handleWlUpload" class="hidden" />
                        </label>
                        
                        <div v-if="loading" class="flex items-center justify-center gap-2 py-4">
                            <div class="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                            <span class="text-[10px] font-bold text-primary">Đang phân tích Weight List...</span>
                        </div>
                    </div>
                </div>

                <!-- Template Upload (Optional) -->
                <div class="bg-white rounded-[24px] p-5 border border-primary/5 soft-shadow flex flex-col gap-4">
                    <h3 class="text-xs font-black text-[#4a2c32] border-b border-primary/5 pb-2 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-emerald-600 text-sm font-bold">settings</span>
                        Biên bản mẫu (Template)
                    </h3>
                    <div class="flex flex-col gap-3">
                        <label class="border border-dashed border-gray-200 hover:border-primary/30 transition-all rounded-[16px] p-3 text-center cursor-pointer bg-gray-50/30 flex flex-col items-center gap-1">
                            <span class="material-symbols-outlined text-gray-400 text-xl">description</span>
                            <span class="text-[10px] font-bold text-[#4a2c32] truncate max-w-xs">{{ templateFile ? templateFile.name : 'Tải lên mẫu riêng (.xlsx)' }}</span>
                            <span class="text-[8px] opacity-50">Mặc định: 2 BỘ BIÊN BẢN GIAO NHẬN</span>
                            <input type="file" accept=".xlsx" @change="handleTemplateUpload" class="hidden" />
                        </label>
                    </div>
                </div>

                <!-- Voyage Selector Card -->
                <div v-if="detectedVoyages.length > 0" class="bg-white rounded-[24px] p-5 border border-primary/5 soft-shadow flex flex-col gap-4">
                    <h3 class="text-xs font-black text-[#4a2c32] border-b border-primary/5 pb-2 flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-sm font-bold">directions_boat</span>
                        2. Chọn chuyến sà lan
                    </h3>
                    
                    <div class="flex flex-col gap-2">
                        <label class="text-[10px] font-bold text-gray-400">Danh sách chuyến trong Weight List</label>
                        <select 
                            v-model="selectedVoyage" 
                            @change="handleVoyageChange"
                            class="w-full bg-[#fcedf0]/40 border border-primary/10 rounded-[12px] p-2 text-xs font-bold text-[#4a2c32] focus:outline-none focus:border-primary"
                        >
                            <option v-for="voy in detectedVoyages" :key="voy.rawName" :value="voy.rawName">
                                {{ voy.rawName }}
                            </option>
                        </select>
                    </div>

                    <!-- Short Calculations Preview -->
                    <div v-if="currentVoyageDetails" class="bg-gray-50 rounded-[16px] p-3.5 flex flex-col gap-2 border border-gray-100 text-[11px]">
                        <div class="flex justify-between font-bold text-gray-500">
                            <span>Tổng số xe:</span>
                            <span class="text-[#4a2c32]">{{ currentVoyageDetails.totalXe }} xe</span>
                        </div>
                        <div class="flex justify-between font-bold text-gray-500">
                            <span>Tổng trọng lượng:</span>
                            <span class="text-primary font-black">{{ (currentVoyageDetails.totalKg / 1000).toFixed(2) }} tấn</span>
                        </div>
                        <div class="border-t border-gray-200/60 my-1"></div>
                        <div class="flex justify-between text-gray-400">
                            <span>Từ Kho:</span>
                            <span class="font-semibold text-gray-600">{{ (currentVoyageDetails.weightKho / 1000).toFixed(2) }} tấn</span>
                        </div>
                        <div class="flex justify-between text-gray-400">
                            <span>Xá Thẳng:</span>
                            <span class="font-semibold text-gray-600">{{ (currentVoyageDetails.weightXaThang / 1000).toFixed(2) }} tấn</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Side: BB Parameters Form (8 Cols) -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <div class="bg-white rounded-[24px] p-6 border border-primary/5 soft-shadow flex flex-col gap-5">
                    <h3 class="text-sm font-black text-[#4a2c32] border-b border-primary/5 pb-3 flex items-center justify-between">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-primary">edit_note</span>
                            3. Thông tin Biên Bản và Làm Hàng
                        </span>
                    </h3>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Số biên bản -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Số biên bản</label>
                            <input 
                                type="text" 
                                v-model="soBienBan" 
                                placeholder="Ví dụ: JUN/EW-NN/17000000-NB/07"
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Tên sà lan -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Tên sà lan nhận hàng</label>
                            <input 
                                type="text" 
                                v-model="tenSaLan" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Chủ hàng -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Chủ hàng (Consignee)</label>
                            <input 
                                type="text" 
                                v-model="chuHang" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Tên hàng -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Tên hàng (loại hàng)</label>
                            <input 
                                type="text" 
                                v-model="tenHang" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Tàu quốc tế -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Tàu quốc tế (Vessel)</label>
                            <input 
                                type="text" 
                                v-model="tauQuocTe" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Quốc tịch -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Quốc tịch sà lan</label>
                            <input 
                                type="text" 
                                v-model="quocTich" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Cảng nhận hàng -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Cảng nhận hàng (Port of loading)</label>
                            <input 
                                type="text" 
                                v-model="cangNhan" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Cảng giao hàng -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Cảng giao hàng (Port of discharging)</label>
                            <input 
                                type="text" 
                                v-model="cangGiao" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Số lượng seal -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Số lượng seal chì</label>
                            <input 
                                type="number" 
                                v-model="soSeal" 
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>

                        <!-- Số hầm sà lan -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-400">Số hầm sà lan (Hầm)</label>
                            <input 
                                type="text" 
                                v-model="soHam" 
                                placeholder="Để trống nếu không dùng"
                                class="border border-gray-200 rounded-[12px] p-2 text-xs font-semibold focus:outline-none focus:border-primary bg-gray-50/50"
                            />
                        </div>
                    </div>

                    <!-- Date and Time Matrix -->
                    <div class="border-t border-primary/5 pt-4 flex flex-col gap-3">
                        <h4 class="text-xs font-black text-primary">Các mốc thời gian hành trình & làm hàng</h4>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Đến cảng nhận hàng -->
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Giờ đến</label>
                                    <input type="time" v-model="timeIn" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold" />
                                </div>
                                <div class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Ngày đến</label>
                                    <input type="date" v-model="dateIn" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold w-full" />
                                </div>
                                <span class="text-[8px] text-gray-400 col-span-3 -mt-1 font-semibold">1. Đến cảng nhận</span>
                            </div>

                            <!-- Kiểm tra hầm hàng -->
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Giờ KT</label>
                                    <input type="time" v-model="timeInspection" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold" />
                                </div>
                                <div class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Ngày KT</label>
                                    <input type="date" v-model="dateInspection" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold w-full" />
                                </div>
                                <span class="text-[8px] text-gray-400 col-span-3 -mt-1 font-semibold">2. Kiểm tra hầm hàng</span>
                            </div>

                            <!-- Bắt đầu làm hàng -->
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Giờ BĐ</label>
                                    <input type="time" v-model="timeCommenced" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold" />
                                </div>
                                <div class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Ngày BĐ</label>
                                    <input type="date" v-model="dateCommenced" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold w-full" />
                                </div>
                                <span class="text-[8px] text-gray-400 col-span-3 -mt-1 font-semibold">3. Bắt đầu xếp hàng (Chuyến đầu)</span>
                            </div>

                            <!-- Kết thúc làm hàng -->
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Giờ KT</label>
                                    <input type="time" v-model="timeCompleted" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold" />
                                </div>
                                <div class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Ngày KT</label>
                                    <input type="date" v-model="dateCompleted" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold w-full" />
                                </div>
                                <span class="text-[8px] text-gray-400 col-span-3 -mt-1 font-semibold">4. Hoàn thành xếp hàng (Chuyến cuối)</span>
                            </div>

                            <!-- Rời cảng -->
                            <div class="grid grid-cols-3 gap-2">
                                <div class="col-span-1 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Giờ rời</label>
                                    <input type="time" v-model="timeDepart" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold" />
                                </div>
                                <div class="col-span-2 flex flex-col gap-1">
                                    <label class="text-[9px] font-bold text-gray-400">Ngày rời</label>
                                    <input type="date" v-model="dateDepart" class="border border-gray-200 rounded-[8px] p-1.5 text-[10px] font-semibold w-full" />
                                </div>
                                <span class="text-[8px] text-gray-400 col-span-3 -mt-1 font-semibold">5. Rời cảng giao nhận</span>
                            </div>
                        </div>
                    </div>

                    <!-- Submit action button -->
                    <div class="border-t border-primary/5 pt-4 flex items-center justify-end">
                        <button 
                            @click="generateMinutes"
                            :disabled="processing || detectedVoyages.length === 0"
                            class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                            <span v-if="processing" class="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span v-else class="material-symbols-outlined text-sm">download</span>
                            {{ processing ? 'Đang xuất biên bản...' : 'Tạo & Tải Bộ Biên Bản' }}
                        </button>
                    </div>

                </div>
            </div>

        </div>

        <!-- Global Toast -->
        <Transition name="fade">
            <div 
                v-if="toast" 
                :class="[
                    'fixed bottom-6 right-6 z-[110] px-4 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 animate-slide-in',
                    toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                    toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-sky-50 border-sky-200 text-sky-800'
                ]"
            >
                <span class="material-symbols-outlined text-base">
                    {{ toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'cancel' : 'warning' }}
                </span>
                <span>{{ toast.msg }}</span>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.fade-in {
    animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.soft-shadow {
    box-shadow: 0 10px 30px -10px rgba(128, 0, 32, 0.05);
}
</style>
