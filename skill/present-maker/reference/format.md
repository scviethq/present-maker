# Định dạng `.deck.md`

## Khung

````md
---
title: Tiêu đề deck            # bắt buộc nên có
subtitle: Một câu mô tả         # tuỳ chọn, hiện ở bìa
author: Người trình bày         # tuỳ chọn
theme: light                    # light | dark
accent: "#e2572b"               # màu nhấn (hex, nhớ đặt trong ngoặc kép)
---

Đoạn mở đầu (hiện ở trang bìa). Có thể có scene riêng cho bìa;
nếu bìa không có scene, bìa sẽ hiện trước sơ đồ cuối cùng (không có gói tin).

# Tên chương                    ← tuỳ chọn, nhóm các bước trên thanh tiến trình

## Tiêu đề bước | Tên ngắn       ← "| Tên ngắn" tuỳ chọn, hiện trên thanh bước
Lời giải thích (Markdown thường: **đậm**, `code`, danh sách, ảnh, $công thức$).

```scene
…YAML, xem bên dưới…
```

> [!tip] Callout: tip | warn | info

```changes
+ thứ được thêm
- thứ bị bỏ
~ thứ thay đổi
```

```metrics
tên chỉ số: 1,200
độ trễ: 95 ms
tỉ lệ lỗi: 0.2%
trạng thái: ổn định
```

???
Ghi chú người nói: mọi thứ sau ??? đến hết bước.
````

- Giá trị metric bắt đầu bằng số sẽ có hiệu ứng đếm khi đổi bước; giữ nguyên dấu phẩy và khoảng trắng như bạn viết.
- Công thức: `$…$` (trong dòng), `$$…$$` (khối riêng), cú pháp KaTeX.
- Ảnh: `![mô tả](duong-dan.png)`, đường dẫn tương đối với file deck.

## Khối `scene` (YAML)

Scene của mỗi bước **cộng dồn** lên bước trước:
- `nodes`, `links`, `zones`, `direction`: **giữ lại** qua các bước.
- `flows`, `focus`: **chỉ có hiệu lực trong bước đó**.

```yaml
direction: right          # right (mặc định) | down: hướng chảy của auto-layout

zones:                    # tấm nền nhóm các node (hệ thống, phòng ban, mạng…)
  internal: { label: Nội bộ, color: "#d6e2f3" }

nodes:
  api:                    # id: chữ thường, không dấu, có thể có "-"
    shape: server         # xem shapes.md, mặc định box
    label: Order API      # nhãn chính
    sub: "Node.js"        # dòng phụ nhỏ
    icon: shopping-cart   # tên icon Lucide (https://lucide.dev/icons)
    color: blue           # orange blue teal green yellow red purple pink gray sand ink | accent | "#hex"
    size: m               # s | m | l
    zone: internal        # phải khai báo trong zones trước (cùng bước hoặc bước trước)
    status: ok            # ok | down (xám + ✕ đỏ) | hot (nhấp nháy đỏ cam) | muted (mờ)
    count: 3              # 1–9: vẽ cụm nhiều bản (cluster, nhóm người)
    at: [2, 0]            # KHÔNG dùng trừ khi cần ép vị trí

links:
  - api-db                                  # rút gọn: from-to
  - { from: api, to: cache, label: "TTL 60s", style: dashed, dir: both }
  # style: solid | dashed ; dir: forward | both | none

flows:                                      # gói tin chạy, lặp lại trong bước
  - user>web>api                            # rút gọn
  - { path: api>db, kind: data, count: 3, label: "ghi đơn" }
  # kind: req (màu nhấn) | data (xanh ngọc) | event (tím) | fail (đỏ, vỡ trước đích) | ping (đi rồi về)

remove: [old-node, api-db]                  # xoá node (kèm link của nó), link (id "from-to") hoặc zone
focus: [api, db]                            # làm mờ mọi thứ khác trong bước này
```

### Sửa node đã có
Khai báo lại cùng id và chỉ ghi thuộc tính đổi:
```yaml
nodes:
  db: { status: down }
```

### Thứ tự xử lý trong một scene
`zones` → `nodes` → `remove` → `links` → `flows` → `focus`. Nghĩa là trong cùng một bước có thể vừa `remove` một link vừa thêm link mới.

## Lỗi thường gặp (và thông báo của `check`)

| Lỗi | Sửa |
|---|---|
| `Shape "databse" không tồn tại. Ý bạn là: database?` | dùng đúng tên trong shapes.md |
| `Icon "x" không có trong Lucide` | tra https://lucide.dev/icons, dùng tên kebab-case |
| `Link "a-b": không tìm thấy hai node…` | khai báo node trước hoặc sửa id |
| `zone "x" chưa được khai báo` | thêm vào `zones:` |
| `YAML lỗi trong scene` | thường do thiếu `}` hoặc chuỗi chứa `:` không có ngoặc kép |
| Chuỗi chứa `:` `#` `{` `[` | đặt trong ngoặc kép: `label: "Bước 1: nhận"` |
