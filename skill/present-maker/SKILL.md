---
name: present-maker
description: Use when the user wants a presentation, talk, webinar, walkthrough or explainer built as an animated isometric 3D diagram website (present-maker deck) — from notes, a spec, a process description, UML, JSON describing a system, or a topic. Produces a `.deck.md` file (Markdown + ```scene``` blocks), validates it with `present-maker check`, and builds it.
---

# present-maker: viết deck trình bày dạng sơ đồ 3D

Một deck là **một file Markdown**. Mỗi `##` là một bước. Mỗi bước có lời giải thích ngắn và (thường) một khối ```` ```scene ```` mô tả **những gì thay đổi** trên sơ đồ isometric 3D. Công cụ `present-maker` biến file đó thành website bấm qua từng bước.

## Quy trình (làm đủ, theo thứ tự)

1. **Đọc nguồn**: tài liệu, ghi chú, UML, JSON, code người dùng đưa. Xác định: *khán giả là ai* và *họ cần hiểu/quyết định điều gì sau buổi nói*.
2. **Dàn ý câu chuyện** trước khi viết YAML: liệt kê 5–12 bước, mỗi bước **một ý**, theo mạch *bối cảnh → vấn đề → giải pháp → kết quả*. Xem `reference/storytelling.md`.
3. **Chọn nhân vật**: liệt kê các thực thể sẽ xuất hiện, gán `shape` + `icon` theo `reference/shapes.md`. Đặt id ngắn, không dấu (`customer`, `erp`, `order-db`).
4. **Viết `<tên>.deck.md`** theo `reference/format.md`. Scene ở bước đầu khai báo ít node; các bước sau **chỉ thêm/sửa/xoá** phần thay đổi.
5. **Kiểm tra**: chạy `present-maker check <file>`. Sửa đến khi in ra `✓ … không lỗi`. Thông báo lỗi có dạng `file:dòng:cột — …` và thường kèm gợi ý "Ý bạn là: …".
6. **Build**: `present-maker build <file>` (site tĩnh trong `out/<tên>/`) hoặc `--single` (1 file HTML chạy offline, để gửi khách). Nếu người dùng muốn xem trực tiếp: `present-maker dev <file>`.
7. Báo lại cho người dùng: đường dẫn file deck, file/thư mục đã build, và phím tắt khi trình chiếu (`→/←`, `P` trình chiếu, `N` ghi chú người nói, `F` toàn màn hình, `T` sáng/tối).

Nếu không có lệnh `present-maker` trong PATH: chạy bằng `node <đường-dẫn-present-maker>/bin/present-maker.js …`.

## Chuyển đổi từ UML / JSON / mô tả hệ thống

Xem `reference/from-uml.md`. Nguyên tắc: **không** dựng nguyên sơ đồ lên một bước. Tách thành chuỗi bước, mỗi bước thêm vài thực thể và một luồng chạy (`flows`) để kể chuyện "cái gì đi đâu".

## Quy tắc vàng

- Mỗi bước: lời giải thích **≤ 60 từ**, tối đa 1 callout.
- Mỗi scene hiển thị **3–9 node**. Đông hơn thì dùng `focus` để làm mờ phần còn lại, hoặc `remove` những gì không còn cần.
- Luôn có ít nhất một `flows` ở các bước nói về "luồng", vì gói tin chạy là thứ làm sơ đồ "sống".
- Dùng `status: down` / `hot` để diễn tả sự cố hoặc điểm nghẽn, thay vì viết dài.
- Dùng `zones` để nhóm theo hệ thống, phòng ban hoặc ranh giới tin cậy.
- **Không** tự đặt `at` (toạ độ) trừ khi người dùng yêu cầu bố cục cụ thể, vì auto-layout lo việc đó.
- Ghi chú người nói (sau `???`) dành cho chi tiết, số liệu phụ và câu hỏi dự kiến, không nhồi lên màn hình.

## Ví dụ hoàn chỉnh

`examples/` trong repo present-maker: `erp-sync.deck.md` (tích hợp), `business-approval.deck.md` (nghiệp vụ), `science-photosynthesis.deck.md` (khoa học, có công thức).
