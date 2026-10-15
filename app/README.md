# Thập Trai Thanh Tịnh — PWA nhắc ngày ăn chay

Web app (PWA) cá nhân theo [PRD](../PRD%20—%20App%20nhắc%20ngày%20Thập%20Trai.md) và design `stitch_medicine_buddha_mobile_app`.
Không cần build: giao diện là file tĩnh (HTML/CSS/JS module); thêm 2 hàm serverless trong `api/` để gửi Web Push khi app đóng.

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
| `sw.js` | Chạy offline, nhận Web Push, nhắc nền (Periodic Sync), nút "Đã ăn chay" trên thông báo |
| `api/subscribe.js` | `POST /api/subscribe`: lưu push subscription + lịch nhắc 45 ngày vào Upstash Redis |
| `api/dispatch.js` | `POST/GET /api/dispatch` (cần secret): gửi các nhắc đến hạn qua `web-push`, xoá subscription hết hạn (404/410) |
| `tests/lunar.test.mjs` | Đối chiếu Tết 2025–2035, tháng nhuận, tính liên tục tháng âm, BR1/BR2/BR5/BR6 |

## Về nhắc khi app đóng (Open question #2 của PRD)

App dùng 4 lớp, lớp sau dự phòng cho lớp trước:

1. **Web Push từ máy chủ (chính)**: khi đã cho phép thông báo, app đăng ký push và gửi lịch nhắc 45 ngày tới lên `/api/subscribe` (gửi lại mỗi khi mở app hoặc đổi cài đặt). cron-job.org gọi `/api/dispatch` mỗi phút → thông báo đến trong ≤ 1 phút so với giờ hẹn, kể cả khi app đã đóng. Chạy trên iPhone (iOS 16.4+, đã thêm vào MH chính) và Android.
2. **App đang mở / vừa mở lại**: hẹn giờ trong app, nhắc bù nếu lỡ trong 6 giờ gần nhất (cùng `tag` với push nên không hiện trùng).
3. **Android đã cài PWA**: Periodic Background Sync (Chrome tự quyết tần suất).
4. **Không cần mạng**: *Cài đặt → Xuất lịch nhắc (.ics)* vào Lịch của điện thoại.

Kiểm tra: *Cài đặt → Thử nhắc khi đóng app (sau 2 phút)* → đóng hẳn app → chờ thông báo "Thử nhắc nền".

### Cấu hình máy chủ (đã làm cho tam-an-lac.vercel.app)

Biến môi trường trên Vercel (Production), **không commit**:

| Biến | Giá trị |
| --- | --- |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Tạo bằng `npx web-push generate-vapid-keys`. Public key cũng nhúng trong `js/notify.js` (`VAPID_PUBLIC_KEY`) — đổi khoá thì sửa cả hai |
| `DISPATCH_SECRET` | Chuỗi ngẫu nhiên, bảo vệ `/api/dispatch` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Tự có khi tạo **Storage → Upstash for Redis (Free)** và Connect vào project. Cũng nhận `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` |
| `VAPID_SUBJECT` (tuỳ chọn) | Mặc định `https://tam-an-lac.vercel.app` |

Đổi biến môi trường xong phải deploy lại: `npx vercel deploy --prod` (chạy trong `app/`).

### Job gọi `/api/dispatch` mỗi phút (cron-job.org)

Cron của Vercel gói Hobby chỉ chạy 1 lần/ngày nên dùng [cron-job.org](https://cron-job.org) (miễn phí):

1. Đăng ký/đăng nhập cron-job.org → **Create cronjob**.
2. **URL**: `https://tam-an-lac.vercel.app/api/dispatch` — **Execution schedule**: *Every minute*.
3. Tab **Advanced** → **Headers** → thêm `Authorization` = `Bearer <DISPATCH_SECRET>` (lấy giá trị ở Vercel → Settings → Environment Variables). Request method để `GET` (hoặc `POST`).
4. Bật **Notify me when execution fails** (nên bật) → **Create**.
5. Bấm **Test run**: kết quả `200` và JSON dạng `{"subs":1,"sent":0,"failed":0,"removed":0}` là đúng; `401` là sai secret.

Thử tay: `curl -H "Authorization: Bearer <DISPATCH_SECRET>" https://tam-an-lac.vercel.app/api/dispatch`.

Dữ liệu trên Redis: `tt:subs` (set), `tt:sub:<id>` (subscription + lịch, tự hết hạn sau 60 ngày không mở app), `tt:sent:<id>` (các nhắc đã gửi, chống gửi trùng).
