/**
 * scripts/recover_missing_trips.cjs
 * Kịch bản khôi phục các chuyến xe thiếu từ 11/09 đến 15/09 từ weighbridge_trucks
 * 
 * Cách dùng:
 *   node scripts/recover_missing_trips.cjs --preview   (Xem trước báo cáo thống kê, không ghi dữ liệu)
 *   node scripts/recover_missing_trips.cjs --confirm   (Ghi dữ liệu khôi phục vào allocator_history_trips)
 */

const fs = require('fs');
const path = require('path');

// Load env or fallback
let supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kiyxwskilrhhikieabtp.supabase.co';
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpeXh3c2tpbHJoaGlraWVhYnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjk0MDAsImV4cCI6MjA5NzYwNTQwMH0._hlrV0JwSfBNp8SDuiyTraCGdnmPvMYuCtTaViFCotE';

try {
    const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);
    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (keyMatch) supabaseAnonKey = keyMatch[1].trim();
} catch (e) {}

const isConfirmMode = process.argv.includes('--confirm');
const isPreviewMode = !isConfirmMode || process.argv.includes('--preview');

// Format Date to DD/MM/YYYY
function formatVnDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Format Date to HH:mm:ss\nDD/MM/YYYY
function formatTimeStr(date) {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}\n${formatVnDate(d)}`;
}

// Calculate vehicle capacity/limit
function getVehicleLimit(plateNumber) {
    const clean = (plateNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Default approximations if registry not present
    const isTrailer = clean.includes('R') || clean.includes('RM');
    if (isTrailer) {
        return { tttp: 10, limit: 31.5 };
    }
    return { tttp: 10, limit: 14.5 };
}

async function fetchAllTrucks() {
    let allTrucks = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
        const res = await fetch(`${supabaseUrl}/rest/v1/weighbridge_trucks?select=*&order=id.asc&offset=${offset}&limit=${limit}`, {
            headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch trucks: ${res.status} ${res.statusText}`);
        }
        const batch = await res.json();
        if (!batch || batch.length === 0) break;
        allTrucks = allTrucks.concat(batch);
        offset += batch.length;
        if (batch.length < limit) break;
    }
    return allTrucks;
}

async function fetchBargesAndVessels() {
    const [bRes, vRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/weighbridge_barges?select=id,name,vessel_id,config`, {
            headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
        }),
        fetch(`${supabaseUrl}/rest/v1/weighbridge_vessels?select=id,name`, {
            headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
        })
    ]);

    const barges = await bRes.json();
    const vessels = await vRes.json();

    const vesselMap = {};
    vessels.forEach(v => { vesselMap[v.id] = v.name; });

    const bargeMap = {};
    barges.forEach(b => {
        const cfg = b.config || {};
        bargeMap[b.id] = {
            bargeName: b.name,
            vesselName: vesselMap[b.vessel_id] || '',
            orderNo: cfg.orderNo || '',
            customer: cfg.customer || cfg.owner || cfg.operator || '',
            cargoType: cfg.cargoType || cfg.goods || '',
            direction: cfg.direction || cfg.xn || 'Xuất'
        };
    });

    return bargeMap;
}

async function getExistingHistoryTickets() {
    // Check if table allocator_history_trips exists and has rows
    const tableCheck = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=ticket_no&limit=1`, {
        headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
    });

    if (tableCheck.ok) {
        console.log('Đang đọc vé hiện có từ bảng allocator_history_trips...');
        let tickets = new Set();
        let offset = 0;
        const limit = 1000;
        while (true) {
            const res = await fetch(`${supabaseUrl}/rest/v1/allocator_history_trips?select=ticket_no,source_ticket_no&order=id.asc&offset=${offset}&limit=${limit}`, {
                headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
            });
            const batch = await res.json();
            if (!batch || batch.length === 0) break;
            batch.forEach(row => {
                if (row.ticket_no) tickets.add(row.ticket_no.trim());
                if (row.source_ticket_no) tickets.add(row.source_ticket_no.trim());
            });
            offset += batch.length;
            if (batch.length < limit) break;
        }
        if (tickets.size > 0) return tickets;
    }

    // Fallback to static backup file
    const backupFile = path.resolve(__dirname, '../.planning/backups/allocator_history_trips_backup_16303.json');
    if (fs.existsSync(backupFile)) {
        console.log('Đang đọc vé hiện có từ tệp sao lưu tĩnh...');
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        const tickets = new Set();
        backup.forEach(t => {
            if (t.ticketNo) tickets.add(String(t.ticketNo).trim());
            if (t.sourceTicketNo) tickets.add(String(t.sourceTicketNo).trim());
        });
        return tickets;
    }

    return new Set();
}

async function insertChunk(chunk) {
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
        throw new Error(`HTTP ${res.status}: ${errText}`);
    }
}

