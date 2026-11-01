---
phase: quick-261101-tnn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/weighbridge/WeighbridgeService.ts
  - src/components/tools/WeighbridgePrinter.vue
  - src/components/tools/CargoAllocator.vue
  - src/services/excel/WarehouseInventoryService.ts
  - src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts
autonomous: true
requirements:
  - QUICK-261101-TNN
must_haves:
  truths:
    - "Đồng bộ phiếu cân tự động (BroadcastChannel) hoặc thủ công (nút Đồng bộ) từ Báo cáo cân hàng (CargoAllocator) sang Báo cáo tổng quan (WeighbridgePrinter) không bao giờ tạo bản ghi xe/phiếu cân bị lặp."
    - "Khi số phiếu cân trong Báo cáo tổng quan đã được đánh số lại theo cấu hình (ví dụ 000001/1026), các lần đồng bộ tiếp theo vẫn nhận diện đúng chuyến xe đã tồn tại (qua sourceTicketNo hoặc chữ ký vật lý: biển số chính + trọng lượng hàng + ngày giờ cân) và không chèn trùng."
    - "Các bản ghi phiếu cân đã bị lặp sẵn trong IndexedDB / Supabase (weighbridge_trucks) của từng sà lan được tự động gộp/lọc sạch và xóa ID thừa trên Supabase."
    - "Không xảy ra race condition khi nhiều sự kiện đồng bộ kích hoạt liên tiếp giữa CargoAllocator và WeighbridgePrinter."
  artifacts:
    - path: "src/services/weighbridge/WeighbridgeService.ts"
      provides: "isSameScaleTicket, deduplicateBargeTrucks, và cơ chế tự động dọn bản ghi trùng trong getTrucks / saveTrucks"
    - path: "src/components/tools/WeighbridgePrinter.vue"
      provides: "Khóa chống chạy song song (sync mutex) và bộ lọc chống trùng 2 lớp trong autoSyncAllBarges & syncFromAllocatorActiveBarge"
    - path: "src/components/tools/CargoAllocator.vue"
      provides: "Ngắt vòng lặp BroadcastChannel khi nhận dữ liệu, bỏ ánh xạ nhầm cột STT sang ticketNo, và tăng cường mergeTickets"
    - path: "src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts"
      provides: "Unit test kiểm chứng chống trùng phiếu cân khi đồng bộ"
  key_links:
    - from: "src/components/tools/CargoAllocator.vue"
      to: "src/components/tools/WeighbridgePrinter.vue"
      via: "BroadcastChannel('allocator_sync_channel') & IndexedDB('allocator_tickets')"
      pattern: "isSameScaleTicket|deduplicateBargeTrucks"
    - from: "src/components/tools/WeighbridgePrinter.vue"
      to: "src/services/weighbridge/WeighbridgeService.ts"
      via: "WeighbridgeService.getTrucks / WeighbridgeService.saveTrucks"
      pattern: "deduplicateBargeTrucks"
---

<objective>
Kiểm tra và khắc phục triệt để lỗi lặp dữ liệu phiếu cân khi đồng bộ từ **"Báo cáo cân hàng"** (`CargoAllocator.vue` / `WarehouseInventoryService.ts`) sang **"Báo cáo tổng quan"** (`WeighbridgePrinter.vue` / `WeighbridgeService.ts`).

