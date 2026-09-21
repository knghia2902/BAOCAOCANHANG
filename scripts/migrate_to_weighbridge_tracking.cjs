/**
 * scripts/migrate_to_weighbridge_tracking.cjs
 * Nạp dữ liệu 16,303 bản ghi từ file sao lưu JSON vào bảng Supabase weighbridge_tracking
 */

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
} catch (e) {}

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('Thiếu biến môi trường VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.');
    process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const BACKUP_FILE = path.resolve(__dirname, '../.planning/backups/allocator_history_trips_backup_16303.json');

function mapTripToRow(trip) {
    let date1Iso = null;
    let date2Iso = null;
    try {
        if (trip.date1Obj) {
            const d = new Date(trip.date1Obj);
            if (!isNaN(d.getTime())) date1Iso = d.toISOString();
        }
    } catch (e) {}
    try {
        if (trip.date2Obj) {
            const d = new Date(trip.date2Obj);
            if (!isNaN(d.getTime())) date2Iso = d.toISOString();
        }
    } catch (e) {}

    const net = Number(trip.weightNet || 0);
    const tons = typeof trip.weightTons === 'number' && !isNaN(trip.weightTons)
        ? trip.weightTons
        : Number((net / 1000).toFixed(3));

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
        weight_net: net,
        weight_tons: tons,
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
            const res = await fetch(`${supabaseUrl}/rest/v1/weighbridge_tracking`, {
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
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            return;
        } catch (err) {
            if (attempt === maxRetries) {
                throw new Error(`Thất bại đợt ${chunkIndex + 1}/${totalChunks} sau ${maxRetries} lần thử: ${err.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function runMigration() {
    console.log('=== BẮT ĐẦU NẠP DỮ LIỆU VÀO WEIGHBRIDGE_TRACKING ===');
    console.log('1. Đọc file sao lưu JSON:', BACKUP_FILE);
    if (!fs.existsSync(BACKUP_FILE)) {
        console.error('Không tìm thấy file sao lưu:', BACKUP_FILE);
        process.exit(1);
    }

    const rawData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    console.log(`Số bản ghi trong file: ${rawData.length}`);

    // Kiểm tra bảng weighbridge_tracking trên Supabase
    console.log('\n2. Kiểm tra bảng public.weighbridge_tracking trên Supabase...');
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/weighbridge_tracking?select=id&limit=1`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        }
    });

    if (!checkRes.ok) {
        const checkErr = await checkRes.text();
        throw new Error(`Bảng public.weighbridge_tracking chưa sẵn sàng hoặc không tồn tại trên Supabase!\nChi tiết: ${checkErr}\nVui lòng chạy script database/migrations/20260921_create_weighbridge_tracking.sql trên Supabase SQL Editor trước.`);
    }

    // Đếm số lượng hiện tại
    const countRes = await fetch(`${supabaseUrl}/rest/v1/weighbridge_tracking?select=id`, {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Range-Unit': 'items',
            'Range': '0-0',
            'Prefer': 'count=exact'
        }
    });
    const currentCount = countRes.headers.get('content-range')?.split('/')[1] || '0';
    console.log(`Số lượng bản ghi hiện có trong bảng weighbridge_tracking: ${currentCount}`);

    if (parseInt(currentCount, 10) >= rawData.length) {
        console.log('Bảng đã có đầy đủ dữ liệu. Bỏ qua nạp.');
        return;
    }

    // Chuẩn bị batch 500 bản ghi
    const CHUNK_SIZE = 500;
    const mappedRows = rawData.map(mapTripToRow);
    const totalChunks = Math.ceil(mappedRows.length / CHUNK_SIZE);

    console.log(`\n3. Bắt đầu nạp ${mappedRows.length} bản ghi theo ${totalChunks} đợt (mỗi đợt ${CHUNK_SIZE})...`);
    const startTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
        const startIdx = i * CHUNK_SIZE;
        const chunk = mappedRows.slice(startIdx, startIdx + CHUNK_SIZE);
        await insertChunkWithRetry(chunk, i, totalChunks);
        const progress = (((i + 1) / totalChunks) * 100).toFixed(1);
        process.stdout.write(`\rĐã hoàn thành ${i + 1}/${totalChunks} đợt (${progress}%) - Bản ghi: ${Math.min(startIdx + CHUNK_SIZE, mappedRows.length)}/${mappedRows.length}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n🎉 NẠP DỮ LIỆU THÀNH CÔNG! Thời gian: ${duration}s`);
}

runMigration().catch(err => {
    console.error('\n❌ Lỗi:', err.message);
    process.exit(1);
});
