# Bộ khối (shape) và cách chọn

Khối là **hình đại diện**: nhãn (`label`) và icon nói rõ nó là gì. Chọn khối theo *vai trò*, không theo tên.

| shape | Dùng cho | Icon gợi ý |
|---|---|---|
| `person` | một người, một vai trò (khách hàng, nhân viên, admin) | — (icon hiện trong nhãn) |
| `team` | phòng ban, nhóm, đội | — |
| `device` | web, app, điện thoại, máy POS, máy tính | `globe`, `smartphone`, `monitor` |
| `server` | service, backend, API, worker, job | `server`, `cpu`, `refresh-cw`, `shield` |
| `gateway` | load balancer, API gateway, cổng thanh toán, firewall | `network`, `shield-check`, `split` |
| `database` | database, kho dữ liệu, sổ cái, bảng | `database`, `wallet`, `archive` |
| `queue` | queue, topic, event bus, hàng chờ xử lý, inbox | `mail`, `inbox`, `list-ordered` |
| `cloud` | dịch vụ bên ngoài, SaaS, bên thứ ba | — |
| `building` | tổ chức, đối tác, chi nhánh, nhà cung cấp, ngân hàng | `landmark`, `truck`, `factory` |
| `document` | chứng từ, hoá đơn, hợp đồng, phiếu, báo cáo, file | `file-text`, `receipt`, `file-signature` |
| `decision` | điểm rẽ nhánh, bước duyệt, điều kiện | `scale`, `check-check`, `git-branch` |
| `sphere` | thực thể khoa học (hạt, phân tử, hành tinh), khái niệm trừu tượng | — |
| `cylinder` | bể chứa, pin, kho năng lượng, bộ nhớ | `battery-charging` |
| `cone` | quá trình/chu trình, đỉnh, nguồn phát | — |
| `plate` | bề mặt, nền tảng, lớp (layer), màng | `leaf`, `layers` |
| `box` | mọi thứ còn lại (mặc định) | bất kỳ |

- Icon được **in lên mặt trên** với các khối có mặt phẳng (`box`, `server`, `database`, `queue`, `gateway`, `document`, `decision`, `building`, `cylinder`, `plate`). Với khối tròn hoặc người, icon hiện trong nhãn.
- `count: 3` dùng cho cụm server, nhiều worker, nhóm khách hàng.
- `size: l` cho nhân vật chính, `size: s` cho thứ phụ (gói dữ liệu, phân tử nhỏ).

## Màu
Mỗi shape có màu mặc định hợp lý, chỉ đặt `color` khi cần phân biệt:
- cùng loại nhưng khác vai trò (2 người: khách hàng `orange`, nhân viên `teal`);
- tô điểm một thứ quan trọng (`accent` = màu nhấn của deck).

Tên màu: `orange blue teal green yellow red purple pink gray sand ink`, `accent`, hoặc `"#rrggbb"`.
