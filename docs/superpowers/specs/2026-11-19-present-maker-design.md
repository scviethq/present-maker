# present-maker — Thiết kế

Ngày: 2026-11-19 · Trạng thái: chờ duyệt

## 1. Mục đích và lý do

Một công cụ biến **một file Markdown có nhúng khối sơ đồ** thành **website trình bày dạng sơ đồ isometric 3D động, bấm qua từng bước**. Lấy cảm hứng về trải nghiệm từ https://designed-to-scale.vercel.app/ (chữ một bên, sơ đồ sống một bên, sơ đồ biến đổi qua từng bước).

Dùng để **đứng thuyết trình**: cho khách hàng, cho team, trong webinar. Nội dung trải rộng:
- luồng nghiệp vụ kinh doanh (người, phòng ban, chứng từ, bước duyệt)
- luồng tích hợp hệ thống (service, API, queue, DB)
- chủ đề khoa học (khái niệm, quá trình, công thức)

Luồng làm việc đầy đủ:

```
Ý tưởng / tài liệu thô / UML
   │  AI agent dùng skill "present-maker"
   ▼
deck.md  (Markdown + khối ```scene```)
   │  present-maker check → sửa lỗi → present-maker build
   ▼
thư mục tĩnh (hoặc 1 file HTML) → mở trình duyệt / deploy → thuyết trình
```

## 2. Mục tiêu / Không làm / Thất bại nếu

**Mục tiêu (v1)**
1. Định dạng `deck.md` người đọc–viết được, AI sinh ra ổn định.
2. Renderer isometric 3D (three.js) với bộ khối đại diện chung + nhãn chữ + icon trên mặt khối, đủ phủ 3 loại nội dung.
3. Chuyển cảnh mượt giữa các bước: khối hiện/ẩn/di chuyển, đường nối, gói tin chạy theo luồng, highlight.
4. Chế độ thuyết trình: phím mũi tên, toàn màn hình, chữ đọc được trên máy chiếu.
5. CLI `dev` (live reload), `check` (báo lỗi có số dòng), `build` (site tĩnh, tuỳ chọn 1 file HTML chạy offline).
6. Skill cho AI agent để sinh `deck.md` đúng chuẩn và kể chuyện tốt.

**Không làm ở v1**
- Trình soạn thảo WYSIWYG / kéo thả.
- Import UML/PlantUML/JSON trực tiếp — việc chuyển đổi do agent làm qua skill.
- Import mô hình glTF tuỳ ý, xuất PDF/PPTX, đa ngôn ngữ giao diện, cộng tác, hosting.

**Thất bại dù vẫn chạy được, nếu:**
- AI phải tự tính toạ độ mới ra sơ đồ coi được → bắt buộc có **tự động bố cục**.
- Chữ tiếng Việt mờ/vỡ dấu hoặc quá nhỏ trên máy chiếu.
- Lúc thuyết trình cần internet mới chạy.
- Một lỗi gõ trong YAML làm trắng trang mà không nói lỗi ở đâu.

## 3. Ràng buộc

- Chạy trong trình duyệt hiện đại (Chrome/Edge/Safari) trên laptop; máy chiếu 1080p là mục tiêu chính, mobile chỉ cần xem được (layout xếp chồng).
- Build ra file tĩnh, không backend.
- Không sao chép mã, asset hay nội dung của trang tham khảo — chỉ học trải nghiệm.
- Tiếng Việt là ngôn ngữ nội dung chính.

## 4. Các phương án đã cân nhắc

| | Phương án | Được | Mất |
|---|---|---|---|
| **A ✅** | **Isometric 3D (three.js)** như trang mẫu | Ấn tượng nhất, đúng chất trang mẫu | Tốn công nhất; cần bộ khối chung + auto-layout |
| B | Engine 2D SVG tự viết | Phủ mọi chủ đề nhờ kho icon 2D, rẻ hơn | Mất chiều sâu 3D |
| C | Slidev/Reveal.js + plugin | Có sẵn presenter mode, PDF | Thành bộ slide thường, khó có "sơ đồ sống" |

**Chọn A** (quyết định của người dùng). Vấn đề "khái niệm nào cũng cần mô hình 3D" được giải bằng: **khối đại diện chung + nhãn chữ + icon in lên mặt trên khối**.

