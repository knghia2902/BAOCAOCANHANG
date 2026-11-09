import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();

vi.mock('@/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            insert: (rows: any[]) => ({
                select: () => insertMock(rows)
            }),
            update: vi.fn(() => ({
                ilike: vi.fn(() => ({
                    neq: vi.fn().mockResolvedValue({ error: null })
                }))
            }))
        }))
    }
}));

import { AllocatorService } from '../AllocatorService';

describe('AllocatorService - Sổ theo dõi 2 đầu cân (xxxxxx/26A & xxxxxx/26B)', () => {
    beforeEach(() => {
        insertMock.mockReset();
        (AllocatorService as any).fileSourceColumnMissing = false;
        (AllocatorService as any).scaleHeadSynced = false;
    });

    it('detectScaleHeadFromTicketNo nhận diện đúng định dạng xxxxxx/26A (FILE_1) và xxxxxx/26B (FILE_2)', () => {
        expect(AllocatorService.detectScaleHeadFromTicketNo('016918/26A')).toBe('FILE_1');
        expect(AllocatorService.detectScaleHeadFromTicketNo('000123/26a')).toBe('FILE_1');
        expect(AllocatorService.detectScaleHeadFromTicketNo('016918/26B')).toBe('FILE_2');
        expect(AllocatorService.detectScaleHeadFromTicketNo('000456/26b')).toBe('FILE_2');
        expect(AllocatorService.detectScaleHeadFromTicketNo('016918/25A (Tách)')).toBe('FILE_1');
        expect(AllocatorService.detectScaleHeadFromTicketNo('12345')).toBeNull();
    });

    it('resolveScaleHead ưu tiên định dạng số phiếu xxxxxx/26A và xxxxxx/26B cao nhất', () => {
        // Dù fileSource hay direction bị gán ngược, số phiếu 26A luôn thuộc FILE_1, 26B luôn thuộc FILE_2
        expect(
            AllocatorService.resolveScaleHead({ ticketNo: '012345/26A', fileSource: 'FILE_2', direction: 'Xuất' })
        ).toBe('FILE_1');
        expect(
            AllocatorService.resolveScaleHead({ ticketNo: '016918/26B', fileSource: 'FILE_1', direction: 'Nhập' })
        ).toBe('FILE_2');
    });

    it('resolveScaleHead dùng fileSource rồi đến Xuất/Nhập khi số phiếu không có hậu tố A/B', () => {
        expect(AllocatorService.resolveScaleHead({ ticketNo: '1001', fileSource: 'FILE_1', direction: 'Xuat' })).toBe('FILE_1');
        expect(AllocatorService.resolveScaleHead({ ticketNo: '1002', fileSource: 'FILE_2', direction: 'Nhap' })).toBe('FILE_2');
        expect(AllocatorService.resolveScaleHead({ direction: 'Nhap' })).toBe('FILE_1');
        expect(AllocatorService.resolveScaleHead({ direction: 'Nhập' })).toBe('FILE_1');
        expect(AllocatorService.resolveScaleHead({ fileSource: 'MANUAL', direction: 'Xuất' })).toBe('FILE_2');
    });

    it('tripToRow / rowToTrip giữ và chuẩn hóa thông tin đầu cân theo số phiếu 26A/26B', () => {
        const row = AllocatorService.tripToRow({
            ticketNo: '001122/26A',
            plateNumber: '51C',
            weightNet: 1000,
            fileSource: 'FILE_2'
        });
        expect(row.file_source).toBe('FILE_1');

        const trip = AllocatorService.rowToTrip({
            ticket_no: '003344/26A',
            plate_number: '51C',
            weight_net: 1000,
            weight_tons: 1,
            file_source: 'FILE_2'
        });
        expect(trip.fileSource).toBe('FILE_1');
        expect(AllocatorService.tripToRow({ plateNumber: '51C' }).file_source).toBeUndefined();
    });

    it('insertTrips tự bỏ cột file_source và chèn lại khi bảng chưa chạy migration', async () => {
        insertMock
            .mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST204', message: "Could not find the 'file_source' column of 'weighbridge_tracking'" }
            })
            .mockImplementationOnce(async (rows: any[]) => ({ data: rows, error: null }));

        const res = await AllocatorService.insertTrips([
            { ticketNo: '001234/26A', plateNumber: '51C', weightNet: 500, fileSource: 'FILE_1' }
        ]);
        expect(res.error).toBeNull();
        expect(res.count).toBe(1);
        expect(insertMock).toHaveBeenCalledTimes(2);
        expect(insertMock.mock.calls[1]?.[0]?.[0]).not.toHaveProperty('file_source');
    });
});