async function main() {
    console.log('=== [TASK 4] KHÔI PHỤC CHUYẾN XE THIẾU TỪ WEIGHBRIDGE_TRUCKS ===');
    console.log(`Chế độ: ${isConfirmMode ? '▶ THỰC THI GHI VÀO CƠ SỞ DỮ LIỆU (--confirm)' : '🔍 XEM TRƯỚC BÁO CÁO (--preview)'}\n`);

    // 1. Lấy vé hiện có
    const existingTickets = await getExistingHistoryTickets();
    console.log(`Số vé đã có trong lịch sử: ${existingTickets.size}`);

    // 2. Lấy sà lan & tàu
    console.log('Đang tải danh sách sà lan và tàu...');
    const bargeMap = await fetchBargesAndVessels();

    // 3. Lấy toàn bộ weighbridge_trucks
    console.log('Đang tải toàn bộ phiếu cân weighbridge_trucks...');
    const allTrucks = await fetchAllTrucks();
    console.log(`Tổng số phiếu cân trong weighbridge_trucks: ${allTrucks.length}`);

    // 4. Lọc các chuyến chưa có trong lịch sử (đặc biệt khoảng 11/09 - 15/09)
    const missingTrucks = allTrucks.filter(t => {
        const ticket = String(t.ticket_no || '').trim();
        return ticket && !existingTickets.has(ticket);
    });

    console.log(`\n=> TÌM THẤY ${missingTrucks.length} CHUYẾN XE CHƯA CÓ TRONG LỊCH SỬ!`);

    // 5. Thống kê theo ngày (UTC+7)
    const breakdown = {};
    let totalNetWeight = 0;

    const reconstructedTrips = missingTrucks.map((t, idx) => {
        const barge = bargeMap[t.barge_id] || {};
        const dStr = t.date_out || t.date_in || t.created_at;
        const weighDate = dStr ? new Date(dStr) : new Date();
        const cap = getVehicleLimit(t.plate_number);

        // Group by Date UTC+7
        const vnDate = new Date(weighDate.getTime() + 7 * 3600 * 1000);
        const ymd = vnDate.toISOString().substring(0, 10);
        if (!breakdown[ymd]) {
            breakdown[ymd] = { count: 0, weightNet: 0, barges: new Set(), customers: new Set() };
        }
        const net = Number(t.weight_net || 0);
        breakdown[ymd].count++;
        breakdown[ymd].weightNet += net;
        totalNetWeight += net;
        if (barge.bargeName) breakdown[ymd].barges.add(barge.bargeName);
        if (barge.customer) breakdown[ymd].customers.add(barge.customer);

        let date1Iso = null;
        let date2Iso = null;
        try { if (t.date_in) date1Iso = new Date(t.date_in).toISOString(); } catch(e) {}
        try { if (t.date_out) date2Iso = new Date(t.date_out).toISOString(); } catch(e) {}
        if (!date1Iso) date1Iso = weighDate.toISOString();
        if (!date2Iso) date2Iso = date1Iso;

        return {
            stt: idx + 1,
            time_str: formatTimeStr(weighDate),
            plate_number: String(t.plate_number || '').trim(),
            tttp: cap.tttp,
            limit_weight: cap.limit,
            ticket_no: String(t.ticket_no || '').trim(),
            source_ticket_no: String(t.ticket_no || '').trim(),
            cargo_type: barge.cargoType || 'Hàng rời',
            weight_1: Number(t.weight_1 || 0),
            weight_2: Number(t.weight_2 || 0),
            weight_net: net,
            weight_tons: Number((net / 1000).toFixed(3)),
            direction: barge.direction || 'Xuất',
            barge_name: barge.bargeName || '',
            order_no: barge.orderNo || '',
            customer: barge.customer || '',
            date1_obj: date1Iso,
            date2_obj: date2Iso,
            notes: 'Khôi phục từ phiếu cân',
            is_recovered: true
        };
    });

    console.log('\n--- BÁO CÁO THỐNG KÊ THEO NGÀY (UTC+7) ---');
    console.table(Object.entries(breakdown).sort().map(([date, stat]) => ({
        'Ngày (YMD)': date,
        'Số chuyến': stat.count,
        'Khối lượng (Tấn)': (stat.weightNet / 1000).toFixed(2),
        'Số sà lan': stat.barges.size,
        'Số khách hàng': stat.customers.size
    })));
    console.log(`Tổng khối lượng khôi phục: ${(totalNetWeight / 1000).toFixed(2)} tấn\n`);

    if (reconstructedTrips.length > 0) {
        console.log('--- MẪU 3 CHUYẾN ĐẦU TIÊN ---');
        console.log(JSON.stringify(reconstructedTrips.slice(0, 3), null, 2));
        console.log('\n--- MẪU 3 CHUYẾN CUỐI CÙNG ---');
        console.log(JSON.stringify(reconstructedTrips.slice(-3), null, 2));
    }

    // 6. Ghi vào database nếu có cờ --confirm
    if (isConfirmMode) {
        if (reconstructedTrips.length === 0) {
            console.log('Không có chuyến xe nào cần khôi phục.');
            return;
        }

        console.log(`\n▶ BẮT ĐẦU CHÈN ${reconstructedTrips.length} CHUYẾN XE VÀO BẢNG allocator_history_trips...`);
        const CHUNK_SIZE = 500;
        const totalChunks = Math.ceil(reconstructedTrips.length / CHUNK_SIZE);
        const startTime = Date.now();

        for (let i = 0; i < totalChunks; i++) {
            const startIdx = i * CHUNK_SIZE;
            const endIdx = Math.min(startIdx + CHUNK_SIZE, reconstructedTrips.length);
            const chunk = reconstructedTrips.slice(startIdx, endIdx);

            process.stdout.write(`[Đợt ${i + 1}/${totalChunks}] Đang chèn từ chuyến ${startIdx + 1} đến ${endIdx}... `);
            await insertChunk(chunk);
            process.stdout.write('✓ OK\n');
        }

        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✓ Khôi phục thành công ${reconstructedTrips.length} chuyến xe trong ${elapsedSec}s!`);
    } else {
        console.log('\n[Ghi chú] Chạy với cờ --confirm để thực hiện ghi các chuyến xe trên vào cơ sở dữ liệu.');
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('LỖI KHÔI PHỤC:', err);
        process.exit(1);
    });
}

module.exports = { main };
