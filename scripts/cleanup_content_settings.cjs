/**
 * scripts/cleanup_content_settings.cjs
 * Dọn dẹp an toàn khối JSON 7.2MB (allocator_history_trips) khỏi bảng content.settings
 * 
 * Safety Guards:
 *   1. Tệp sao lưu tĩnh .planning/backups/allocator_history_trips_backup_16303.json phải tồn tại và >= 8MB.
 *   2. Bảng allocator_history_trips trên Supabase phải có >= 17,900 bản ghi.
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

async function cleanupContentSettings() {
    console.log('=== [TASK 4] DỌN DẸP AN TOÀN BLOB ALLOCATOR_HISTORY_TRIPS TRONG CONTENT.SETTINGS ===\n');

    // 1. Safety Guard 1: Kiểm tra tệp sao lưu tĩnh
    console.log('1. Kiểm tra Safety Guard 1 (Tệp sao lưu tĩnh)...');
    if (!fs.existsSync(BACKUP_FILE)) {
        throw new Error(`[NGĂN CHẶN AN TOÀN] Không tìm thấy tệp sao lưu tĩnh tại ${BACKUP_FILE}! Hủy thao tác.`);
    }
    const stat = fs.statSync(BACKUP_FILE);
    if (stat.size < 8 * 1024 * 1024) {
        throw new Error(`[NGĂN CHẶN AN TOÀN] Kích thước tệp sao lưu quá nhỏ (${(stat.size / 1024 / 1024).toFixed(2)} MB < 8 MB)! Hủy thao tác.`);
    }
    console.log(`   ✓ Tệp sao lưu tĩnh hợp lệ: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

    // 2. Safety Guard 2: Kiểm tra bảng allocator_history_trips
    console.log('2. Kiểm tra Safety Guard 2 (Số lượng bản ghi trong bảng allocator_history_trips)...');
    const countRes = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=id`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Range': '0-0',
            'Prefer': 'count=exact'
        }
    });
    if (!countRes.ok) {
        throw new Error(`[NGĂN CHẶN AN TOÀN] Không thể truy vấn bảng allocator_history_trips: ${countRes.statusText}`);
    }
    const totalInDb = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);
    console.log(`   ✓ Số bản ghi hiện có trong bảng allocator_history_trips: ${totalInDb}`);

    if (totalInDb < 17900) {
        throw new Error(`[NGĂN CHẶN AN TOÀN] Bảng allocator_history_trips chỉ có ${totalInDb} bản ghi (< 17,900)! Chưa hoàn tất migration/recovery. Hủy thao tác.`);
    }

    console.log('\n=> TẤT CẢ CÁC ĐIỀU KIỆN AN TOÀN ĐÃ THỎA MÃN (100% PASS).\n');

    // 3. Đọc content.settings hiện tại
    console.log('3. Đang đọc cấu hình content.settings từ Supabase...');
    const getRes = await fetch(`${supabaseUrl}/rest/v1/content?id=eq.main&select=settings`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        }
    });
    const getContent = await getRes.json();
    const currentSettings = getContent[0]?.settings || {};
    const beforeBytes = Buffer.byteLength(JSON.stringify(currentSettings), 'utf8');
    const beforeMB = (beforeBytes / (1024 * 1024)).toFixed(2);
    console.log(`   Kích thước settings trước khi dọn dẹp: ${beforeMB} MB (${beforeBytes} bytes)`);

    if (!currentSettings.allocator_history_trips) {
        console.log('   ✓ Key allocator_history_trips đã được xóa trước đó hoặc không tồn tại. Không cần dọn dẹp.');
        return;
    }

    // 4. Tạo settings mới đã loại bỏ allocator_history_trips
    const newSettings = { ...currentSettings };
    delete newSettings.allocator_history_trips;

    const afterBytes = Buffer.byteLength(JSON.stringify(newSettings), 'utf8');
    const afterKB = (afterBytes / 1024).toFixed(2);
    console.log(`   Kích thước settings sau khi loại bỏ key: ${afterKB} KB (${afterBytes} bytes)`);

    // 5. Cập nhật lại hàng 'main' trong bảng content
    console.log('4. Đang gửi yêu cầu cập nhật lên Supabase...');
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/content?id=eq.main`, {
        method: 'PATCH',
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ settings: newSettings })
    });

    if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Lỗi cập nhật Supabase: ${updateRes.status} ${errText}`);
    }

    console.log('\n--- KẾT QUẢ DỌN DẸP AN TOÀN ---');
    console.log(`Trước dọn dẹp: ${beforeMB} MB`);
    console.log(`Sau dọn dẹp:   ${afterKB} KB (Giảm ${((beforeBytes - afterBytes) / beforeBytes * 100).toFixed(1)}%)`);
    console.log('------------------------------');
    console.log('✓ Đã loại bỏ hoàn toàn khối JSON cồng kềnh khỏi content.settings an toàn và thành công!\n');
}

if (require.main === module) {
    cleanupContentSettings().catch(err => {
        console.error('LỖI DỌN DẸP:', err);
        process.exit(1);
    });
}

module.exports = { cleanupContentSettings };