### Nguyên nhân gốc rễ đã xác định (5 nguyên nhân liên hoàn):
1. **Lỗi logic lọc trùng khi `ticketNo` bị đánh số lại trong `WeighbridgePrinter.vue` (`lines 3523-3532` & `3736-3745`):**
   - Trong `autoSyncAllBarges` và `syncFromAllocatorActiveBarge`, code kiểm tra:
     ```ts
     if (tr.ticketNo) {
         return !currentTrucks.some(ct => ct.ticketNo === tr.ticketNo);
     }
     ```
   - Khi phiếu gốc từ Báo cáo cân hàng có `ticketNo` (VD: `"105"` hoặc `"010782/26B"`), hàm **chỉ** so sánh `ct.ticketNo === tr.ticketNo` và bỏ qua hoàn toàn việc so khớp thông tin chuyến xe (`plateNumber + weightNet + dateIn/dateOut`).
   - Tuy nhiên, bên Báo cáo tổng quan (`WeighbridgePrinter.vue`), khi người dùng đổi cấu hình số phiếu hoặc hệ thống chạy `regenerateAllTicketNumbers` / cấp số phiếu tuần tự (`000001/1026`), `ct.ticketNo` đã bị đổi sang số phiếu mới trong khi `sourceTicketNo` không được lưu xuống bảng `weighbridge_trucks` trên Supabase. Ở lần đồng bộ kế tiếp, `ct.ticketNo === tr.ticketNo` luôn trả về `false` và không fallback sang so sánh biển số + khối lượng + ngày giờ -> **toàn bộ xe của sà lan bị chèn lặp lại 100%**.
   - Ngoài ra, `importedTrucks.filter(...)` chỉ đối chiếu với `currentTrucks` mà không đối chiếu với các phần tử đã nhận trong chính mảng `tripsToAdd`.

2. **Race Condition (Chạy song song không khóa) + Vòng lặp `BroadcastChannel` + Sinh khóa chính `id: Date.now() + idx`:**
   - `App.vue` bọc `<RouterView>` trong `<KeepAlive :max="10">`, khiến `WeighbridgePrinter.vue` vẫn sống ngầm và lắng nghe `BroadcastChannel('allocator_sync_channel')` khi người dùng thao tác ở `CargoAllocator.vue`.
   - Tại `CargoAllocator.vue` (`lines 261, 1528, 2328`), biến cờ `isSyncingFromChannel = false` và `isInitLoading.value = false` được đặt lại đồng bộ trong khối `finally` **trước khi** `watch(csvRecords)` kịp chạy ở microtask tiếp theo, làm `watch(csvRecords)` bắn ngược sự kiện `{ type: 'tickets' }` vào `allocator_sync_channel`.
   - `autoSyncAllBarges` trong `WeighbridgePrinter.vue` không có khóa chống chạy trùng (`mutex`). Khi nhận nhiều thông điệp `{ type: 'tickets' }` liên tiếp hoặc vừa auto-sync vừa bấm nút "Đồng bộ", 2 tiến trình cùng gọi `getTrucks(barge.id)` trước khi tiến trình kia kịp `saveTrucks()`, cùng sinh `id: Date.now() + idx` khác nhau vài mili-giây và cùng `upsert` lên Supabase -> nhân đôi toàn bộ phiếu cân.
   - Đồng thời, `watch(csvRecords)` gửi `{ type: 'tickets' }` ngay lập tức (`0ms`) trong khi `saveTicketsToSupabase` bị debounce `200ms`, khiến `autoSyncAllBarges` tải dữ liệu cũ từ Supabase đè lên IndexedDB.

3. **So khớp chữ ký vật lý chuyến xe chưa chuẩn hóa (Biển số kèm Rơ-moóc, giây trong thời gian, và lỗi `else if` ngày giờ):**
   - `normPlate` chỉ xóa ký tự đặc biệt nhưng không tách phần rơ-moóc sau dấu `/` (`"61H-16907"` vs `"61H-16907/61R-12345"`).
   - Trong `autoSyncAllBarges` (`lines 3472-3486`) và `syncFromAllocatorActiveBarge` (`lines 3674-3688`), cấu trúc `if (t.dateInStr && t.timeInStr) ... else if (t.date1Obj) ... else if (t.dateInStr)` khiến khi `parseExcelDate("${t.dateInStr} ${t.timeInStr}")` trả về `""`, code không rơi vào các nhánh `else if` mà gán thẳng `new Date()` (thay đổi theo từng phút hiện tại!), làm lệch `dateIn`/`dateOut` giữa các lần đồng bộ.

