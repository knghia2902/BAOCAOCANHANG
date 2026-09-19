/**
 * scripts/migrate_allocator_history.cjs
 * Di chuyển 16,303 bản ghi từ file sao lưu JSON vào bảng Supabase allocator_history_trips
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
    try {
        if (trip.date2Obj) date2Iso = new Date(trip.date2Obj).toISOString();
    } catch (e) {}

    return {
        stt: typeof trip.stt === 'number' ? trip.stt : parseInt(trip.stt || 0, 10),
        time_str: trip.timeStr || '',
        plate_number: String(trip.plateNumber || '').trim(),
        tttp: Number(trip.tttp || 0),
        limit_weight: Number(trip.limit || 0),
        ticket_no: trip.ticketNo || '',
        source_ticket_no: trip.sourceTicketNo || '',
        cargo_type: trip.cargoType || '',
        weight_1: Number(trip.weight1 || 0),
        weight_2: Number(trip.weight2 || 0),
        weight_net: Number(trip.weightNet || 0),
        weight_tons: Number(trip.weightTons || 0),
        direction: trip.direction || 'Xuất',
        barge_name: trip.bargeName || '',
        order_no: trip.orderNo || '',
        customer: trip.customer || '',
        date1_obj: date1Iso,
        date2_obj: date2Iso,
        notes: trip.notes || '',
        is_recovered: false
    };
}

async function insertChunkWithRetry(chunk, chunkIndex, totalChunks, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(chunk)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
            }

            return;
        } catch (err) {
            console.warn(`[Cảnh báo] Lỗi đợt ${chunkIndex}/${totalChunks} (lần thử ${attempt}/${maxRetries}): ${err.message}`);
            if (attempt === maxRetries) {
                throw err;
            }
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }
    }
}

async function migrateAllocatorHistory() {
    console.log('=== [TASK 3] BẮT ĐẦU DI CHUYỂN DỮ LIỆU ALLOCATOR_HISTORY_TRIPS ===');

    if (!fs.existsSync(BACKUP_FILE)) {
        throw new Error(`Không tìm thấy file sao lưu tĩnh tại ${BACKUP_FILE}! Vui lòng chạy scripts/backup_allocator_history.cjs trước.`);
    }

    console.log('Đang đọc tệp sao lưu tĩnh...');
    const rawData = fs.readFileSync(BACKUP_FILE, 'utf8');
    const trips = JSON.parse(rawData);
    console.log(`Đã đọc ${trips.length} bản ghi từ tệp sao lưu.`);

    // 1. Kiểm tra bảng đích đã sẵn sàng chưa
    console.log('Kiểm tra bảng public.allocator_history_trips trên Supabase...');
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=id&limit=1`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        }
    });

    if (!checkRes.ok) {
        const checkErr = await checkRes.text();
        throw new Error(`Bảng public.allocator_history_trips chưa sẵn sàng hoặc không tồn tại trên Supabase!\nChi tiết: ${checkErr}\nHãy chạy migration DDL trước.`);
    }

    // 2. Kiểm tra xem bảng đã có dữ liệu chưa
    const countRes = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=id`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Range': '0-0',
            'Prefer': 'count=exact'
        }
    });
    const currentCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0', 10);
    console.log(`Số lượng bản ghi hiện có trong bảng allocator_history_trips: ${currentCount}`);

    if (currentCount >= trips.length) {
        console.log(`✓ Bảng đã có sẵn ${currentCount} bản ghi (>= ${trips.length}). Không cần di chuyển lại.`);
        return { migrated: 0, total: currentCount };
    }

    // 3. Tiến hành map và insert theo chunk
    console.log(`Chuẩn bị chuyển đổi và chèn ${trips.length} bản ghi theo các đợt ${CHUNK_SIZE}...`);
    const mappedTrips = trips.map(mapTripToDb);
    const totalChunks = Math.ceil(mappedTrips.length / CHUNK_SIZE);
    const startTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
        const startIdx = i * CHUNK_SIZE;
        const endIdx = Math.min(startIdx + CHUNK_SIZE, mappedTrips.length);
        const chunk = mappedTrips.slice(startIdx, endIdx);

        process.stdout.write(`[Đợt ${i + 1}/${totalChunks}] Đang chèn từ bản ghi ${startIdx + 1} đến ${endIdx}... `);
        await insertChunkWithRetry(chunk, i + 1, totalChunks);
        process.stdout.write('✓ OK\n');
    }

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nHoàn thành chèn tất cả các đợt trong ${elapsedSec}s!`);

    // 4. Xác nhận số lượng sau migration
    const finalCountRes = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=id`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Range': '0-0',
            'Prefer': 'count=exact'
        }
    });
    const finalCount = parseInt(finalCountRes.headers.get('content-range')?.split('/')[1] || '0', 10);
    console.log(`\n--- KẾT QUẢ DI CHUYỂN DỮ LIỆU ---`);
    console.log(`Số bản ghi ban đầu từ backup: ${trips.length}`);
    console.log(`Số bản ghi trong bảng sau migration: ${finalCount}`);
    console.log('---------------------------------');

    if (finalCount < trips.length) {
        throw new Error(`CẢNH BÁO: Số bản ghi sau migration (${finalCount}) ít hơn số bản ghi backup (${trips.length})!`);
    }

    console.log('✓ Di chuyển 16,303 bản ghi lịch sử THÀNH CÔNG!\n');
    return { migrated: trips.length, total: finalCount };
}

if (require.main === module) {
    migrateAllocatorHistory().catch(err => {
        console.error('\nLỖI DI CHUYỂN DỮ LIỆU:', err);
        process.exit(1);
    });
}

module.exports = { migrateAllocatorHistory };
