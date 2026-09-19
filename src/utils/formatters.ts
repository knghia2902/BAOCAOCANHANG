export const formatDateTimeStr = (isoString: string): string => {
    if (!isoString) return '';
    try {
        const str = String(isoString).trim();

        // 1. Direct YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm regex extraction
        const match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[T\s]+(\d{1,2}):(\d{1,2})/);
        if (match && match[1] && match[2] && match[3] && match[4] && match[5]) {
            const y = match[1];
            const m = match[2];
            const d = match[3];
            const h = match[4];
            const min = match[5];
            return `${h.padStart(2, '0')}:${min.padStart(2, '0')} ${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }

        // 2. Direct DD/MM/YYYY HH:mm regex extraction
        const matchDmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s]+(\d{1,2}):(\d{1,2})/);
        if (matchDmy && matchDmy[1] && matchDmy[2] && matchDmy[3] && matchDmy[4] && matchDmy[5]) {
            const d = matchDmy[1];
            const m = matchDmy[2];
            const y = matchDmy[3];
            const h = matchDmy[4];
            const min = matchDmy[5];
            return `${h.padStart(2, '0')}:${min.padStart(2, '0')} ${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
        }

        // 3. Fallback: Parse using local Date (replacing T with space to force local parsing)
        const localStr = str.replace('T', ' ');
        const date = new Date(localStr);
        if (isNaN(date.getTime())) return isoString;
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} ${d}/${m}/${y}`;
    } catch(e) {
        return isoString;
    }
};

export const docSoThanhChu = (so: number): string => {
    const rounded = Math.round(so);
    if (rounded === 0) return "Không kg";
    const ChuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    
    function docXetChuc(chuc: number, donvi: number, KetQua: string) {
        if (chuc > 1) {
            KetQua += " " + ChuSo[chuc] + " mươi";
            if (donvi === 1) KetQua += " mốt";
            else if (donvi === 5) KetQua += " lăm";
            else if (donvi > 0) KetQua += " " + ChuSo[donvi];
        } else if (chuc === 1) {
            KetQua += " mười";
            if (donvi === 1) KetQua += " một";
            else if (donvi === 5) KetQua += " lăm";
            else if (donvi > 0) KetQua += " " + ChuSo[donvi];
        } else {
            if (donvi > 0) {
                if (KetQua !== "") KetQua += " lẻ";
                KetQua += " " + ChuSo[donvi];
            }
        }
        return KetQua;
    }

    function Doc3ChuSo(baso: number, daydu: boolean) {
        let tram = Math.floor(baso / 100);
        let chuc = Math.floor((baso % 100) / 10);
        let donvi = baso % 10;
        let KetQua = "";
        
        if (tram === 0 && chuc === 0 && donvi === 0) return "";
        
        if (daydu || tram > 0) {
            KetQua += " " + ChuSo[tram] + " trăm";
            KetQua = docXetChuc(chuc, donvi, KetQua);
        } else {
            KetQua = docXetChuc(chuc, donvi, KetQua);
        }
        return KetQua;
    }

    let strSo = String(Math.abs(rounded));
    let sochech = strSo.length % 3;
    if (sochech === 1) strSo = "00" + strSo;
    else if (sochech === 2) strSo = "0" + strSo;

    let nhom3 = [];
    for (let i = 0; i < strSo.length; i += 3) {
        nhom3.push(parseInt(strSo.slice(i, i + 3)));
    }

    const DonViLon = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    let KetQuaFinal = "";
    let countNhom = nhom3.length;
    
    for (let i = 0; i < countNhom; i++) {
        const val = nhom3[i];
        if (val === undefined) continue;
        const isDayDu = i > 0;
        const chuNhom = Doc3ChuSo(val, isDayDu);
        if (chuNhom !== "") {
            KetQuaFinal += chuNhom + DonViLon[countNhom - 1 - i];
        }
    }

    let text = KetQuaFinal.trim().replace(/\s+/g, ' ');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return text + " kg";
};
