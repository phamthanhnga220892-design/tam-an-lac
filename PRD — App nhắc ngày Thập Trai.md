# PRD — App nhắc ngày Thập Trai

Oct 15, 2026 · @NgaPham

## Tổng quan & Problem Statement

Một web app (PWA) cá nhân tự tính 10 ngày Thập Trai mỗi tháng âm lịch và nhắc Nga đúng giờ Nga chọn, kèm các ngày Phật pháp khác Nga tự thêm.

**Vấn đề:** Nga ăn chay 10 ngày/tháng theo Thập Trai, nhưng lịch dương không hiển thị âm lịch, và tháng thiếu (29 ngày) làm đổi ngày chay cuối tháng. Kết quả: hay quên, phát hiện ra khi đã ăn mặn, hoặc không kịp chuẩn bị đồ chay.

**Người dùng:** chỉ Nga — 1 người dùng, không đăng nhập, dữ liệu lưu trên máy.

**Giải pháp hiện có và lý do chưa đủ:** app lịch âm có sẵn hiển thị ngày âm nhưng không có quy tắc Thập Trai (tháng thiếu), hoặc nhắc cố định, nhiều quảng cáo.

## Goals & Non-Goals

**Goals**

1. Không bỏ lỡ ngày chay: ≥ 9/10 ngày Thập Trai mỗi tháng được nhắc và Nga xác nhận đã ăn chay.
2. Tính đúng 100% ngày âm và ngày Thập Trai (kể cả tháng thiếu, tháng nhuận) so với lịch Vạn Niên Việt Nam.
3. Nhắc đúng giờ Nga đã chọn, sai lệch ≤ 5 phút.
4. Thêm một ngày Phật pháp mới trong ≤ 30 giây.

**Non-Goals (v1)**

| Ngoài phạm vi | Lý do |
| --- | --- |
| Tài khoản, đăng nhập, đồng bộ nhiều thiết bị | Chỉ 1 người dùng, 1 điện thoại |
| Công thức món chay, thực đơn | Không giải quyết vấn đề quên ngày |
| Cộng đồng, chia sẻ, mạng xã hội | Dùng cá nhân |
| Kinh sách, nghe pháp | Sản phẩm khác, scope lớn |
| App native iOS/Android | PWA đủ nhu cầu, rẻ hơn |

## User Stories

Theo thứ tự ưu tiên:

1. Là Phật tử giữ Thập Trai, tôi muốn được nhắc trước ngày chay vào giờ tôi chọn, để kịp chuẩn bị đồ chay.
2. Là Phật tử giữ Thập Trai, tôi muốn mở app thấy ngay hôm nay là ngày âm nào và có phải ngày chay không, để không phải tra lịch.
3. Là Phật tử giữ Thập Trai, tôi muốn xem lịch tháng có đánh dấu 10 ngày chay, để lên kế hoạch ăn uống, đi tiệc.
4. Là Phật tử, tôi muốn thêm ngày Phật pháp khác (vía Quan Âm, Phật Đản, Vu Lan…) theo ngày âm, lặp hằng năm, để được nhắc như ngày chay.
5. Là Phật tử giữ Thập Trai, tôi muốn đánh dấu "đã ăn chay" mỗi ngày, để biết tháng này giữ được bao nhiêu ngày.
6. Edge case: khi tháng âm chỉ có 29 ngày, tôi muốn app tự đổi ngày chay cuối tháng sang 27, 28, 29, để không nhớ sai.
7. Edge case: khi điện thoại tắt thông báo hoặc chưa cấp quyền, tôi muốn app báo rõ và hướng dẫn bật, để không lỡ nhắc mà không biết.

## Requirements

### P0 — Must-have

**R1. Chuyển đổi âm – dương lịch.** Tính offline theo múi giờ Việt Nam (UTC+7), hỗ trợ tháng nhuận, phạm vi 2025–2035.

- [ ] Given ngày dương bất kỳ trong phạm vi, When app tính, Then ngày/tháng âm khớp lịch Vạn Niên VN
- [ ] Tháng nhuận hiển thị nhãn "nhuận" (vd 6 nhuận)
- [ ] Hoạt động khi không có mạng

**R2. Xác định ngày Thập Trai.** Theo quy tắc ở mục Quy tắc nghiệp vụ.

- [ ] Tháng đủ (30 ngày): 1, 8, 14, 15, 18, 23, 24, 28, 29, 30
- [ ] Tháng thiếu (29 ngày): 1, 8, 14, 15, 18, 23, 24, 27, 28, 29
- [ ] Tháng nhuận áp dụng cùng quy tắc

**R3. Màn hình Hôm nay.** Ngày dương, ngày âm, trạng thái chay, ngày chay kế tiếp và số ngày còn lại.

- [ ] Given hôm nay là ngày chay, Then hiển thị nổi bật "Hôm nay ăn chay"
- [ ] Given không phải, Then hiển thị "Ngày chay kế tiếp: \[dương\] (\[âm\]) — còn N ngày"

**R4. Lịch tháng.** Lưới tháng dương, mỗi ô có ngày âm nhỏ; ngày chay và ngày Phật pháp có ký hiệu riêng; vuốt qua tháng trước/sau.

- [ ] Đủ 10 (hoặc đúng số) ngày chay được đánh dấu mỗi tháng âm
- [ ] Chạm vào ngày → xem chi tiết (ngày âm, sự kiện)

**R5. Nhắc nhở (push notification).** Nga tự chọn giờ nhắc và nhắc trước bao nhiêu ngày (0 = sáng ngày đó, 1 = hôm trước); cho phép nhiều mốc nhắc.

