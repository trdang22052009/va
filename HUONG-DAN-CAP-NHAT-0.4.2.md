# Hướng dẫn nâng cấp Ôn Thi AI lên v0.4.2

## 1. Tải và giải nén
Tải ZIP `on-thi-ai-render-v0.4.2.zip`, sau đó giải nén.

## 2. Ghi đè mã nguồn GitHub
- Mở GitHub Desktop → repository hiện tại `hsa-tsa` → Repository → Show in Explorer.
- Mở thư mục `tsa-hsa-ai-render-simple` trong ZIP.
- Sao chép toàn bộ nội dung bên trong vào thư mục repository hiện tại, chọn ghi đè.
- Không xóa thư mục `.git`; không xóa repository; không tạo Render service mới.
- Commit và Push lên đúng nhánh đang nối với Render.

## 3. Chờ Render deploy
Giữ nguyên Build Command `npm install && npm run build`, Start Command `npm start`, Root Directory để trống. Đợi trạng thái `Live`.

## 4. Cấu hình AI kép trong Render → Environment
Đảm bảo các biến sau tồn tại:

| Key | Value |
|---|---|
| `APP_ACCESS_CODE` | Mã truy cập riêng của bạn |
| `GEMINI_API_KEY` | Gemini API Key |
| `GEMINI_MODEL` | `gemini-3.8-flash` |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |
| `CLOUDFLARE_API_TOKEN` | Token Workers AI API |
| `CLOUDFLARE_AI_MODEL` | `@cf/google/gemma-4-26b-a4b-it` |
| `NODE_VERSION` | `22.12.0` |

Token Cloudflare nên tạo từ mẫu Workers AI API trong Dashboard. Nếu tự tạo token, gán quyền Workers AI Read và Workers AI Edit trên đúng account. Không gửi API Key/token cho ai và không đưa lên GitHub.

## 5. Kiểm tra 3 chức năng AI
- Mở website → Cài đặt & AI → nhập APP_ACCESS_CODE → Lưu mã.
- Bấm Kiểm tra Gemini; phải thấy kết nối thành công.
- Bấm Kiểm tra Cloudflare; phải thấy kết nối thành công.
- Bấm Kiểm tra luồng tự động.
- Upload PDF có thể chọn/copy chữ → Dùng AI.
- Lưu đề → Làm bài → Nộp bài → AI giải toàn bộ đề.
- Trong trang chữa, bấm Xem lời giải AI ở một câu.

## 6. Điểm sửa quan trọng trong v0.4.2

Gemini 3.8 Flash không còn nhận các tham số sampling `temperature`, `top_p`, `top_k`. Bản này đã bỏ `temperature` khỏi `generationConfig`; lỗi tham số không hợp lệ trước đây có thể làm hỏng cả ba chức năng vì dùng chung backend Gemini. Giới hạn văn bản phân tích PDF cũng đã tăng từ 48.000 lên 160.000 ký tự, phù hợp hơn với PDF dài mà trình duyệt trích xuất được hơn 100.000 ký tự.

## 7. Nếu lỗi
- HTTP 401 khi gọi app: `APP_ACCESS_CODE` trên Render không trùng mã trong Cài đặt & AI.
- Gemini 400/404: kiểm tra `GEMINI_MODEL`; Gemini quota/rate-limit: kiểm tra trang Usage của AI Studio.
- Cloudflare 401/403: sai Account ID/token hoặc thiếu Workers AI Read/Edit.
- Cloudflare 404: kiểm tra Model ID chính xác.
- Cloudflare 429/limit: Workers AI Free đã hết Neurons trong ngày.
- PDF scan: phiên bản này chưa có OCR tự động; dùng PDF có lớp văn bản.

Không xóa dữ liệu trình duyệt; bộ đề/lịch sử đang lưu tại localStorage.
