/**
 * scripts/verify_parity.cjs
 * Kịch bản kiểm toán tính toàn vẹn và đối chiếu dữ liệu (Parity Check)
 */

// Load env or fallback
const fs = require('fs');
const path = require('path');
try {
    const envPath = path.resolve(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1].trim()]) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
} catch (e) { /* .env file not found, rely on process.env */ }

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('Missing environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    process.exit(1);
}

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const BACKUP_FILE = path.resolve(__dirname, '../.planning/backups/allocator_history_trips_backup_16303.json');

async function getCount(filter = '') {
    const res = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=id${filter}`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Range': '0-0',
            'Prefer': 'count=exact'
        }
    });
    return parseInt(res.headers.get('content-range')?.split('/')[1] || '0', 10);
}

async function verifyParity() {
    console.log('=== [TASK 5] BẮT ĐẦU KIỂM TOÁN TÍNH TOÀN VẸN VÀ ĐỐI CHIẾU DỮ LIỆU ===\n');

    // 1. Kiểm tra backup tĩnh
    if (!fs.existsSync(BACKUP_FILE)) {
        throw new Error(`Không tìm thấy file backup tại ${BACKUP_FILE}`);
    }
    const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    console.log(`1. Tệp backup tĩnh: ${backup.length} bản ghi`);

    // 2. Kiểm tra tổng số bản ghi trong bảng allocator_history_trips
    const totalCount = await getCount();
    console.log(`2. Tổng số bản ghi trong bảng allocator_history_trips: ${totalCount}`);

    // 3. Kiểm tra số bản ghi gốc (is_recovered = false)
    const originalCount = await getCount('&is_recovered=eq.false');
    console.log(`3. Số bản ghi gốc (is_recovered = false): ${originalCount}`);

    // 4. Kiểm tra số bản ghi khôi phục (is_recovered = true)
    const recoveredCount = await getCount('&is_recovered=eq.true');
    console.log(`4. Số bản ghi khôi phục (is_recovered = true): ${recoveredCount}`);

    // 5. Kiểm tra đối chiếu ngẫu nhiên 50 bản ghi giữa backup và database
    console.log('\n5. Đang đối chiếu ngẫu nhiên 50 bản ghi từ backup với database...');
    const sampleIndices = [];
    const step = Math.floor(backup.length / 50);
    for (let i = 0; i < backup.length && sampleIndices.length < 50; i += step) {
        sampleIndices.push(i);
    }

    let matchCount = 0;
    let mismatchCount = 0;

    for (const idx of sampleIndices) {
        const item = backup[idx];
        const ticket = item.ticketNo ? item.ticketNo.trim() : '';
        const plate = item.plateNumber ? item.plateNumber.trim() : '';

        if (!ticket && !plate) continue;

        let queryUrl = `${supabaseUrl}/rest/v1/allocator_history_trips?select=*`;
        if (ticket) {
            queryUrl += `&ticket_no=eq.${encodeURIComponent(ticket)}`;
        } else {
            queryUrl += `&plate_number=eq.${encodeURIComponent(plate)}`;
        }
        queryUrl += '&limit=1';

        const res = await fetch(queryUrl, {
            headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
        });
        const rows = await res.json();

        if (rows && rows.length > 0) {
            const dbRow = rows[0];
            // So khớp các trường chính
            const plateMatch = dbRow.plate_number.replace(/\s+/g, '') === item.plateNumber.replace(/\s+/g, '');
            const weightMatch = Math.abs(Number(dbRow.weight_net) - Number(item.weightNet)) < 0.01;
            if (plateMatch && weightMatch) {
                matchCount++;
            } else {
                mismatchCount++;
                console.warn(`   [Không khớp] Index ${idx}: Ticket=${ticket}, DB plate=${dbRow.plate_number}, Backup plate=${item.plateNumber}`);
            }
        } else {
            mismatchCount++;
            console.warn(`   [Không tìm thấy] Index ${idx}: Ticket=${ticket}, Plate=${plate}`);
        }
    }

    console.log(`\nKết quả so khớp 50 mẫu ngẫu nhiên:`);
    console.log(`- Khớp chính xác: ${matchCount}/50 (${((matchCount / 50) * 100).toFixed(1)}%)`);
    console.log(`- Không khớp: ${mismatchCount}/50`);

    // 6. Tổng kết
    console.log('\n=== TỔNG KẾT KIỂM TOÁN PARITY ===');
    const isOriginalMatch = originalCount >= backup.length;
    const isTotalValid = totalCount === (originalCount + recoveredCount);

    console.log(`- Dữ liệu gốc đầy đủ: ${isOriginalMatch ? '✓ ĐẠT' : '✗ THẤT BẠI'} (${originalCount}/${backup.length})`);
    console.log(`- Dữ liệu khôi phục ghi nhận: ${recoveredCount > 0 ? '✓ ĐẠT' : 'Chưa chạy khôi phục'} (${recoveredCount} bản ghi)`);
    console.log(`- Tính toán tổng số nhất quán: ${isTotalValid ? '✓ ĐẠT' : '✗ THẤT BẠI'} (${totalCount} = ${originalCount} + ${recoveredCount})`);

    if (isOriginalMatch && isTotalValid && mismatchCount === 0) {
        console.log('\n★ XÁC NHẬN: DỮ LIỆU ĐỐI CHIẾU 100% TOÀN VẸN VÀ CHÍNH XÁC!\n');
    } else {
        console.log('\n⚠️ CẦN KIỂM TRA THÊM CÁC ĐIỂM CHƯA KHỚP.\n');
    }

    return {
        total: totalCount,
        original: originalCount,
        recovered: recoveredCount,
        sampleMatches: matchCount,
        isSuccess: isOriginalMatch && isTotalValid && mismatchCount === 0
    };
}

if (require.main === module) {
    verifyParity().catch(err => {
        console.error('LỖI KIỂM TOÁN:', err);
        process.exit(1);
    });
}

module.exports = { verifyParity };