- [ ] Given giờ nhắc 20:00 trước 1 ngày, When đến 20:00 hôm trước ngày chay, Then nhận thông báo "Mai (mùng 1) là ngày chay"
- [ ] Nhận được khi app đã đóng (PWA đã cài vào màn hình chính)
- [ ] Không nhắc vào ngày không phải ngày chay/sự kiện

**R6. Kiểm tra quyền thông báo.** Phát hiện chưa cấp quyền hoặc chưa cài PWA, hiển thị banner hướng dẫn.

- [ ] Given quyền bị từ chối, Then banner cảnh báo luôn hiện ở màn Hôm nay

**R7. Ngày Phật pháp tùy chỉnh.** Thêm/sửa/xóa sự kiện theo ngày âm: tên, ngày, tháng, lặp hằng năm hay một lần, bật/tắt nhắc, có ăn chay không.

- [ ] Thêm được trong ≤ 30 giây
- [ ] Có sẵn bộ gợi ý (Rằm tháng Giêng, Phật Đản 15/4, Vu Lan 15/7, vía Quan Âm 19/2 – 19/6 – 19/9, Phật A Di Đà 17/11…) — bật/tắt từng ngày
- [ ] Sự kiện trùng ngày chay hiển thị cả hai

**R8. Lưu trữ cục bộ.** Toàn bộ cài đặt, sự kiện, nhật ký lưu trên thiết bị; không cần tài khoản.

### P1 — Nice-to-have

- **R9. Đánh dấu "Đã ăn chay"** ngay từ thông báo hoặc màn Hôm nay; thống kê số ngày giữ được / tháng.
- **R10. Xuất/nhập dữ liệu** (file JSON) để không mất khi đổi máy.
- **R11. Widget/huy hiệu** trên icon: số ngày đến ngày chay kế tiếp.

### P2 — Future

- Chọn chế độ khác: Lục Trai (6 ngày), Nhị Trai (mùng 1, rằm), ăn chay cả tháng Giêng/tháng 7 — thiết kế quy tắc ngày chay dạng cấu hình, không hard-code.
- Đồng bộ Google Calendar.
- Nhiều người dùng, chia sẻ cho gia đình/đạo hữu.

## Quy tắc nghiệp vụ

| Mã | Quy tắc |
| --- | --- |
| BR1 | Ngày Thập Trai tháng đủ (30 ngày): 1, 8, 14, 15, 18, 23, 24, 28, 29, 30 |
| BR2 | Tháng thiếu (29 ngày): thay 28, 29, 30 bằng 27, 28, 29 — vẫn đủ 10 ngày |
| BR3 | Độ dài tháng âm lấy từ thuật toán âm lịch (điểm Sóc theo UTC+7), không hard-code |
| BR4 | Tháng nhuận là tháng âm riêng, áp dụng BR1/BR2 như tháng thường |
| BR5 | Sự kiện lặp hằng năm theo ngày âm; nếu ngày 30 không tồn tại trong năm đó → dời về ngày 29 |
| BR6 | Sự kiện lặp hằng năm không nhắc trong tháng nhuận, trừ khi Nga bật riêng |
| BR7 | Một ngày có nhiều sự kiện → gộp vào một thông báo |

Thuật toán tham khảo: chuyển đổi âm lịch của Hồ Ngọc Đức (dùng phổ biến trong các lịch Vạn Niên VN), tính lại trên client.

## Success Metrics

Đo bằng nhật ký trong app (R9) và tự đánh giá cuối mỗi tháng âm.

| Loại | Chỉ số | Mục tiêu | Stretch | Khi đo |
| --- | --- | --- | --- | --- |
| Leading | Thông báo nhận đúng giờ / tổng thông báo | ≥ 95% | 100% | Tuần 1–2 |
| Leading | Ngày chay tính sai so với lịch Vạn Niên | 0 | 0 | Test trước go-live, 12 tháng âm |
| Leading | Số ngày Phật pháp tự thêm | ≥ 3 | ≥ 6 | Tháng 1 |
| Lagging | Ngày chay giữ được / tháng | ≥ 9/10 | 10/10 | 3 tháng âm liên tiếp |
| Lagging | Số lần "quên, đã ăn mặn" / tháng | ≤ 1 | 0 | 3 tháng âm liên tiếp |

## Open Questions & Timeline

**Open questions**

| # | Câu hỏi | Ai trả lời | Chặn? |
| --- | --- | --- | --- |
| 1 | Điện thoại Nga là iPhone hay Android? iOS chỉ nhận push của PWA khi đã "Thêm vào MH chính" (iOS 16.4+) | Nga | Có |
| 2 | Push khi app đóng cần server gửi (Web Push + VAPID) hay chấp nhận nhắc qua lịch hệ thống (file .ics)? | Engineering | Có |
| 3 | Danh sách ngày Phật pháp gợi ý sẵn — Nga theo truyền thống/chùa nào để chốt list? | Nga | Không |
| 4 | Ngày Thập Trai có cần ăn chay từ tối hôm trước không (ảnh hưởng nội dung nhắc)? | Nga | Không |

**Timeline (đề xuất)**

1. Tuần 1: R1–R4 (âm lịch, Thập Trai, Hôm nay, Lịch tháng) + test đối chiếu 12 tháng âm.
2. Tuần 2: R5–R6 (nhắc nhở, quyền thông báo), cài PWA, dùng thử 1 tháng âm.
3. Tuần 3: R7–R8 (ngày Phật pháp tùy chỉnh, lưu cục bộ).
4. Sau go-live: P1 (đánh dấu đã ăn chay, xuất/nhập dữ liệu).

Không có deadline cứng; nên go-live trước mùng 1 tháng âm kế tiếp để đo trọn tháng đầu.
