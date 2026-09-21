const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectAndCleanup() {
    console.log('--- Đang kiểm tra content.settings trên Supabase ---');
    const { data, error } = await supabase.from('content').select('settings').eq('id', 'main').single();
    if (error) {
        console.error('Lỗi khi đọc content.settings:', error);
        return;
    }

    if (!data || !data.settings) {
        console.log('Không tìm thấy settings trong content.');
        return;
    }

    const settings = data.settings;
    const keys = Object.keys(settings);
    console.log(`Số lượng keys trong settings: ${keys.length}`);

    let totalSize = 0;
    const keySizes = [];

    for (const k of keys) {
        const str = JSON.stringify(settings[k]);
        const size = Buffer.byteLength(str, 'utf8');
        totalSize += size;
        keySizes.push({ key: k, size, sizeKB: (size / 1024).toFixed(2) });
    }

    keySizes.sort((a, b) => b.size - a.size);
    console.log('\nChi tiết các keys (sắp xếp theo dung lượng):');
    keySizes.forEach(item => {
        console.log(`- ${item.key}: ${item.sizeKB} KB (${item.size} bytes)`);
    });
    console.log(`\nTổng dung lượng settings: ${(totalSize / 1024).toFixed(2)} KB`);

    // Danh sách keys không còn sử dụng cần xóa:
    // 1. allocator_generated_trips (thuật toán phân bổ cũ)
    // 2. allocator_history_trips (lịch sử cũ trước khi migrate sang bảng weighbridge_tracking)
    const keysToRemove = ['allocator_generated_trips', 'allocator_history_trips'];
    const removed = [];
    let savedBytes = 0;

    for (const k of keysToRemove) {
        if (k in settings) {
            const str = JSON.stringify(settings[k]);
            const s = Buffer.byteLength(str, 'utf8');
            delete settings[k];
            removed.push(k);
            savedBytes += s;
            console.log(`-> Đã gỡ bỏ: ${k} (tiết kiệm ${(s / 1024).toFixed(2)} KB)`);
        }
    }

    if (removed.length > 0) {
        console.log(`\nĐang cập nhật lại settings trên Supabase...`);
        const { error: updateError } = await supabase
            .from('content')
            .update({ settings })
            .eq('id', 'main');

        if (updateError) {
            console.error('Lỗi khi cập nhật settings:', updateError);
        } else {
            console.log(`=> THÀNH CÔNG! Đã dọn dẹp ${removed.length} trường thừa.`);
            console.log(`Dung lượng tiết kiệm được: ${(savedBytes / 1024).toFixed(2)} KB`);
        }
    } else {
        console.log('\nKhông có trường rác nào cần xóa (đã sạch).');
    }
}

inspectAndCleanup();
