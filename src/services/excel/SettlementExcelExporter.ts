import ExcelJS from 'exceljs';
import type {
    SettlementSummary,
    SettlementTicketFlows,
    DebitNoteLineItem
} from '@/types/settlement';
import {
    parseDateTimeFlexible
} from '@/services/settlement/BargeDemurrageService';

const FONT_NAME = 'Cambria';

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
};

const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'double' },
    right: { style: 'thin' }
};

const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EEF5' }
};

const TOTAL_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
};

function styleCell(
    cell: ExcelJS.Cell,
    opts: {
        bold?: boolean;
        italic?: boolean;
        size?: number;
        align?: 'left' | 'center' | 'right';
        vertical?: 'top' | 'middle' | 'bottom';
        wrapText?: boolean;
        numFmt?: string;
        border?: Partial<ExcelJS.Borders>;
        fill?: ExcelJS.Fill;
        color?: string;
    } = {}
) {
    cell.font = {
        name: FONT_NAME,
        size: opts.size ?? 11,
        bold: opts.bold ?? false,
        italic: opts.italic ?? false,
        color: opts.color ? { argb: opts.color } : undefined
    };
    cell.alignment = {
        horizontal: opts.align ?? 'left',
        vertical: opts.vertical ?? 'middle',
        wrapText: opts.wrapText ?? false
    };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.border) cell.border = opts.border;
    if (opts.fill) cell.fill = opts.fill;
}

