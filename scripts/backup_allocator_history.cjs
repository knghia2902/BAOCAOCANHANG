/**
 * scripts/backup_allocator_history.cjs
 * Sao lưu an toàn 16,303 bản ghi lịch sử phân bổ từ content.settings ra file JSON tĩnh
 */

const crypto = require('crypto');

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

const BACKUP_DIR = path.resolve(__dirname, '../.planning/backups');
const BACKUP_FILE = path.join(BACKUP_DIR, 'allocator_history_trips_backup_16303.json');

async function backupAllocatorHistory() {
    console.log('=== [TASK 2] BẮT ĐẦU SAO LƯU ALLOCATOR_HISTORY_TRIPS ===');
    console.log('Đang kết nối Supabase:', supabaseUrl);

    const startTime = Date.now();
    const res = await fetch(`${supabaseUrl}/rest/v1/content?id=eq.main&select=settings`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        }
    });

    if (!res.ok) {
        throw new Error(`HTTP Error fetching content: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const settings = data[0]?.settings || {};
    const historyTrips = settings.allocator_history_trips;

    if (!Array.isArray(historyTrips)) {
        throw new Error('LỖI: allocator_history_trips không phải là một mảng hoặc không tồn tại!');
    }

    console.log(`Đã tải dữ liệu thành công trong ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`Số lượng bản ghi tìm thấy: ${historyTrips.length}`);

    if (historyTrips.length < 16000) {
        throw new Error(`CẢNH BÁO: Số lượng bản ghi (${historyTrips.length}) ít hơn ngưỡng an toàn 16,000! Dừng sao lưu để tránh mất dữ liệu.`);
    }

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const jsonString = JSON.stringify(historyTrips, null, 2);
    fs.writeFileSync(BACKUP_FILE, jsonString, 'utf8');

    const fileStats = fs.statSync(BACKUP_FILE);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    const md5Hash = crypto.createHash('md5').update(jsonString).digest('hex');

    console.log('\n--- KẾT QUẢ SAO LƯU TĨNH ---');
    console.log(`Đường dẫn tệp: ${BACKUP_FILE}`);
    console.log(`Số bản ghi sao lưu: ${historyTrips.length}`);
    console.log(`Kích thước tệp: ${fileSizeMB} MB (${fileStats.size} bytes)`);
    console.log(`Mã MD5 Checksum: ${md5Hash}`);
    console.log('----------------------------');
    console.log('✓ Sao lưu dữ liệu tĩnh THÀNH CÔNG và TOÀN VẸN.\n');

    return { count: historyTrips.length, file: BACKUP_FILE, md5: md5Hash, sizeMB: fileSizeMB };
}

if (require.main === module) {
    backupAllocatorHistory().catch(err => {
        console.error('LỖI SAO LƯU:', err);
        process.exit(1);
    });
}

module.exports = { backupAllocatorHistory, BACKUP_FILE };
