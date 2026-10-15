# Thập Trai Thanh Tịnh — PWA nhắc ngày ăn chay

Web app (PWA) cá nhân theo [PRD](../PRD%20—%20App%20nhắc%20ngày%20Thập%20Trai.md) và design `stitch_medicine_buddha_mobile_app`.
Không cần build, không cần server riêng: chỉ là file tĩnh (HTML/CSS/JS module).

## Chạy thử trên máy

```bash
cd app
python -m http.server 5173
```

Mở http://localhost:5173. Chạy test âm lịch: `npm test` (Node 22+).

## Đưa lên điện thoại

PWA cần HTTPS. Đẩy thư mục `app/` lên một host tĩnh bất kỳ (Vercel, Netlify, GitHub Pages, Cloudflare Pages), rồi:

- **iPhone (iOS 16.4+)**: mở bằng Safari → Chia sẻ → *Thêm vào MH chính* → mở app từ icon → bấm *Bật ngay* để cho phép thông báo.
- **Android (Chrome)**: ⋮ → *Cài đặt ứng dụng* → mở app → cho phép thông báo.

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `js/lunar.js` | Đổi âm–dương lịch (thuật toán Hồ Ngọc Đức, UTC+7), tháng nhuận, can chi, tiết khí, giờ hoàng đạo — R1 |
| `js/fasting.js` | Quy tắc ngày chay dạng cấu hình: Thập Trai / Lục Trai / Nhị Trai, tháng đủ/thiếu — R2, BR1–BR4 |
| `js/events.js` | Ngày Phật pháp gợi ý sẵn + so khớp ngày âm (dời 30→29, bỏ tháng nhuận) — R7, BR5, BR6 |
| `js/store.js` | Lưu cục bộ (localStorage), xuất/nhập JSON — R8, R10 |
| `js/notify.js` | Lập lịch nhắc, gộp thông báo trùng ngày, huy hiệu icon, xuất `.ics` — R5, R6, R11, BR7 |
| `js/views/*` | 4 màn: Hôm nay, Lịch âm, Sự kiện, Cài đặt — R3, R4, R7, R9 |
| `sw.js` | Chạy offline, nhắc nền (Periodic Sync), nút "Đã ăn chay" trên thông báo |
| `tests/lunar.test.mjs` | Đối chiếu Tết 2025–2035, tháng nhuận, tính liên tục tháng âm, BR1/BR2/BR5/BR6 |

## Về nhắc khi app đóng (Open question #2 của PRD)

Không có server nên app dùng 3 lớp:

1. **App đang mở / vừa mở lại**: hẹn giờ trong app, và nhắc bù nếu lỡ trong 6 giờ gần nhất.
2. **Android đã cài PWA**: Periodic Background Sync đánh thức app khoảng mỗi giờ để hiện lời nhắc đến hạn (Chrome tự quyết tần suất, không đảm bảo đúng phút).
3. **Chắc chắn nhất**: *Cài đặt → Xuất lịch nhắc (.ics)* — thêm 12 tháng ngày chay/ngày lễ, kèm chuông báo theo mốc giờ đã chọn, vào Lịch của điện thoại.

Muốn đạt "sai lệch ≤ 5 phút" khi app đóng hoàn toàn trên cả iOS thì cần thêm server Web Push (VAPID) gửi theo lịch — chưa làm trong bản này.
