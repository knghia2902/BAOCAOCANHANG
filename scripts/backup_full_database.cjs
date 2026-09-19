/**
 * backup_full_database.cjs
 * Sao lưu toàn diện toàn bộ cơ sở dữ liệu Supabase ra thư mục .planning/backups/
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLES = [
    { name: 'content', primaryKey: 'id', isLarge: false },
    { name: 'weighbridge_vessels', primaryKey: 'id', isLarge: false },
    { name: 'weighbridge_barges', primaryKey: 'id', isLarge: false },
    { name: 'weighbridge_trucks', primaryKey: 'id', isLarge: true },
    { name: 'weighbridge_tracking', primaryKey: 'id', isLarge: true },
    { name: 'vehicle_profiles', primaryKey: 'id', isLarge: false },
    { name: 'weighbridge_vehicles', primaryKey: 'id', isLarge: false },
    { name: 'activity_logs', primaryKey: 'id', isLarge: false },
    { name: 'users', primaryKey: 'id', isLarge: false }
];

async function fetchTableData(table) {
    if (!table.isLarge) {
        const { data, error } = await supabase.from(table.name).select('*');
        if (error) throw error;
        return data || [];
    }

    // Paginated fetch for large tables
    let allRows = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from(table.name)
            .select('*')
            .order(table.primaryKey, { ascending: true })
            .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
            allRows = allRows.concat(data);
            from += PAGE_SIZE;
            if (data.length < PAGE_SIZE) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    return allRows;
}

async function runBackup() {
    console.log('====================================================');
    console.log('🚀 BẮT ĐẦU SAO LƯU TOÀN DIỆN DATABASE SUPABASE');
    console.log('Supabase URL:', supabaseUrl);
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    const backupDir = path.join(projectRoot, '.planning/backups', `backup_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('Thư mục sao lưu:', backupDir);
    console.log('----------------------------------------------------');

    const manifest = {
        timestamp: now.toISOString(),
        backupDir: backupDir,
        tables: {},
        totalRecords: 0,
        totalSizeBytes: 0
    };

    const startTime = Date.now();

    for (const table of TABLES) {
        process.stdout.write(`📦 Đang sao lưu bảng ${table.name.padEnd(25)}: `);
        const tStart = Date.now();
        try {
            const rows = await fetchTableData(table);
            const jsonStr = JSON.stringify(rows, null, 2);
            const filePath = path.join(backupDir, `${table.name}.json`);
            fs.writeFileSync(filePath, jsonStr, 'utf8');

            const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');
            const md5 = crypto.createHash('md5').update(jsonStr).digest('hex');
            const timeElapsed = ((Date.now() - tStart) / 1000).toFixed(2);

            manifest.tables[table.name] = {
                records: rows.length,
                sizeBytes: sizeBytes,
                sizeFormatted: (sizeBytes / 1024).toFixed(2) + ' KB',
                md5: md5,
                timeSeconds: Number(timeElapsed)
            };
            manifest.totalRecords += rows.length;
            manifest.totalSizeBytes += sizeBytes;

            console.log(`✅ ${String(rows.length).padStart(6)} bản ghi (${(sizeBytes / 1024).toFixed(1)} KB) - ${timeElapsed}s`);
        } catch (err) {
            console.log(`❌ LỖI: ${err.message}`);
            manifest.tables[table.name] = { error: err.message };
        }
    }

    // Write manifest
    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Also write a latest pointer
    const latestPointer = path.join(projectRoot, '.planning/backups', 'latest_backup.json');
    fs.writeFileSync(latestPointer, JSON.stringify({
        latestTimestamp: timestamp,
        backupPath: backupDir,
        date: now.toLocaleString('vi-VN'),
        totalRecords: manifest.totalRecords,
        totalSizeMB: (manifest.totalSizeBytes / (1024 * 1024)).toFixed(2)
    }, null, 2), 'utf8');

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('----------------------------------------------------');
    console.log('🎉 SAO LƯU HOÀN TẤT THÀNH CÔNG!');
    console.log(`Tổng số bản ghi : ${manifest.totalRecords.toLocaleString()}`);
    console.log(`Tổng dung lượng : ${(manifest.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Thời gian thực hiện: ${totalTime}s`);
    console.log(`Tệp kê khai    : ${manifestPath}`);
    console.log('====================================================');
}

runBackup().catch(err => {
    console.error('LỖI KHÔNG MONG MUỐN KHI SAO LƯU:', err);
    process.exit(1);
});
