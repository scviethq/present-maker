# Chuyển từ UML / JSON / mô tả hệ thống sang deck

Nguyên tắc chung: sơ đồ nguồn là **toàn cảnh tĩnh**, còn deck là **câu chuyện từng bước**. Đừng chép nguyên sơ đồ vào một bước.

## Component / deployment diagram
1. Mỗi component thành một node (`server`, `database`, `queue`, `gateway`, `cloud`…), mỗi package/node triển khai thành một `zone`.
2. Dependency thành `links`.
3. Chọn **một use case** đi xuyên qua hệ thống. Mỗi bước thêm các component mà use case chạm tới, kèm `flows` theo đúng thứ tự gọi.

## Sequence diagram
- Mỗi lifeline thành một node. Actor dùng `person`.
- Gom các message liên tiếp có cùng mục đích thành **một bước**, với `flows: [a>b>c]`.
- Message trả về: `kind: data` theo chiều ngược, hoặc dùng `kind: ping` cho cặp gọi rồi trả.
- `alt`/`opt` (nhánh lỗi) thành một bước riêng với `kind: fail` và `status: down`.
- Message bất đồng bộ thành `kind: event`.

## Activity diagram / BPMN / quy trình nghiệp vụ
- Swimlane thành `zones` (một zone cho mỗi phòng ban/vai trò).
- Actor thành `person`/`team`; task thành bước kể chuyện (không nhất thiết là node); artefact/chứng từ thành `document`; gateway quyết định thành `decision`.
- Mỗi bước kể: *ai* nhận *chứng từ gì* từ *ai*, và `flows` cho chứng từ di chuyển.
- Thời gian chờ và tỉ lệ lỗi đưa vào `metrics`.

## JSON mô tả hệ thống
Với dạng phổ biến kiểu:
```json
{ "services": [{ "name": "order", "type": "api", "dependsOn": ["db", "queue"] }],
  "datastores": [{ "name": "db", "type": "postgres" }] }
```
- `services[]` thành `server` (hoặc `gateway` nếu là ingress/LB), `datastores[]` thành `database`, `queues/topics[]` thành `queue`, `externals[]` thành `cloud`/`building`.
- `dependsOn` thành `links`.
- Trường mô tả công nghệ (`postgres`, `Node.js`) đưa vào `sub`.
- Vẫn phải **chọn câu chuyện**: hỏi người dùng (hoặc tự suy ra) luồng quan trọng nhất cần trình bày.

## Kiểm tra lại sau khi chuyển
- Có bước nào hiện quá 9 node mà không có `focus`? Tách bước ra hoặc thêm `focus`.
- Mỗi bước có đúng một ý chưa?
- `present-maker check` sạch chưa?
