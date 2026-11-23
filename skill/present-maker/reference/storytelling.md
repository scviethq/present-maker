# Kể chuyện bằng sơ đồ động

Người xem chỉ nhớ được vài ý. Mỗi bước đưa đúng **một ý** mới, và sơ đồ cho thấy ý đó **thay đổi gì**.

## Khung mặc định (điều chỉnh theo nội dung)

| Chương | Mục đích | Mẹo sơ đồ |
|---|---|---|
| Bối cảnh | Ai, cái gì, đang chạy thế nào | ít node, 1 flow chính |
| Vấn đề | Chỗ đau cụ thể, có số liệu | `status: down/hot`, `flows kind: fail`, metrics xấu đi |
| Giải pháp | Từng mảnh ghép được thêm vào | mỗi bước thêm 1–2 node, `changes` liệt kê |
| Kết quả | Hệ thống mới chịu được tình huống cũ | lặp lại sự cố của chương Vấn đề, cho thấy nó không còn gây hại |
| (Tổng kết) | Bức tranh đầy đủ | toàn cảnh, nhiều flow, bỏ `focus` |

Mẹo mạnh nhất: **lặp lại đúng sự cố ở chương Vấn đề sau khi có giải pháp** (ví dụ ERP lại sập, nhưng khách không bị ảnh hưởng). Khán giả tự thấy giá trị.

## Theo loại buổi nói

- **Khách hàng**: bắt đầu từ trải nghiệm hoặc rủi ro của họ, ít thuật ngữ; nhãn bằng ngôn ngữ nghiệp vụ ("Đơn hàng" thay vì "order-svc"); metrics là tiền, thời gian, tỉ lệ.
- **Team nội bộ / quy trình**: dùng `zones` cho phòng ban; `person`/`team` cho vai trò; `document` cho chứng từ đi qua tay; `decision` cho bước duyệt; đánh dấu điểm nghẽn bằng `hot`.
- **Tích hợp hệ thống**: `zones` cho ranh giới hệ thống; `flows` phân biệt `req` (đồng bộ), `event` (bất đồng bộ), `data`; nói rõ chuyện lỗi, retry, idempotency.
- **Webinar khoa học**: bước đầu đặt câu hỏi; công thức `$$…$$` trong lời giải thích; `sphere`/`plate`/`cone` cho thực thể; `focus` để dẫn mắt theo từng giai đoạn; `???` chứa câu hỏi tương tác cho khán giả.

## Nhịp độ
- 5–12 bước cho 10–20 phút nói.
- Lời giải thích ≤ 60 từ. Phần còn lại đưa vào `???`.
- Callout chỉ dùng khi có điều *đáng nhớ* hoặc *cảnh báo*.
- Metrics: 1–3 chỉ số, giữ **cùng tên** qua các bước để thấy hiệu ứng đếm thay đổi.

## Tên ngắn trên thanh bước
`## Tiêu đề dài | Tên ngắn`: tên ngắn 1–2 từ, giúp người nói nhảy bước nhanh.
