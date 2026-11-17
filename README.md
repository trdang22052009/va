# Ôn Thi AI — Phòng thi mô phỏng TSA · HSA · THPT (Render + Gemini + Cloudflare Workers AI)

Phiên bản **0.4.2**. Một Render Web Service Node phục vụ cả giao diện React/Vite và API AI. Gemini là nhà cung cấp ưu tiên; Cloudflare Workers AI tự động dự phòng khi Gemini bị giới hạn, quá tải hoặc không khả dụng.

## Chức năng

- Tải PDF tối đa 30 MB, trích xuất văn bản ở trình duyệt bằng PDF.js.
- Tách câu hỏi bằng bộ nhận diện cục bộ hoặc AI (Gemini → Cloudflare Workers AI).
- Dạng câu hỏi: một đáp án, nhiều đáp án, đúng/sai, trả lời ngắn, kéo-thả/chọn trong menu (TSA), tự luận (THPT).
- Thư viện đề và lời giải lưu trên trình duyệt hiện tại.
- Phòng thi mô phỏng: đồng hồ, tiến độ, bản đồ câu hỏi, đánh dấu xem lại, nộp bài, chấm chữa.
- TSA: 3 phần 60/30/60 phút; phòng thi đủ 100 câu sẽ khóa phần đã nộp và chuyển sang phần tiếp theo.
- HSA: 3 phần 75/60/60 phút; phòng thi đủ 150 câu sẽ khóa phần đã nộp và chuyển phần, theo bố cục 3 phần tham chiếu.
- THPT: thời gian theo môn (Ngữ văn 120 phút, Toán 90 phút, môn trắc nghiệm khác 50 phút); có chấm trắc nghiệm, đúng/sai và trả lời ngắn khi đề có đáp án gốc.
- Sau khi nộp bài: AI giải toàn bộ đề theo từng nhóm 3 câu; tiến độ và kết quả từng nhóm được lưu. Có thể bấm lại để giải tiếp phần còn thiếu.
- Hỏi AI và giải thích một câu riêng lẻ; lời giải AI được lưu cạnh bộ đề.
- Cài đặt có nút kiểm tra Gemini riêng, Cloudflare riêng và luồng tự động dự phòng. Yêu cầu Gemini 3.x đã bỏ các tham số sampling không còn được hỗ trợ (`temperature`, `top_p`, `top_k`).

## Cập nhật trên Render đang chạy

1. Tải ZIP `on-thi-ai-render-v0.4.2.zip` và giải nén.
2. Mở repository GitHub đang kết nối Render bằng GitHub Desktop → Repository → Show in Explorer.
3. Sao chép **toàn bộ nội dung bên trong** thư mục `tsa-hsa-ai-render-simple` của ZIP mới vào thư mục repository hiện tại, chọn ghi đè file trùng tên. Giữ nguyên thư mục `.git`.
4. GitHub Desktop → Summary `Update AI providers and exam room v0.4.2` → Commit to main → Push origin.
5. Render tự deploy. Giữ nguyên dịch vụ và URL hiện tại.
6. Sau khi deploy `Live`, vào Render → dịch vụ `on-thi-ai` → Environment và kiểm tra đủ các biến ở phần dưới.

Không xóa dữ liệu localStorage trên trình duyệt. Thư viện đề và lịch sử thi đang lưu trên chính trình duyệt/thiết bị của bạn.

## Environment Variables cần có trên Render