## 5. Định dạng `deck.md`

### 5.1 Cấu trúc

````md
---
title: Quy trình xử lý đơn hàng
subtitle: Từ lúc khách bấm "Đặt" đến lúc giao hàng
author: Team Platform
theme: light            # light | dark
accent: "#e2572b"
---

# Vấn đề                  ← (tuỳ chọn) chương; hiện trên thanh tiến trình

## Khách đặt hàng | Đặt hàng   ← một BƯỚC. Phần sau "|" là tên ngắn trên thanh bước
Đơn đi từ web vào hệ thống **Order**.     ← lời giải thích (markdown thường)

```scene
nodes:
  customer: { shape: person, label: Khách hàng }
  web:      { shape: device, label: Website, icon: globe }
  order:    { shape: server, label: Order Service }
links: [customer-web, web-order]
flows:
  - { path: customer>web>order, kind: req }
```

> [!tip] Mỗi đơn có mã idempotency để tránh tạo trùng.

```changes
+ Order Service
~ Website gọi thẳng Order
```

```metrics
đơn/giờ: 1200
lỗi: 0.2%
```

???
Ghi chú người nói: nhấn mạnh chỗ trùng đơn tuần trước.
````

### 5.2 Quy tắc

- `#` = chương (tuỳ chọn). `##` = bước. Bước đầu tiên trước mọi `##` (nếu có nội dung) là trang bìa, tự sinh từ frontmatter nếu trống.
- Mỗi bước có tối đa **một** khối `scene`. Scene là **phần thay đổi** so với bước trước: node/link/zone **được giữ lại** qua các bước; `flows`, `focus` **chỉ sống trong bước đó**.
- Callout: `> [!tip]`, `> [!warn]`, `> [!info]`.
- `changes`: dòng bắt đầu `+` (thêm), `-` (bỏ), `~` (đổi). Chỉ để hiển thị.
- `metrics`: cặp `tên: giá trị`; giá trị số chạy hiệu ứng đếm khi đổi bước.
- `???` → mọi thứ sau đó trong bước là speaker notes.
- Khối khác được hỗ trợ trong lời giải thích: `$$…$$` (KaTeX), ảnh `![](...)` (được bundle khi build), code có highlight.

### 5.3 Schema `scene`

```yaml
layout: auto            # auto (mặc định) | manual. auto: node không có `at` được tự xếp
direction: right        # hướng auto-layout: right | down
nodes:
  <id>:
    shape: server       # xem 6.2
    label: "Tên"        # hiện dưới/trên khối, HTML overlay
    sub: "mô tả ngắn"   # dòng phụ, nhỏ hơn
    icon: credit-card   # tên icon Lucide, in lên mặt trên khối
    color: blue         # tên trong palette hoặc mã hex
    at: [x, y]          # toạ độ lưới (tuỳ chọn, ghi đè auto-layout)
    size: m             # s | m | l
    zone: noibo         # thuộc zone nào
    status: ok          # ok | down | hot | muted  (đổi màu/hiệu ứng)
    count: 3            # tuỳ chọn: vẽ N bản sao xếp chồng (cụm server, nhóm người)
zones:
  <id>: { label: "Nội bộ", color: sand }    # tấm nền phẳng bao các node cùng zone (swimlane/biên hệ thống)
links:
  - customer-web                            # rút gọn
  - { from: web, to: order, label: "REST", style: dashed, dir: both }
flows:
  - customer>web>order                      # rút gọn
  - { path: order>db, kind: data, count: 3, label: "ghi đơn" }
remove: [old_node, web-order]               # xoá node hoặc link (link id = "a-b")
focus: [order, db]                          # làm mờ phần còn lại trong bước này
```

- `kind` của flow: `req` (mặc định), `data`, `event`, `fail` (gói tin đỏ, vỡ khi tới đích), `ping`.
- Sửa node đã có: khai báo lại cùng id với thuộc tính cần đổi (merge nông).
- Link tham chiếu node không tồn tại, id trùng, shape/icon không biết → **lỗi `check`** kèm số dòng trong `deck.md`.

## 6. Renderer