function formatExcelDateStr(raw: any): string {
    if (!raw) return '';
    const d = parseDateTimeFlexible(raw);
    if (!d) return String(raw);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function normalizeNetKg(t: any): number {
    const raw = Number(t.weightNet ?? t.netWeight ?? t.weight ?? 0);
    // Nếu dữ liệu nhỏ hơn 200 (đơn vị tấn), quy ra kg; ngược lại giữ nguyên kg
    return raw > 0 && raw < 200 ? Math.round(raw * 1000) : Math.round(raw);
}

/**
 * Xây dựng Sheet `LƯU SÀ LAN` trước để biết tọa độ ô Tổng cộng (K{totalRow})
 * phục vụ tham chiếu công thức từ Sheet `DNTT 1`.
 */
function buildBargeDemurrageSheet(
    workbook: ExcelJS.Workbook,
    summary: SettlementSummary
): { totalAmountCellRef: string; totalRowNumber: number } {
    const sheet = workbook.addWorksheet('LƯU SÀ LAN');
    sheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    };

    sheet.columns = [
        { width: 6 },  // A: STT
        { width: 16 }, // B: Ngày đến
        { width: 16 }, // C: Ngày rời phao
        { width: 18 }, // D: Số phương tiện
        { width: 14 }, // E: Thực giao (Tấn)
        { width: 12 }, // F: Tổng ngày
        { width: 12 }, // G: Lưu cơ bản
        { width: 12 }, // H: Vượt lưu thô
        { width: 14 }, // I: Vượt lưu làm tròn
        { width: 13 }, // J: Đơn giá
        { width: 18 }, // K: Thành tiền
        { width: 16 }  // L: Khu vực
    ];

    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `BẢNG KÊ CHI TIẾT LƯU NEO PHƯƠNG TIỆN (BARGE DEMURRAGE) - TÀU ${summary.vesselName}`;
    styleCell(titleCell, { bold: true, size: 14, align: 'center' });

    sheet.mergeCells('A2:L2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Khách hàng: ${summary.customerName} | Hợp đồng: ${summary.agreementNo}`;
    styleCell(subCell, { italic: true, size: 11, align: 'center' });

    const headers = [
        'STT',
        'Ngày đến cảng',
        'Ngày rời phao',
        'Số phương tiện',
        'Khối lượng thực giao (Tấn)',
        'Tổng ngày thực hiện',
        'Ngày lưu miễn phí',
        'Vượt lưu thô',
        'Vượt lưu làm tròn',
        'Đơn giá lưu (VNĐ)',
        'Thành tiền (VNĐ)',
        'Khu vực'
    ];
    const headerRowIdx = 4;
    const headerRow = sheet.getRow(headerRowIdx);
    headerRow.height = 28;
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        styleCell(cell, {
            bold: true,
            size: 10,
            align: 'center',
            wrapText: true,
            border: THIN_BORDER,
            fill: HEADER_FILL
        });
    });

    const dataStartRow = 5;
    let currentRow = dataStartRow;

    summary.barges.forEach((b, idx) => {
        const r = sheet.getRow(currentRow);
        r.height = 20;

        const arrDate = parseDateTimeFlexible(b.arrivalTime);
        const depDate = parseDateTimeFlexible(b.departureTime);

        r.getCell(1).value = idx + 1;
        styleCell(r.getCell(1), { align: 'center', border: THIN_BORDER });

        const cArr = r.getCell(2);
        cArr.value = arrDate ?? (b.arrivalTime || '-');
        styleCell(cArr, {
            align: 'center',
            border: THIN_BORDER,
            numFmt: arrDate ? 'dd/mm/yyyy hh:mm' : undefined
        });

        const cDep = r.getCell(3);
        cDep.value = depDate ?? (b.departureTime || '-');
        styleCell(cDep, {
            align: 'center',
            border: THIN_BORDER,
            numFmt: depDate ? 'dd/mm/yyyy hh:mm' : undefined
        });

        r.getCell(4).value = b.bargeName;
        styleCell(r.getCell(4), { bold: true, align: 'center', border: THIN_BORDER });

        r.getCell(5).value = b.dischargedTons;
        styleCell(r.getCell(5), { align: 'right', border: THIN_BORDER, numFmt: '#,##0.00' });

        // Tổng ngày: =ROUND(C{r}-B{r}, 1) nếu có ngày hợp lệ
        const fCell = r.getCell(6);
        if (arrDate && depDate) {
            fCell.value = { formula: `ROUND(C${currentRow}-B${currentRow},1)`, result: b.totalDays };
        } else {
            fCell.value = b.totalDays;
        }
        styleCell(fCell, { align: 'right', border: THIN_BORDER, numFmt: '#,##0.0' });

        r.getCell(7).value = b.freeDays;
        styleCell(r.getCell(7), { align: 'center', border: THIN_BORDER, numFmt: '#,##0' });

        const hCell = r.getCell(8);
        hCell.value = { formula: `F${currentRow}-G${currentRow}`, result: b.excessDaysRaw };
        styleCell(hCell, { align: 'right', border: THIN_BORDER, numFmt: '#,##0.0' });

        // Quy tắc làm tròn cảng biển: =IF(H{r}>0,INT(H{r})+IF(H{r}-INT(H{r})>0.5,1,IF(H{r}-INT(H{r})=0,0,0.5)),0)
        const iCell = r.getCell(9);
        iCell.value = {
            formula: `IF(H${currentRow}>0,INT(H${currentRow})+IF(H${currentRow}-INT(H${currentRow})>0.5,1,IF(H${currentRow}-INT(H${currentRow})=0,0,0.5)),0)`,
            result: b.excessDaysRounded
        };
        styleCell(iCell, { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0.0' });

        r.getCell(10).value = b.ratePerTonDay;
        styleCell(r.getCell(10), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        const kCell = r.getCell(11);
        kCell.value = {
            formula: `IFERROR(ROUND(I${currentRow}*J${currentRow}*E${currentRow},0),0)`,
            result: b.amount
        };
        styleCell(kCell, { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(12).value = b.area || 'Nguyên Ngọc';
        styleCell(r.getCell(12), { align: 'center', border: THIN_BORDER });

        currentRow++;
    });

    const dataEndRow = Math.max(dataStartRow, currentRow - 1);
    const totalRowNumber = currentRow;
    const totalRow = sheet.getRow(totalRowNumber);
    totalRow.height = 22;

    sheet.mergeCells(`A${totalRowNumber}:D${totalRowNumber}`);
    totalRow.getCell(1).value = 'TỔNG CỘNG / TOTAL';
    for (let col = 1; col <= 12; col++) {
        styleCell(totalRow.getCell(col), {
            bold: true,
            align: col === 1 ? 'center' : 'right',
            border: TOTAL_BORDER,
            fill: TOTAL_FILL
        });
    }

    const totalTonsVal = summary.barges.reduce((s, b) => s + b.dischargedTons, 0);
    const totalAmountVal = summary.barges.reduce((s, b) => s + b.amount, 0);

    if (summary.barges.length > 0) {
        totalRow.getCell(5).value = {
            formula: `SUM(E${dataStartRow}:E${dataEndRow})`,
            result: Math.round(totalTonsVal * 100) / 100
        };
        totalRow.getCell(5).numFmt = '#,##0.00';

        totalRow.getCell(11).value = {
            formula: `SUM(K${dataStartRow}:K${dataEndRow})`,
            result: totalAmountVal
        };
        totalRow.getCell(11).numFmt = '#,##0';
    } else {
        totalRow.getCell(5).value = 0;
        totalRow.getCell(11).value = 0;
        totalRow.getCell(11).numFmt = '#,##0';
    }

    // VAT 8% & Grand total rows below totalRowNumber
    const vatRowNum = totalRowNumber + 1;
    const vatRow = sheet.getRow(vatRowNum);
    sheet.mergeCells(`A${vatRowNum}:J${vatRowNum}`);
    vatRow.getCell(1).value = `Thuế GTGT (${Math.round(summary.vatRate * 100)}%) / VAT`;
    styleCell(vatRow.getCell(1), { bold: true, align: 'right', border: THIN_BORDER });
    const vatVal = Math.round(totalAmountVal * summary.vatRate);
    vatRow.getCell(11).value = {
        formula: `ROUND(K${totalRowNumber}*${summary.vatRate},0)`,
        result: vatVal
    };
    styleCell(vatRow.getCell(11), { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });
    styleCell(vatRow.getCell(12), { border: THIN_BORDER });

    const grandRowNum = totalRowNumber + 2;
    const grandRow = sheet.getRow(grandRowNum);
    sheet.mergeCells(`A${grandRowNum}:J${grandRowNum}`);
    grandRow.getCell(1).value = 'TỔNG THANH TOÁN LƯU SÀ LAN (ĐÃ BAO GỒM VAT)';
    styleCell(grandRow.getCell(1), { bold: true, align: 'right', border: TOTAL_BORDER, fill: TOTAL_FILL });
    grandRow.getCell(11).value = {
        formula: `K${totalRowNumber}+K${vatRowNum}`,
        result: totalAmountVal + vatVal
    };
    styleCell(grandRow.getCell(11), { bold: true, align: 'right', border: TOTAL_BORDER, fill: TOTAL_FILL, numFmt: '#,##0' });
    styleCell(grandRow.getCell(12), { border: TOTAL_BORDER, fill: TOTAL_FILL });

    return {
        totalAmountCellRef: `'LƯU SÀ LAN'!K${totalRowNumber}`,
        totalRowNumber
    };
}

/**
 * Xây dựng Sheet `DNTT 1` hoặc `DNTT 2`.
 */
function buildDebitNoteSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    titleVi: string,
    titleEn: string,
    summary: SettlementSummary,
    items: DebitNoteLineItem[],
    subTotal: number,
    vatAmount: number,
    totalAmount: number,
    wordsVi: string,
    wordsEn: string,
    demurrageSheetRef?: string
): { sumRangeStart: number; sumRangeEnd: number } {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.pageSetup = {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    };

    sheet.columns = [
        { width: 6 },  // A: STT
        { width: 38 }, // B: Mô tả dịch vụ
        { width: 10 }, // C: ĐVT
        { width: 13 }, // D: Số lượng
        { width: 14 }, // E: Đơn giá
        { width: 15 }, // F: Mức giá dầu
        { width: 18 }  // G: Thành tiền
    ];

    // Header công văn
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = 'CÔNG TY CỔ PHẦN CẢNG THỊ VẢI / THI VAI PORT JSC';
    styleCell(sheet.getCell('A1'), { bold: true, size: 13, align: 'center', color: 'FF1E3A8A' });

    sheet.mergeCells('A2:G2');
    sheet.getCell('A2').value = 'CẢNG NGUYÊN NGỌC - BÌNH DƯƠNG / NGUYEN NGOC PORT';
    styleCell(sheet.getCell('A2'), { size: 10, align: 'center', italic: true });

    sheet.mergeCells('A4:G4');
    sheet.getCell('A4').value = `${titleVi} / ${titleEn}`;
    styleCell(sheet.getCell('A4'), { bold: true, size: 15, align: 'center' });

    sheet.mergeCells('A5:G5');
    sheet.getCell('A5').value = `Số / Service Order No.: ${summary.serviceOrderNo}`;
    styleCell(sheet.getCell('A5'), { bold: true, size: 11, align: 'center', italic: true });

    const infoRows: Array<[string, string]> = [
        ['Kính gửi / To:', summary.customerName],
        ['Căn cứ / Ref.:', summary.agreementNo],
        ['Tên tàu / Vessel:', `MV ${summary.vesselName}`],
        ['Tên hàng / Commodity:', summary.cargoName],
        ['Thời gian / Period:', `${summary.startingTime || '-'}  →  ${summary.endingTime || '-'}`]
    ];

    let rowIdx = 7;
    infoRows.forEach(([label, val]) => {
        sheet.getCell(`A${rowIdx}`).value = label;
        styleCell(sheet.getCell(`A${rowIdx}`), { bold: true, size: 11 });
        sheet.mergeCells(`B${rowIdx}:G${rowIdx}`);
        sheet.getCell(`B${rowIdx}`).value = val;
        styleCell(sheet.getCell(`B${rowIdx}`), { bold: label.includes('Kính gửi') || label.includes('Tên tàu'), size: 11 });
        rowIdx++;
    });

    // Bảng dịch vụ
    const tableHeaderRowIdx = rowIdx + 1;
    const tHeader = sheet.getRow(tableHeaderRowIdx);
    tHeader.height = 28;
    const cols = [
        'STT',
        'Mô tả dịch vụ / Description',
        'ĐVT / Unit',
        'Số lượng / Qty',
        'Đơn giá / Unit Price',
        'Mức giá dầu / Fuel Tier',
        'Thành tiền / Amount (VND)'
    ];
    cols.forEach((c, idx) => {
        const cell = tHeader.getCell(idx + 1);
        cell.value = c;
        styleCell(cell, {
            bold: true,
            size: 10,
            align: 'center',
            wrapText: true,
            border: THIN_BORDER,
            fill: HEADER_FILL
        });
    });

    const activeItems = items.filter(i => i.enabled);
    const itemsStartRow = tableHeaderRowIdx + 1;
    let curRow = itemsStartRow;

    if (activeItems.length === 0) {
        const emptyRow = sheet.getRow(curRow);
        sheet.mergeCells(`A${curRow}:G${curRow}`);
        emptyRow.getCell(1).value = '(Chưa chọn dịch vụ nào)';
        styleCell(emptyRow.getCell(1), { italic: true, align: 'center', border: THIN_BORDER });
        curRow++;
    } else {
        activeItems.forEach((item, idx) => {
            const r = sheet.getRow(curRow);
            r.height = item.subTitle ? 30 : 22;

            r.getCell(1).value = idx + 1;
            styleCell(r.getCell(1), { align: 'center', border: THIN_BORDER });

            const descText = item.subTitle
                ? `${item.serviceName}\n(${item.subTitle})${item.contractRef ? ` [${item.contractRef}]` : ''}`
                : `${item.serviceName}${item.contractRef ? ` [${item.contractRef}]` : ''}`;
            r.getCell(2).value = descText;
            styleCell(r.getCell(2), { wrapText: true, border: THIN_BORDER, size: 10 });

            r.getCell(3).value = item.unit;
            styleCell(r.getCell(3), { align: 'center', border: THIN_BORDER });

            r.getCell(4).value = item.quantity;
            styleCell(r.getCell(4), { align: 'right', border: THIN_BORDER, numFmt: '#,##0.00' });

            r.getCell(5).value = item.unitPrice;
            styleCell(r.getCell(5), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

            r.getCell(6).value = item.fuelTierLabel || summary.fuelTier.label;
            styleCell(r.getCell(6), { align: 'center', border: THIN_BORDER, size: 10 });

            const amountCell = r.getCell(7);
            const isDemurrage = (item.id === 'srv_luu_salan' || item.id === 'demurrage' || item.contractRef === 'LƯU SÀ LAN') && demurrageSheetRef;
            if (isDemurrage) {
                amountCell.value = { formula: demurrageSheetRef, result: item.amount };
            } else if (item.quantity > 0 && item.unitPrice > 0) {
                amountCell.value = { formula: `ROUND(D${curRow}*E${curRow},0)`, result: item.amount };
            } else {
                amountCell.value = item.amount;
            }
            styleCell(amountCell, { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

            curRow++;
        });
    }

    const itemsEndRow = curRow - 1;

    // Subtotal row
    const subRowIdx = curRow;
    const subRow = sheet.getRow(subRowIdx);
    subRow.height = 22;
    sheet.mergeCells(`A${subRowIdx}:F${subRowIdx}`);
    subRow.getCell(1).value = 'Cộng tiền hàng chưa thuế / Sub-total';
    for (let c = 1; c <= 6; c++) styleCell(subRow.getCell(c), { bold: true, align: 'right', border: THIN_BORDER });
    subRow.getCell(7).value = {
        formula: `SUM(G${itemsStartRow}:G${itemsEndRow})`,
        result: subTotal
    };
    styleCell(subRow.getCell(7), { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

    // VAT row
    const vatRowIdx = curRow + 1;
    const vatRow = sheet.getRow(vatRowIdx);
    vatRow.height = 22;
    sheet.mergeCells(`A${vatRowIdx}:F${vatRowIdx}`);
    vatRow.getCell(1).value = `Thuế GTGT (${Math.round(summary.vatRate * 100)}%) / VAT`;
    for (let c = 1; c <= 6; c++) styleCell(vatRow.getCell(c), { bold: true, align: 'right', border: THIN_BORDER });
    vatRow.getCell(7).value = {
        formula: `ROUND(G${subRowIdx}*${summary.vatRate},0)`,
        result: vatAmount
    };
    styleCell(vatRow.getCell(7), { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

    // Grand Total row
    const totalRowIdx = curRow + 2;
    const totalRow = sheet.getRow(totalRowIdx);
    totalRow.height = 25;
    sheet.mergeCells(`A${totalRowIdx}:F${totalRowIdx}`);
    totalRow.getCell(1).value = 'TỔNG CỘNG THANH TOÁN / GRAND TOTAL';
    for (let c = 1; c <= 6; c++) {
        styleCell(totalRow.getCell(c), {
            bold: true,
            size: 12,
            align: 'right',
            border: TOTAL_BORDER,
            fill: TOTAL_FILL
        });
    }
    totalRow.getCell(7).value = {
        formula: `G${subRowIdx}+G${vatRowIdx}`,
        result: totalAmount
    };
    styleCell(totalRow.getCell(7), {
        bold: true,
        size: 12,
        align: 'right',
        border: TOTAL_BORDER,
        fill: TOTAL_FILL,
        numFmt: '#,##0'
    });

    // Số tiền bằng chữ song ngữ
    const wordsViRow = curRow + 4;
    sheet.mergeCells(`A${wordsViRow}:G${wordsViRow}`);
    sheet.getCell(`A${wordsViRow}`).value = `Số tiền bằng chữ: ${wordsVi}`;
    styleCell(sheet.getCell(`A${wordsViRow}`), { bold: true, italic: true, wrapText: true });

    const wordsEnRow = curRow + 5;
    sheet.mergeCells(`A${wordsEnRow}:G${wordsEnRow}`);
    sheet.getCell(`A${wordsEnRow}`).value = `In words: ${wordsEn}`;
    styleCell(sheet.getCell(`A${wordsEnRow}`), { italic: true, wrapText: true });

    // Thông tin ngân hàng thụ hưởng
    const bankStartRow = curRow + 7;
    sheet.mergeCells(`A${bankStartRow}:G${bankStartRow}`);
    sheet.getCell(`A${bankStartRow}`).value = 'THÔNG TIN CHUYỂN KHOẢN / BANK ACCOUNT INFORMATION:';
    styleCell(sheet.getCell(`A${bankStartRow}`), { bold: true, size: 11 });

    sheet.mergeCells(`A${bankStartRow + 1}:G${bankStartRow + 1}`);
    sheet.getCell(`A${bankStartRow + 1}`).value = `- Đơn vị thụ hưởng / Beneficiary: ${summary.beneficiaryInfo.name}`;
    styleCell(sheet.getCell(`A${bankStartRow + 1}`));

    sheet.mergeCells(`A${bankStartRow + 2}:G${bankStartRow + 2}`);
    sheet.getCell(`A${bankStartRow + 2}`).value = `- Số tài khoản / Account No.: ${summary.beneficiaryInfo.accountNo}`;
    styleCell(sheet.getCell(`A${bankStartRow + 2}`), { bold: true });

    sheet.mergeCells(`A${bankStartRow + 3}:G${bankStartRow + 3}`);
    sheet.getCell(`A${bankStartRow + 3}`).value = `- Ngân hàng / Bank: ${summary.beneficiaryInfo.bank}`;
    styleCell(sheet.getCell(`A${bankStartRow + 3}`));

    return { sumRangeStart: itemsStartRow, sumRangeEnd: itemsEndRow };
}

/**
 * Xây dựng Sheet `Giá dầu`.
 */
function buildFuelPriceSheet(workbook: ExcelJS.Workbook, summary: SettlementSummary) {
    const sheet = workbook.addWorksheet('Giá dầu');
    sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 };
    sheet.columns = [
        { width: 8 },
        { width: 18 },
        { width: 22 },
        { width: 32 }
    ];

    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = `BẢNG THEO DÕI GIÁ DẦU DO 0.05S-II (PETROLIMEX VÙNG 1) - TÀU ${summary.vesselName}`;
    styleCell(sheet.getCell('A1'), { bold: true, size: 13, align: 'center' });

    const headerRow = sheet.getRow(2);
    headerRow.height = 24;
    ['STT', 'Ngày áp dụng', 'Đơn giá (VNĐ/lít)', 'Ghi chú / Khung áp dụng'].forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        styleCell(c, { bold: true, align: 'center', border: THIN_BORDER, fill: HEADER_FILL });
    });

    const startRow = 3;
    let rIdx = startRow;
    summary.dailyFuelPrices.forEach((p, idx) => {
        const r = sheet.getRow(rIdx);
        r.getCell(1).value = idx + 1;
        styleCell(r.getCell(1), { align: 'center', border: THIN_BORDER });

        r.getCell(2).value = p.date;
        styleCell(r.getCell(2), { align: 'center', border: THIN_BORDER });

        r.getCell(3).value = p.price;
        styleCell(r.getCell(3), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(4).value = idx === 0 ? `Bậc áp dụng: ${summary.fuelTier.label}` : '';
        styleCell(r.getCell(4), { align: 'left', border: THIN_BORDER });
        rIdx++;
    });

    const endRow = Math.max(startRow, rIdx - 1);
    const avgRow = sheet.getRow(rIdx);
    sheet.mergeCells(`A${rIdx}:B${rIdx}`);
    avgRow.getCell(1).value = 'GIÁ DẦU BÌNH QUÂN / AVERAGE';
    styleCell(avgRow.getCell(1), { bold: true, align: 'center', border: TOTAL_BORDER, fill: TOTAL_FILL });
    styleCell(avgRow.getCell(2), { border: TOTAL_BORDER, fill: TOTAL_FILL });

    avgRow.getCell(3).value = summary.dailyFuelPrices.length > 0
        ? { formula: `ROUND(AVERAGE(C${startRow}:C${endRow}),0)`, result: summary.averageFuelPrice }
        : summary.averageFuelPrice;
    styleCell(avgRow.getCell(3), { bold: true, align: 'right', border: TOTAL_BORDER, fill: TOTAL_FILL, numFmt: '#,##0' });

    avgRow.getCell(4).value = `Khung áp dụng: ${summary.fuelTier.label}`;
    styleCell(avgRow.getCell(4), { bold: true, align: 'left', border: TOTAL_BORDER, fill: TOTAL_FILL });
}

/**
 * Xây dựng Sheet `BK SALAN`.
 */
function buildBargeSummarySheet(workbook: ExcelJS.Workbook, summary: SettlementSummary) {
    const sheet = workbook.addWorksheet('BK SALAN');
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
    sheet.columns = [
        { width: 7 },
        { width: 18 },
        { width: 20 },
        { width: 22 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
        { width: 18 }
    ];

    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = `BẢNG KÊ TỔNG HỢP SÀ LAN NHẬN HÀNG - TÀU ${summary.vesselName}`;
    styleCell(sheet.getCell('A1'), { bold: true, size: 14, align: 'center' });

    const headerRow = sheet.getRow(3);
    headerRow.height = 26;
    [
        'STT',
        'Số phương tiện',
        'Cảng xếp',
        'Cảng dỡ',
        'Khối lượng (kg)',
        'Quy đổi (Tấn)',
        'Ngày đến cảng',
        'Ngày rời phao'
    ].forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        styleCell(c, { bold: true, align: 'center', border: THIN_BORDER, fill: HEADER_FILL, wrapText: true });
    });

    const startRow = 4;
    let curRow = startRow;
    let totalKg = 0;
    let totalTons = 0;

    summary.barges.forEach((b, idx) => {
        const r = sheet.getRow(curRow);
        const kg = Math.round(b.dischargedTons * 1000);
        totalKg += kg;
        totalTons += b.dischargedTons;

        r.getCell(1).value = idx + 1;
        styleCell(r.getCell(1), { align: 'center', border: THIN_BORDER });

        r.getCell(2).value = b.bargeName;
        styleCell(r.getCell(2), { bold: true, align: 'center', border: THIN_BORDER });

        r.getCell(3).value = b.area || 'Cảng Nguyên Ngọc';
        styleCell(r.getCell(3), { align: 'center', border: THIN_BORDER });

        r.getCell(4).value = `Tàu ${summary.vesselName} (Phao Nhà Bè)`;
        styleCell(r.getCell(4), { align: 'left', border: THIN_BORDER });

        r.getCell(5).value = kg;
        styleCell(r.getCell(5), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(6).value = { formula: `ROUND(E${curRow}/1000,2)`, result: b.dischargedTons };
        styleCell(r.getCell(6), { align: 'right', border: THIN_BORDER, numFmt: '#,##0.00' });

        r.getCell(7).value = formatExcelDateStr(b.arrivalTime) || '-';
        styleCell(r.getCell(7), { align: 'center', border: THIN_BORDER });

        r.getCell(8).value = formatExcelDateStr(b.departureTime) || '-';
        styleCell(r.getCell(8), { align: 'center', border: THIN_BORDER });

        curRow++;
    });

    const endRow = Math.max(startRow, curRow - 1);
    const totalRow = sheet.getRow(curRow);
    sheet.mergeCells(`A${curRow}:D${curRow}`);
    totalRow.getCell(1).value = 'TỔNG CỘNG / TOTAL';
    for (let i = 1; i <= 8; i++) {
        styleCell(totalRow.getCell(i), {
            bold: true,
            align: i === 1 ? 'center' : (i === 5 || i === 6 ? 'right' : 'center'),
            border: TOTAL_BORDER,
            fill: TOTAL_FILL
        });
    }
    if (summary.barges.length > 0) {
        totalRow.getCell(5).value = { formula: `SUM(E${startRow}:E${endRow})`, result: totalKg };
        totalRow.getCell(5).numFmt = '#,##0';
        totalRow.getCell(6).value = { formula: `SUM(F${startRow}:F${endRow})`, result: Math.round(totalTons * 100) / 100 };
        totalRow.getCell(6).numFmt = '#,##0.00';
    }
}

/**
 * Xây dựng Sheet Weightlist (`EXPORT XUẤT KHO` hoặc `WL XUẤT SALAN`).
 */
function buildWeightListSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    title: string,
    tickets: any[]
) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
    sheet.columns = [
        { width: 6 },  // STT
        { width: 18 }, // Ngày giờ cân
        { width: 15 }, // Số phiếu
        { width: 14 }, // Biển số xe
        { width: 15 }, // Sà lan nhận
        { width: 20 }, // Kho / Mã lệnh
        { width: 14 }, // Cân lần 1
        { width: 14 }, // Cân lần 2
        { width: 16 }, // Khối lượng hàng (kg)
        { width: 20 }  // Ghi chú
    ];

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = title;
    styleCell(sheet.getCell('A1'), { bold: true, size: 13, align: 'center' });

    const headerRow = sheet.getRow(3);
    headerRow.height = 24;
    [
        'STT',
        'Ngày giờ cân',
        'Số phiếu',
        'Biển số xe',
        'Sà lan nhận',
        'Kho xuất / Nguồn',
        'Cân lần 1 (kg)',
        'Cân lần 2 (kg)',
        'Khối lượng hàng (kg)',
        'Ghi chú'
    ].forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        styleCell(c, { bold: true, align: 'center', border: THIN_BORDER, fill: HEADER_FILL, wrapText: true });
    });

    const startRow = 4;
    let curRow = startRow;
    let totalNet = 0;

    tickets.forEach((t, idx) => {
        const r = sheet.getRow(curRow);
        const netKg = normalizeNetKg(t);
        totalNet += netKg;

        r.getCell(1).value = idx + 1;
        styleCell(r.getCell(1), { align: 'center', border: THIN_BORDER });

        r.getCell(2).value = formatExcelDateStr(t.dateOut || t.dateIn || t.created_at) || '-';
        styleCell(r.getCell(2), { align: 'center', border: THIN_BORDER });

        r.getCell(3).value = t.ticketNo || t.sourceTicketNo || '';
        styleCell(r.getCell(3), { align: 'center', border: THIN_BORDER });

        r.getCell(4).value = t.plateNumber || '';
        styleCell(r.getCell(4), { bold: true, align: 'center', border: THIN_BORDER });

        r.getCell(5).value = t.bargeName || '';
        styleCell(r.getCell(5), { align: 'center', border: THIN_BORDER });

        r.getCell(6).value = t.yard || t.originWarehouseName || '';
        styleCell(r.getCell(6), { align: 'left', border: THIN_BORDER });

        r.getCell(7).value = Number(t.weight1 || 0);
        styleCell(r.getCell(7), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(8).value = Number(t.weight2 || 0);
        styleCell(r.getCell(8), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(9).value = netKg;
        styleCell(r.getCell(9), { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(10).value = t.note || '';
        styleCell(r.getCell(10), { align: 'left', border: THIN_BORDER });

        curRow++;
    });

    const endRow = Math.max(startRow, curRow - 1);
    const totalRow = sheet.getRow(curRow);
    sheet.mergeCells(`A${curRow}:H${curRow}`);
    totalRow.getCell(1).value = 'TỔNG KHỐI LƯỢNG (SUBTOTAL)';
    for (let i = 1; i <= 10; i++) {
        styleCell(totalRow.getCell(i), {
            bold: true,
            align: i === 1 ? 'center' : (i === 9 ? 'right' : 'left'),
            border: TOTAL_BORDER,
            fill: TOTAL_FILL
        });
    }
    if (tickets.length > 0) {
        totalRow.getCell(9).value = { formula: `SUBTOTAL(9,I${startRow}:I${endRow})`, result: totalNet };
    } else {
        totalRow.getCell(9).value = 0;
    }
    totalRow.getCell(9).numFmt = '#,##0';
}

/**
 * Xây dựng Sheet `TRUCK ` (Lưu ý khoảng trắng cuối tên sheet theo đúng mẫu cảng).
 */
function buildTruckSheet(
    workbook: ExcelJS.Workbook,
    summary: SettlementSummary,
    truckTickets: any[]
) {
    const sheet = workbook.addWorksheet('TRUCK ');
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };
    sheet.columns = [
        { width: 6 },  // STT
        { width: 16 }, // Ngày vận chuyển
        { width: 14 }, // Số phiếu
        { width: 14 }, // Biển số xe
        { width: 22 }, // Kho gửi / Nhà máy
        { width: 20 }, // Tuyến / Khu vực
        { width: 14 }, // Khối lượng (kg)
        { width: 13 }, // Quy đổi (Tấn)
        { width: 14 }, // Đơn giá (VNĐ/tấn)
        { width: 18 }  // Thành tiền (VNĐ)
    ];

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = `BẢNG KÊ CHI TIẾT CƯỚC VẬN CHUYỂN ĐƯỜNG BỘ - TÀU ${summary.vesselName}`;
    styleCell(sheet.getCell('A1'), { bold: true, size: 13, align: 'center' });

    const headerRow = sheet.getRow(3);
    headerRow.height = 24;
    [
        'STT',
        'Ngày vận chuyển',
        'Số phiếu',
        'Biển số xe',
        'Kho gửi / Nhà máy',
        'Khu vực / Tuyến',
        'Khối lượng (kg)',
        'Quy đổi (Tấn)',
        'Đơn giá (VNĐ/tấn)',
        'Thành tiền (VNĐ)'
    ].forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        styleCell(c, { bold: true, align: 'center', border: THIN_BORDER, fill: HEADER_FILL, wrapText: true });
    });

    const startRow = 4;
    let curRow = startRow;
    let totalTons = 0;
    let totalAmount = 0;

    truckTickets.forEach((t, idx) => {
        const r = sheet.getRow(curRow);
        const netKg = normalizeNetKg(t);
        const tons = Math.round((netKg / 1000) * 100) / 100;
        const unitPrice = Number(t.unitPrice || 115000);
        const amount = Math.round(tons * unitPrice);

        totalTons += tons;
        totalAmount += amount;

        r.getCell(1).value = idx + 1;
        styleCell(r.getCell(1), { align: 'center', border: THIN_BORDER });

        r.getCell(2).value = formatExcelDateStr(t.dateOut || t.dateIn || t.date) || '-';
        styleCell(r.getCell(2), { align: 'center', border: THIN_BORDER });

        r.getCell(3).value = t.ticketNo || '';
        styleCell(r.getCell(3), { align: 'center', border: THIN_BORDER });

        r.getCell(4).value = t.plateNumber || '';
        styleCell(r.getCell(4), { bold: true, align: 'center', border: THIN_BORDER });

        r.getCell(5).value = t.warehouseName || t.yard || '';
        styleCell(r.getCell(5), { align: 'left', border: THIN_BORDER });

        r.getCell(6).value = t.area || t.routeName || '';
        styleCell(r.getCell(6), { align: 'left', border: THIN_BORDER });

        r.getCell(7).value = netKg;
        styleCell(r.getCell(7), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(8).value = { formula: `ROUND(G${curRow}/1000,2)`, result: tons };
        styleCell(r.getCell(8), { align: 'right', border: THIN_BORDER, numFmt: '#,##0.00' });

        r.getCell(9).value = unitPrice;
        styleCell(r.getCell(9), { align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        r.getCell(10).value = { formula: `ROUND(H${curRow}*I${curRow},0)`, result: amount };
        styleCell(r.getCell(10), { bold: true, align: 'right', border: THIN_BORDER, numFmt: '#,##0' });

        curRow++;
    });

    const endRow = Math.max(startRow, curRow - 1);
    const totalRow = sheet.getRow(curRow);
    sheet.mergeCells(`A${curRow}:G${curRow}`);
    totalRow.getCell(1).value = 'TỔNG CỘNG CƯỚC XE ĐƯỜNG BỘ';
    for (let i = 1; i <= 10; i++) {
        styleCell(totalRow.getCell(i), {
            bold: true,
            align: i === 1 ? 'center' : (i >= 8 ? 'right' : 'center'),
            border: TOTAL_BORDER,
            fill: TOTAL_FILL
        });
    }
    if (truckTickets.length > 0) {
        totalRow.getCell(8).value = { formula: `SUM(H${startRow}:H${endRow})`, result: Math.round(totalTons * 100) / 100 };
        totalRow.getCell(8).numFmt = '#,##0.00';
        totalRow.getCell(10).value = { formula: `SUM(J${startRow}:J${endRow})`, result: totalAmount };
        totalRow.getCell(10).numFmt = '#,##0';
    } else {
        totalRow.getCell(8).value = 0;
        totalRow.getCell(10).value = 0;
        totalRow.getCell(10).numFmt = '#,##0';
    }
}

export const SettlementExcelExporter = {
    /**
     * Xây dựng Workbook 8 Sheet chuẩn mẫu cảng từ SettlementSummary và danh sách phiếu cân.
     */
    buildSettlementWorkbook(
        summary: SettlementSummary,
        flows: SettlementTicketFlows = { exportWarehouseTickets: [], directBargeTickets: [], truckRoadTickets: [] }
    ): ExcelJS.Workbook {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Cảng Nguyên Ngọc - Góc Nhỏ Tiện Ích';
        workbook.created = new Date();

        // Ta tạo Sheet LƯU SÀ LAN tạm thời sau hay trước đều được, nhưng muốn đúng thứ tự 8 sheet:
        // Thứ tự chuẩn mẫu: DNTT 1, Giá dầu, BK SALAN, EXPORT XUẤT KHO, WL XUẤT SALAN, LƯU SÀ LAN, DNTT 2, TRUCK 
        // Nên ta tính trước tọa độ dòng tổng của LƯU SÀ LAN (header ở dòng 4, data bắt đầu từ dòng 5 -> totalRow = 5 + barges.length).
        const predictedDemurrageTotalRow = 5 + summary.barges.length;
        const demurrageCellRef = `'LƯU SÀ LAN'!K${predictedDemurrageTotalRow}`;

        // 1. DNTT 1
        buildDebitNoteSheet(
            workbook,
            'DNTT 1',
            'ĐỀ NGHỊ THANH TOÁN',
            'DEBIT NOTE',
            summary,
            summary.itemsDntt1,
            summary.subTotalDntt1,
            summary.vatAmountDntt1,
            summary.totalAmountDntt1,
            summary.amountInWordsViDntt1,
            summary.amountInWordsEnDntt1,
            demurrageCellRef
        );

        // 2. Giá dầu
        buildFuelPriceSheet(workbook, summary);

        // 3. BK SALAN
        buildBargeSummarySheet(workbook, summary);

        // 4. EXPORT XUẤT KHO
        buildWeightListSheet(
            workbook,
            'EXPORT XUẤT KHO',
            `WEIGHT LIST - HÀNG XUẤT KHO RA SÀ LAN - TÀU ${summary.vesselName}`,
            flows.exportWarehouseTickets
        );

        // 5. WL XUẤT SALAN
        buildWeightListSheet(
            workbook,
            'WL XUẤT SALAN',
            `WEIGHT LIST - HÀNG XE SANG SÀ LAN TRỰC TIẾP - TÀU ${summary.vesselName}`,
            flows.directBargeTickets
        );

        // 6. LƯU SÀ LAN
        buildBargeDemurrageSheet(workbook, summary);

        // 7. DNTT 2
        buildDebitNoteSheet(
            workbook,
            'DNTT 2',
            'ĐỀ NGHỊ THANH TOÁN (CƯỚC VẬN TẢI XE BỘ)',
            'DEBIT NOTE (ROAD TRUCKING)',
            summary,
            summary.itemsDntt2,
            summary.subTotalDntt2,
            summary.vatAmountDntt2,
            summary.totalAmountDntt2,
            summary.amountInWordsViDntt2,
            summary.amountInWordsEnDntt2
        );

        // 8. TRUCK 
        buildTruckSheet(workbook, summary, flows.truckRoadTickets);

        return workbook;
    },

    /**
     * Kích hoạt tải file Excel về trình duyệt.
     */
    async downloadSettlementExcel(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    /**
     * Tạo và tải xuống file Excel trọn gói với tên chuẩn.
     */
    async exportSettlementWorkbook(
        summary: SettlementSummary,
        flows?: SettlementTicketFlows
    ): Promise<string> {
        const workbook = this.buildSettlementWorkbook(summary, flows);
        const now = new Date();
        const dateTag = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9À-ỹ_\s-]/g, '').trim().replace(/\s+/g, '_');
        const filename = `DNTT_${sanitize(summary.cargoName || 'WOOD_PELLET')}_${sanitize(summary.vesselName)}_${dateTag}.xlsx`;
        await this.downloadSettlementExcel(workbook, filename);
        return filename;
    }
};