| Key | Giá trị |
|---|---|
| `APP_ACCESS_CODE` | Mã riêng do bạn tự đặt; nhập lại trong Cài đặt & AI của website |
| `GEMINI_API_KEY` | Gemini API Key từ Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.8-flash` |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID trong Cloudflare Dashboard |
| `CLOUDFLARE_API_TOKEN` | Token dành cho Workers AI; dùng mẫu **Workers AI API** trên dashboard nếu có. Nếu tự tạo, cấp quyền Workers AI Read và Workers AI Edit |
| `CLOUDFLARE_AI_MODEL` | `@cf/google/gemma-4-26b-a4b-it` |
| `NODE_VERSION` | `22.12.0` |

### Tạo Cloudflare API Token

1. Đăng nhập Cloudflare Dashboard.
2. Mở **Workers AI** trong mục AI; mở mục **Use REST API** / tạo token Workers AI theo mẫu được đề xuất.
3. Sao chép Account ID trong trang Workers AI/Overview.
4. Tạo token có quyền gọi Workers AI. Nếu tạo Custom Token thủ công, cấp **Workers AI – Read** và **Workers AI – Edit** trên đúng account.
5. Dán `CLOUDFLARE_ACCOUNT_ID` và `CLOUDFLARE_API_TOKEN` vào Render → Environment. Không dán token vào GitHub, frontend hoặc gửi trong ảnh chụp.

Trang tham khảo chính thức: https://developers.cloudflare.com/workers-ai/get-started/rest-api/ và https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/.

### Gemini API Key

Tạo tại https://aistudio.google.com/app/apikey. `GEMINI_API_KEY` chỉ lưu trong Render Environment. Gói Gemini Free Tier có giới hạn theo model/tài khoản và điều khoản dữ liệu riêng; không gửi tài liệu có thông tin cá nhân.

## Kiểm tra sau triển khai

1. Mở website → **Cài đặt & AI**.
2. Nhập chính xác `APP_ACCESS_CODE` → Lưu mã.
3. Bấm **Kiểm tra Gemini**. Chỉ báo thành công sau khi một yêu cầu thử được Gemini trả lời.
4. Bấm **Kiểm tra Cloudflare**. Nếu lỗi 401/403, kiểm tra token, account và quyền Workers AI Read/Edit; nếu 404, kiểm tra Model ID.
5. Bấm **Kiểm tra luồng tự động** để thử Gemini trước và tự chuyển Cloudflare khi Gemini lỗi.
6. Mở một đề PDF nhỏ, bấm **Dùng AI**. Sau khi lưu và làm bài, nộp bài rồi bấm **AI giải toàn bộ đề**; thử **Xem lời giải AI** ở một câu.

`/api/health` chỉ cho biết các biến môi trường có được khai báo; nút kiểm tra trong Cài đặt mới gọi model thật.

## Cấu trúc phòng thi và chấm điểm

- TSA: ba phần Tư duy Toán học, Đọc hiểu, Khoa học/Giải quyết vấn đề; các kiểu câu hỏi gồm chọn một, chọn nhiều, đúng/sai, kéo-thả/chọn menu và điền đáp án. Phòng thi chỉ khóa phần khi bộ đề đủ 100 câu và nhận diện được cấu trúc.
- HSA: ba phần Toán học và xử lý số liệu, Văn học – Ngôn ngữ, Khoa học hoặc Tiếng Anh; phòng thi đủ 150 câu mô phỏng thời gian từng phần.
- THPT: thời gian theo môn; chấm theo đáp án gốc có trong PDF. Bài tự luận không được AI tự gán điểm chính thức.
- Điểm hiển thị là điểm luyện tập dựa trên đáp án gốc đã nhập/đọc được. Đáp án do AI suy luận không tự động trở thành đáp án chuẩn để chấm.
- Có chỉ số luyện tập tham khảo 0–100 theo tỷ lệ đúng/điểm rubric, kèm mức tiến bộ. Đây không phải IRT. IRT cần bộ câu hỏi có tham số đã hiệu chuẩn (độ khó, độ phân biệt, tham số đoán mò nếu dùng mô hình 3PL) bằng dữ liệu làm bài đủ lớn. Bản này chỉ báo số câu đúng, điểm theo rubric có đáp án và tỷ lệ theo từng phần; không giả tạo điểm chuẩn hóa.

## Hạn mức và giới hạn

- Cloudflare Workers AI Free hiện cấp 10.000 Neurons/ngày; hạn mức đặt lại 00:00 UTC. Chạm hạn mức thì yêu cầu sẽ lỗi cho đến lần reset tiếp theo. Một số model yêu cầu hình thức billing khác; model Gemma được đặt mặc định ở trên được liệt kê trong model catalog. Theo dõi mức dùng tại Cloudflare Dashboard.
- Gemini API Free Tier có giới hạn tốc độ/hạn mức theo model và project. Khi Gemini 429/503 hoặc không dùng được, server sẽ thử Cloudflare; nếu cả hai hết hạn mức, AI tạm ngừng tới khi có hạn mức lại.
- AI xử lý theo nhóm nhỏ. PDF dài được chia chunk; hiện chỉ gửi tối đa 160.000 ký tự đầu tiên mỗi lần phân tích. Nếu đề dài hơn, chia PDF thành các phần nhỏ.
- PDF scan dạng ảnh chưa OCR tự động. PDF có lớp chữ mới được trích ổn định. Hình, biểu đồ và công thức có thể thiếu khi chỉ lấy text; kiểm tra với file gốc.
- Chỉ dùng nội dung đề bạn có quyền sử dụng. AI có thể sai; hãy đối chiếu đáp án chính thức.
- Dữ liệu đề/attempt/lời giải hiện lưu trong localStorage, chưa đồng bộ cloud. Xóa dữ liệu trình duyệt có thể làm mất thư viện; xuất/sao lưu trước khi dọn dữ liệu.
- Render Free Web Service có thể ngủ khi không có truy cập; lần mở lại cần đợi khởi động.
- Đường link Render công khai. `APP_ACCESS_CODE` bảo vệ API AI, không khóa giao diện website. Bảo vệ repository ở chế độ Private nếu chỉ dùng cá nhân; không đưa secret vào repo.