### 6.1 Giao diện (giống tinh thần trang mẫu)

```
┌──────────────────────────────────────────────────────────────┐
│ Quy trình xử lý đơn hàng                         ☾  ⛶        │
├───────────────────────┬──────────────────────────────────────┤
│ VẤN ĐỀ · 2/9          │                                      │
│ Khách đặt hàng        │        [sơ đồ isometric 3D]          │
│                       │      👤 ──▶ 🖥 ──▶ ▣ Order            │
│ Đơn đi từ web vào...  │        gói tin chạy trên link         │
│ ┌ tip ─────────────┐  │                                      │
│ └──────────────────┘  │  ┌ metrics ───────────────┐          │
│ + Order Service       │  │ đơn/giờ 1200 · lỗi 0.2%│          │
├───────────────────────┴──┴────────────────────────┴──────────┤
│ ● Bìa ─ ● Đặt hàng ─ ○ Thanh toán ─ ○ ...        ← →         │
└──────────────────────────────────────────────────────────────┘
```

- **Desktop/máy chiếu**: chữ trái (~36%), sơ đồ phải. **Chế độ trình chiếu** (phím `P`): ẩn panel chữ, sơ đồ toàn màn hình, chỉ còn tiêu đề bước + callout làm phụ đề.
- **Mobile**: xếp chồng sơ đồ trên, chữ dưới.
- Phím: `←/→`, `Space`, `Home/End`, `F` toàn màn hình, `P` trình chiếu, `N` mở cửa sổ speaker notes (đồng bộ qua `BroadcastChannel`), `T` đổi theme. URL hash `#/5` nhảy bước.
- Theme sáng/tối, màu nhấn từ frontmatter.

### 6.2 Bộ khối đại diện (v1)

Dựng bằng hình học three.js (không cần file mô hình), phong cách low-poly, flat shading, bóng đổ nhẹ:

| shape | dùng cho |
|---|---|
| `box` | khái niệm chung, mặc định |
| `server` | service, backend (khối có khe) |
| `database` | DB, kho dữ liệu (trụ) |
| `queue` | queue, topic, hàng đợi (thanh dài chia ô) |
| `gateway` | LB, API gateway, cổng (khối thấp rộng) |
| `cloud` | dịch vụ bên ngoài, SaaS |
| `device` | web/app/điện thoại/máy tính |
| `person` | người, vai trò |
| `team` | phòng ban, nhóm (cụm người) |
| `document` | chứng từ, hoá đơn, hợp đồng (tấm mỏng) |
| `decision` | điểm rẽ nhánh/duyệt (khối thoi) |
| `building` | tổ chức, đối tác, chi nhánh |
| `sphere` | thực thể khoa học, hạt, khái niệm trừu tượng |
| `cylinder`, `cone`, `plate` | hình cơ bản cho mọi thứ còn lại |

Mọi khối nhận `icon` (Lucide, render ra texture lên mặt trên) + `label`. Thêm shape mới = thêm một hàm dựng hình trong `shapes/`.

### 6.3 Kỹ thuật

- Camera **orthographic** góc isometric cố định; tự fit khung theo bounding box của node đang hiển thị, chuyển mượt khi scene đổi.
- **Auto-layout**: dùng `elkjs` (layered) trên mặt phẳng 2D (có tính zone làm nhóm), rồi chiếu lên mặt đất isometric. Kết quả layout giữ ổn định giữa các bước: node đã có vị trí không bị xếp lại trừ khi bắt buộc.
- Nhãn chữ: **HTML overlay** (CSS2DRenderer) để tiếng Việt sắc nét, font nhúng (Be Vietnam Pro / Inter).
- Chuyển cảnh ~500ms: node mới mọc lên từ mặt đất, node bị xoá chìm xuống + mờ, node di chuyển trượt, link vẽ dần.
- Flows: gói tin là khối nhỏ chạy theo đường cong của link, lặp lại tới khi sang bước khác.
- Tôn trọng `prefers-reduced-motion`.

## 7. CLI

