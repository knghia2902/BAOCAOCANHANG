const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigitsVi(threeDigits: number, isHighest = false): string {
    const hundreds = Math.floor(threeDigits / 100);
    const tens = Math.floor((threeDigits % 100) / 10);
    const units = threeDigits % 10;

    let res = '';

    if (hundreds > 0 || !isHighest) {
        res += VI_DIGITS[hundreds] + ' trăm ';
    }

    if (tens > 1) {
        res += VI_DIGITS[tens] + ' mươi ';
        if (units === 1) res += 'mốt ';
        else if (units === 5) res += 'lăm ';
        else if (units > 0) res += VI_DIGITS[units] + ' ';
    } else if (tens === 1) {
        res += 'mười ';
        if (units === 5) res += 'lăm ';
        else if (units > 0) res += VI_DIGITS[units] + ' ';
    } else {
        // tens === 0
        if (units > 0) {
            if (hundreds > 0 || !isHighest) res += 'lẻ ';
            res += VI_DIGITS[units] + ' ';
        }
    }

    return res.trim();
}

/**
 * Đọc số tiền nguyên sang chữ Tiếng Việt chuẩn tài chính Việt Nam.
 * Ví dụ: 1839679691 -> "Một tỷ tám trăm ba mươi chín triệu sáu trăm bảy mươi chín nghìn sáu trăm chín mươi mốt đồng chẵn."
 */
export function numberToVietnameseWords(amount: number): string {
    const rounded = Math.round(Math.abs(amount));
    if (rounded === 0) return 'Không đồng chẵn.';

    const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    let remaining = rounded;
    const groups: number[] = [];

    while (remaining > 0) {
        groups.push(remaining % 1000);
        remaining = Math.floor(remaining / 1000);
    }

    const wordsParts: string[] = [];

    for (let i = groups.length - 1; i >= 0; i--) {
        const val = groups[i]!;
        if (val > 0) {
            const isHighest = (i === groups.length - 1);
            const partText = readThreeDigitsVi(val, isHighest);
            const scaleName = scales[i];
            wordsParts.push(scaleName ? `${partText} ${scaleName}` : partText);
        }
    }

    let result = wordsParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!result) return 'Không đồng chẵn.';

    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn.';
    return result;
}

const EN_ONES = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen'
];

const EN_TENS = [
    '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'
];

function readThreeDigitsEn(n: number): string {
    const hundreds = Math.floor(n / 100);
    const rem = n % 100;
    const parts: string[] = [];

    if (hundreds > 0) {
        parts.push(EN_ONES[hundreds] + ' hundred');
    }

    if (rem > 0) {
        if (rem < 20) {
            parts.push(EN_ONES[rem]!);
        } else {
            const tens = Math.floor(rem / 10);
            const units = rem % 10;
            parts.push(units > 0 ? `${EN_TENS[tens]}-${EN_ONES[units]}` : EN_TENS[tens]!);
        }
    }

    return parts.join(' ');
}

/**
 * Đọc số tiền sang chữ Tiếng Anh chuẩn Debit Note quốc tế.
 * Ví dụ: 1839679691 -> "One billion, eight hundred thirty-nine million, six hundred seventy-nine thousand, six hundred ninety-one Dong."
 */
export function numberToEnglishWords(amount: number): string {
    const rounded = Math.round(Math.abs(amount));
    if (rounded === 0) return 'Zero Dong.';

    const scales = ['', 'thousand', 'million', 'billion', 'trillion'];
    let remaining = rounded;
    const groups: number[] = [];

    while (remaining > 0) {
        groups.push(remaining % 1000);
        remaining = Math.floor(remaining / 1000);
    }

    const parts: string[] = [];

    for (let i = groups.length - 1; i >= 0; i--) {
        const val = groups[i]!;
        if (val > 0) {
            const word = readThreeDigitsEn(val);
            const scale = scales[i];
            parts.push(scale ? `${word} ${scale}` : word);
        }
    }

    let result = parts.join(', ').replace(/\s+/g, ' ').trim();
    if (!result) return 'Zero Dong.';

    result = result.charAt(0).toUpperCase() + result.slice(1) + ' Dong.';
    return result;
}