4. **Nhận diện nhầm cột `STT` thành `ticketNo` trong `CargoAllocator.vue` (`lines 569` & `973`):**
   - Biểu thức `(h === 'stt' && !normHeaders.some(x => x.includes('phieu')))` lấy số thứ tự dòng (`1, 2, 3...`) làm `ticketNo` khi file Excel không có cột Số phiếu, gây trùng hoặc lệch mã phiếu giữa các đợt import.

5. **`WeighbridgeService.saveTrucks` chỉ `upsert` mà không xóa các dòng trùng lặp cũ trên Supabase (`WeighbridgeService.ts lines 1066-1165`):**
   - Khi có bản ghi trùng lặp hoặc khi gộp trùng, `saveTrucks` chỉ gọi `.upsert(chunk)` theo `id`, không xóa các `id` dư thừa của cùng `barge_id` trên bảng `weighbridge_trucks`.
</objective>

<context>
@.planning/STATE.md
@src/services/weighbridge/WeighbridgeService.ts
@src/components/tools/WeighbridgePrinter.vue
@src/components/tools/CargoAllocator.vue
@src/services/excel/WarehouseInventoryService.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Chuẩn hóa thuật toán nhận diện & tự động dọn trùng phiếu cân trong WeighbridgeService.ts và WeighbridgePrinter.vue</name>
  <files>
    src/services/weighbridge/WeighbridgeService.ts
    src/components/tools/WeighbridgePrinter.vue
  </files>
  <behavior>
    - Hai bản ghi xe/phiếu cân (`a` và `b`) trên cùng một sà lan được xác định là **cùng một phiếu cân** (`isSameScaleTicket(a, b) === true`) nếu thỏa mãn MỘT trong hai điều kiện:
      1. **Trùng mã phiếu gốc hoặc mã phiếu hiển thị hợp lệ:** Chuẩn hóa mã phiếu (`trim().toUpperCase()`), đối chiếu tất cả các mã phiếu có mặt trên `a` (`a.ticketNo`, `a.sourceTicketNo`) với tất cả các mã phiếu có mặt trên `b` (`b.ticketNo`, `b.sourceTicketNo`). Nếu có ít nhất 1 cặp trùng nhau (và không phải số thứ tự ngắn vô nghĩa khi biển số chính khác nhau) -> `true`.
      2. **Trùng chữ ký vật lý của chuyến cân (Physical Trip Signature) bất kể `ticketNo` đã bị đánh số lại hay chưa:**
         - Biển số xe đầu kéo chính đã chuẩn hóa (`String(plate || '').split('/')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase()`) giống nhau (và khác rỗng), **VÀ**
         - Trọng lượng hàng tịnh (`Math.abs(Number(a.weightNet || 0) - Number(b.weightNet || 0)) <= 0.01`), **VÀ**
         - Khớp thời gian cân hoặc cặp cân:
           + Cùng thời điểm cân ra tới phút (`normMinute(a.dateOut) === normMinute(b.dateOut)` khi cả hai khác rỗng), HOẶC
           + Cùng thời điểm cân vào tới phút (`normMinute(a.dateIn) === normMinute(b.dateIn)` khi cả hai khác rỗng), HOẶC
           + Cùng ngày (`slice(0, 10)`) VÀ cùng trọng lượng cân lần 1 & lần 2 (`Math.abs(Number(a.weight1 || 0) - Number(b.weight1 || 0)) <= 0.01 && Math.abs(Number(a.weight2 || 0) - Number(b.weight2 || 0)) <= 0.01`).
    - Hàm `deduplicateBargeTrucks(trucks)` gộp các bản ghi trùng trong danh sách xe của một sà lan:
      - Giữ lại bản ghi có `id` ổn định (ưu tiên bản ghi đã có `ticketNo` định dạng chuẩn hoặc dữ liệu đầy đủ hơn, giữ lại `sourceTicketNo`, `yard`, `clientName`, `driverName`, `weight1`, `weight2`, `dateIn`, `dateOut`), và trả về `{ uniqueTrucks, removedIds }`.
    - Khi `WeighbridgeService.getTrucks(bargeId)` hoặc `WeighbridgeService.saveTrucks(bargeId, trucks)` chạy:
      - Tự động chạy `deduplicateBargeTrucks`.
      - Nếu phát hiện `removedIds.length > 0`, tự động xóa các `id` bị trùng khỏi bảng `weighbridge_trucks` trên Supabase (`.delete().eq('barge_id', bargeId).in('id', removedIds)`) và cập nhật lại IndexedDB `wb_trucks_${bargeId}` để làm sạch dữ liệu bị lặp từ trước.
    - Trong `WeighbridgePrinter.vue`:
      - Thêm khóa đồng bộ `let isAllocatorSyncRunning = false; let pendingAllocatorSync = false;` để `autoSyncAllBarges` và `syncFromAllocatorActiveBarge` không bao giờ chạy chồng chéo nhau.
      - Sửa lỗi `else if` khi parse `dIn` / `dOut` trong cả `autoSyncAllBarges` và `syncFromAllocatorActiveBarge`: dùng chuỗi `if (!dIn && ...)` tuần tự để nếu `parseExcelDate("${t.dateInStr} ${t.timeInStr}")` trả về `""`, code vẫn fallback sang `t.date1Obj` rồi `t.dateInStr`; nếu cả `dIn` và `dOut` có 1 chiều hợp lệ thì gán chiều còn lại bằng chiều hợp lệ thay vì `new Date()`.
      - Khi lọc `tripsToAdd`, sử dụng `isSameScaleTicket(ct, tr)` để kiểm tra với cả `currentTrucks` **và** các phần tử đã được thêm vào `tripsToAdd` trong cùng đợt. Nếu chuyến xe đã tồn tại trong `currentTrucks` nhưng thiếu thông tin phụ (như `yard` hoặc `sourceTicketNo`), chỉ cập nhật bổ sung vào bản ghi hiện có chứ không tạo xe mới.
      - Khi `autoSyncAllBarges` được kích hoạt từ `BroadcastChannel('allocator_sync_channel')`, đọc trực tiếp `IndexedDB('allocator_tickets')` trước (vì vừa được tab bên kia ghi xong) thay vì chờ lấy bản cũ từ Supabase đè lên IndexedDB.
  </behavior>
  <action>
    1. Trong `src/services/weighbridge/WeighbridgeService.ts`:
       - Viết và export các hàm thuần (pure functions):
         - `normalizeMainPlate(plate?: string): string` — tách phần trước dấu `/` (bỏ rơ-moóc), xóa ký tự không phải chữ/số, viết hoa.
         - `normalizeDateTimeMinute(dt?: string): string` — chuẩn hóa chuỗi ngày giờ ISO hoặc `YYYY-MM-DDTHH:mm` về dạng `YYYY-MM-DDTHH:mm` (16 ký tự đầu).
         - `isSameScaleTicket(a: Partial< any >, b: Partial< any >): boolean` — cài đặt đầy đủ 2 lớp đối chiếu (mã phiếu `ticketNo`/`sourceTicketNo` VÀ chữ ký vật lý `mainPlate + weightNet + dateOut/dateIn/weights`). Lưu ý: nếu `a.ticketNo` và `b.ticketNo` khác nhau (do 1 bên đã đánh số lại dạng `000001/1026` còn 1 bên là số phiếu cân gốc), hàm **bắt buộc** tiếp tục kiểm tra chữ ký vật lý thay vì trả về `false` sớm!
         - `deduplicateBargeTrucks<T extends Record<string, any>>(trucks: T[]): { uniqueTrucks: T[]; removedIds: any[] }` — duyệt qua danh sách xe, dùng `isSameScaleTicket` để phát hiện bản ghi trùng, hợp nhất thông tin thiếu (`sourceTicketNo`, `yard`, `driverName`, `clientName`) vào bản ghi gốc và thu thập danh sách `id` của các bản ghi dư thừa vào `removedIds`.
       - Cập nhật `WeighbridgeService.getTrucks(bargeId)`:
         - Sau khi lấy danh sách xe từ Supabase (và cả nhánh fallback IndexedDB), chạy `deduplicateBargeTrucks`.
         - Nếu `removedIds.length > 0`, lưu lại `uniqueTrucks` vào IndexedDB và gọi xóa bất đồng bộ các `removedIds` trên bảng `weighbridge_trucks` của Supabase (`.from('weighbridge_trucks').delete().eq('barge_id', bargeId).in('id', removedIds)`).
       - Cập nhật `WeighbridgeService.saveTrucks(bargeId, trucks)`:
         - Chạy `deduplicateBargeTrucks(trucks)` trước khi lưu vào IndexedDB và Supabase.
         - Nếu có `removedIds.length > 0`, xóa các `id` đó trên Supabase để đảm bảo DB không còn rác.

    2. Trong `src/components/tools/WeighbridgePrinter.vue`:
       - Import `isSameScaleTicket`, `deduplicateBargeTrucks`, `normalizeMainPlate` từ `@/services/excel/WeighbridgeService`.
       - Thêm khóa chống chạy song song (`isAllocatorSyncRunning`) bao quanh `autoSyncAllBarges` và `syncFromAllocatorActiveBarge`. Nếu đang chạy mà có yêu cầu `autoSyncAllBarges` mới, đánh dấu `pendingAllocatorSync = true` để chạy tiếp 1 lần sau khi lượt hiện tại kết thúc.
       - Thêm tham số `preferLocalIdb = false` cho `autoSyncAllBarges(preferLocalIdb = false)`. Khi nhận message từ `BroadcastChannel('allocator_sync_channel')`, gọi `autoSyncAllBarges(true)` (có debounce 150ms) để ưu tiên đọc `allocator_tickets` mới nhất từ IndexedDB thay vì lấy dữ liệu Supabase chưa kịp debounce 200ms đè lên IndexedDB.
       - Sửa khối parse ngày giờ `dIn` và `dOut` trong cả `autoSyncAllBarges` (`lines 3471-3504`) và `syncFromAllocatorActiveBarge` (`lines 3673-3706`):
         - Thay `else if` bằng `if (!dIn && ...)` để nếu chuỗi kết hợp ngày+giờ không parse được thì vẫn fallback sang `date1Obj` / `dateInStr`.
         - Nếu có `dIn` mà không có `dOut` thì `dOut = dIn` (và ngược lại) để thời gian luôn cố định, tuyệt đối không sinh `new Date()` mỗi lần sync trừ khi phiếu hoàn toàn không có bất kỳ ngày nào.
       - Thay thế bộ lọc `tripsToAdd` ở cả `autoSyncAllBarges` (`lines 3523-3532`) và `syncFromAllocatorActiveBarge` (`lines 3736-3745`):
         - Trước tiên làm sạch `currentTrucks` bằng `deduplicateBargeTrucks(currentTrucks)`.
         - Khi duyệt `importedTrucks`, dùng `isSameScaleTicket(ct, tr)` để tìm xem xe đã có trong `currentTrucks` hoặc trong `tripsToAdd` chưa.
         - Nếu đã có trong `currentTrucks`: cập nhật bổ sung `ct.sourceTicketNo = ct.sourceTicketNo || tr.sourceTicketNo` và `ct.yard = tr.yard || ct.yard` (nếu có thay đổi kho), **không** thêm vào `tripsToAdd`.
         - Nếu chưa có trong cả `currentTrucks` lẫn `tripsToAdd`: thêm vào `tripsToAdd`.
  </action>
  <verify>
    <automated>npm test</automated>
  </verify>
  <done>
    - `WeighbridgeService.ts` export `normalizeMainPlate`, `isSameScaleTicket`, `deduplicateBargeTrucks` và tự động dọn trùng trong `getTrucks` / `saveTrucks`.
    - `WeighbridgePrinter.vue` dùng khóa chống chạy song song và dùng `isSameScaleTicket` trong cả `autoSyncAllBarges` lẫn `syncFromAllocatorActiveBarge`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Khắc phục vòng lặp BroadcastChannel & chuẩn hóa gộp phiếu cân tại CargoAllocator.vue và WarehouseInventoryService.ts</name>
  <files>
    src/components/tools/CargoAllocator.vue
    src/services/excel/WarehouseInventoryService.ts
  </files>
  <action>
    1. Trong `src/components/tools/CargoAllocator.vue`:
       - **Ngắt vòng lặp `BroadcastChannel`:**
         - Tại `syncChannel.onmessage` (`lines 235-265`), `loadTicketsFromSupabase` (`lines 1486-1532`), và `onMounted` (`lines 2310-2333`), sử dụng `await nextTick()` trước khi gán lại `isSyncingFromChannel = false` và `isInitLoading.value = false` trong khối `finally`. Việc này đảm bảo `watch(csvRecords)` không bắn ngược `{ type: 'tickets' }` khi chỉ vừa nạp dữ liệu từ kênh đồng bộ hoặc từ Supabase.
         - Khi gửi `{ type: 'tickets' }` qua `syncChannel.postMessage`, chỉ gửi sau khi đã `await idb.set('allocator_tickets', ...)` hoàn tất để tab nhận luôn đọc được dữ liệu mới nhất từ IndexedDB.
       - **Bỏ nhận diện nhầm cột `STT` thành `ticketNo`:**
         - Tại `line 569` và `line 973`, sửa:
           `const idxTicket = normHeaders.findIndex(h => h.includes('phieu') || h.includes('ticket'));`
           (bỏ nhánh `|| (h === 'stt' && !normHeaders.some(x => x.includes('phieu')))` để cột STT 1, 2, 3 không bị gán nhầm làm mã phiếu cân).
       - **Tăng cường chống trùng khi import/merge trong `CargoAllocator.vue`:**
         - Cập nhật `getHistoryDuplicates` (`lines 1054-1065`) và `mergeTickets` (`lines 1068-1079`): ngoài việc so sánh `ticketNo` (khi cả 2 đều có `ticketNo` thực sự), luôn kiểm tra thêm chữ ký vật lý của phiếu cân (biển số chính chuẩn hóa `normalizeMainPlate(t.plate)` + `Math.abs(t.weightNet - n.weightNet) <= 0.01` + cùng ngày giờ vào/ra `dateInStr`/`timeInStr` hoặc `dateOutStr`/`timeOutStr`) để tránh lặp phiếu ngay tại nguồn `allocator_tickets`.
         - Khi tải danh sách phiếu trong `loadTicketsFromSupabase` (`lines 1495-1525`), chạy bước lọc trùng danh sách `allocator_tickets` trước khi gán vào `csvRecords.value`.

    2. Trong `src/services/excel/WarehouseInventoryService.ts`:
       - Tại `syncRowsToAllocator` (`lines 2183-2207`):
         - Cập nhật điều kiện tìm `existingIdx` trong `existingTickets`: khớp khi trùng `ticketNo` (khác rỗng) **HOẶC** trùng biển số chính (`normalizeMainPlate`) + `Math.abs(Number(t.weightNet || 0) - Number(newT.weightNet || 0)) <= 0.01` + cùng `dateInStr` & (`timeInStr` hoặc `timeOutStr`), tránh việc đồng bộ từ Quản lý kho sang Phân bổ hàng tạo bản ghi trùng khi 1 bên thiếu hoặc khác định dạng `ticketNo`.
  </action>
  <verify>
    <automated>npx vue-tsc -b</automated>
  </verify>
  <done>
    - `CargoAllocator.vue` không phát ngược sự kiện `BroadcastChannel` khi nhận đồng bộ, không gán nhầm cột `STT` vào `ticketNo`, và lọc trùng chính xác trong `mergeTickets`.
    - `WarehouseInventoryService.syncRowsToAllocator` chống trùng theo cả `ticketNo` lẫn chữ ký vật lý.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Viết Unit Tests kiểm chứng cơ chế chống trùng và dọn dữ liệu lặp khi đồng bộ phiếu cân</name>
  <files>
    src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts
  </files>
  <behavior>
    - Test 1: `isSameScaleTicket` nhận diện đúng cùng 1 chuyến xe khi `ticketNo` trên sà lan đã bị đổi sang số phiếu tự động (`"000001/1026"`) trong khi phiếu từ Báo cáo cân hàng có `ticketNo` gốc (`"105"` hoặc `"010782/26B"`).
    - Test 2: `isSameScaleTicket` nhận diện đúng khi biển số có/không có rơ-moóc (`"61H-16907"` vs `"61H-16907/61R-55588"`) và chuỗi thời gian lệch phần giây (`"2026-10-15T08:30"` vs `"2026-10-15T08:30:45.000Z"`).
    - Test 3: `isSameScaleTicket` phân biệt đúng 2 chuyến xe khác nhau của cùng 1 biển số trong cùng ngày (khác giờ cân hoặc khác trọng lượng).
    - Test 4: `deduplicateBargeTrucks` loại bỏ các bản ghi bị nhân đôi trong danh sách xe của sà lan, bảo toàn thông tin `yard` / `sourceTicketNo`, và trả về đúng mảng `removedIds` để xóa trên Supabase.
  </behavior>
  <action>
    Tạo file test `src/services/excel/__tests__/WeighbridgeSyncDedup.spec.ts` bằng Vitest để kiểm tra toàn diện `normalizeMainPlate`, `isSameScaleTicket`, và `deduplicateBargeTrucks` với các kịch bản thực tế (đánh lại số phiếu `000001/mmyy`, biển số kèm rơ-moóc, trùng phiếu trong cùng 1 batch import, nhiều chuyến của cùng 1 xe trong ngày). Chạy `npm test` và `npm run build` để xác nhận toàn bộ test và kiểu TypeScript đều PASS.
  </action>
  <verify>
    <automated>npm test && npm run build</automated>
  </verify>
  <done>
    - Toàn bộ unit test trong `WeighbridgeSyncDedup.spec.ts` và các test hiện hữu đều PASS.
    - `npm run build` thành công không có lỗi TypeScript hay Vite.
  </done>
</task>

</tasks>

<verification>
1. Chạy `npm test` — đảm bảo 100% unit test (bao gồm `WeighbridgeSyncDedup.spec.ts`) PASS.
2. Chạy `npm run build` — đảm bảo `vue-tsc -b && vite build` thành công, không có lỗi biên dịch.
</verification>

<success_criteria>
- Đồng bộ phiếu cân từ "Báo cáo cân hàng" sang "Báo cáo tổng quan" (dù tự động qua `BroadcastChannel` hay bấm nút "Đồng bộ" nhiều lần, dù đã đổi cấu hình đánh số phiếu `000001/mmyy`) không bao giờ tạo thêm dòng xe trùng lặp.
- Các sà lan đang bị lặp dữ liệu phiếu cân từ trước tự động được gộp sạch ngay khi tải (`getTrucks`) hoặc lưu (`saveTrucks`).
- Toàn bộ bài kiểm tra `npm test` và `npm run build` đều PASS.
</success_criteria>

<output>
After completion, create `.planning/quick/261101-tnn-kiem-tra-lai-co-che-dong-bo-phieu-can-tu/261101-tnn-SUMMARY.md`
</output>