```
present-maker dev   deck.md            # server local, live reload khi lưu
present-maker check deck.md            # validate, in lỗi dạng file:dòng:cột — thông điệp; exit 1 nếu lỗi
present-maker build deck.md -o dist/   # site tĩnh (deploy Vercel/Netlify/mở trực tiếp)
present-maker build deck.md --single   # 1 file HTML tự chứa, chạy offline (gửi khách)
present-maker init  [tên]              # tạo deck mẫu
```

Pipeline: parse Markdown (markdown-it) → tách bước/khối → parse YAML → validate (zod) → tính trạng thái scene đầy đủ cho từng bước → nhúng JSON vào bundle runtime đã build sẵn.

## 8. Skill cho AI agent

Thư mục `skill/present-maker/` theo định dạng Claude Code skill:
- `SKILL.md`: khi nào dùng; quy trình **đọc nguồn → dàn ý câu chuyện → viết deck → chạy `check` → sửa tới khi sạch → `build`**.
- `reference/format.md`: đặc tả mục 5.
- `reference/shapes.md`: bảng khối + khi nào dùng cái nào, gợi ý icon.
- `reference/storytelling.md`: mỗi bước một ý; mở bằng vấn đề → giải pháp → kết quả; lời giải thích ≤ 60 từ; 3–9 node mỗi scene; dùng `focus` thay vì nhồi; dùng `flows` để kể chuyện "cái gì chạy đi đâu".
- `reference/from-uml.md`: cách chuyển sequence/activity/component diagram, JSON mô tả hệ thống sang các bước.
- `examples/`: 3 deck mẫu — nghiệp vụ (duyệt đơn mua hàng), tích hợp (đồng bộ ERP ↔ e-commerce qua queue), khoa học (một quá trình có công thức).

## 9. Cấu trúc repo đề xuất

```
present-maker/
  packages/
    core/        # parser + validator + scene state (TS, test kỹ)
    runtime/     # three.js renderer + UI (Vite build)
    cli/         # lệnh dev/check/build/init
  skill/present-maker/
  examples/
  docs/
```

## 10. Kiểm thử

- `core`: unit test cho parser, diff scene, validate (bao gồm số dòng lỗi) — TDD.
- `runtime`: test snapshot trạng thái scene; kiểm tra thủ công/screenshot bằng Playwright cho 3 deck mẫu ở 1920×1080 và 390×844.
- Kiểm thử đầu-cuối: agent dùng skill sinh deck từ một mô tả → `check` sạch → `build` mở được offline.

## 11. Quyết định do mình đưa ra (người dùng có thể đổi)

- Cú pháp: `##` = bước, khối ```` ```scene ```` YAML dạng diff, `???` cho speaker notes, callout kiểu `> [!tip]`.
- Auto-layout bằng elkjs là mặc định; `at` chỉ để chỉnh tay.
- Nhãn bằng HTML overlay thay vì chữ 3D.
- Icon dùng Lucide.
- Stack: TypeScript, Vite, three.js, markdown-it, yaml, zod, elkjs, KaTeX.
- Có cả xuất site tĩnh và 1 file HTML offline.

## 11b. Thay đổi trong lúc xây (2026-11-20)

- Camera không dùng góc isometric chuẩn 45° mà lệch ~23° (cao ~36°): với 45°, một quy trình dài nằm thành một vệt chéo nhỏ xíu; ở 23° luồng trái→phải chạy ngang màn hình mà khối vẫn thấy hai mặt bên. Đã thử thay bằng chế độ bẻ dòng của ELK nhưng đường nối rối và mất thứ tự đọc, nên bỏ.
- Nhãn co giãn theo mức zoom (giới hạn 0.8–1.15) để sơ đồ đông không bị chữ đè.
- Cửa sổ speaker notes được cập nhật trực tiếp qua tham chiếu `window.open` (chạy được cả khi mở file:// ) thay cho `BroadcastChannel`.
- Validate scene viết tay (không dùng zod) để thông báo lỗi tiếng Việt, kèm dòng và gợi ý tên gần đúng.
- Một package duy nhất (`src/core|runtime|cli`) thay vì monorepo 3 package.

## 12. Để lại cho người xây dựng

- Chi tiết hình học/màu từng khối, palette cụ thể, easing.
- Cách ổn định layout giữa các bước.
- Cách cửa sổ speaker notes đồng bộ cụ thể.
