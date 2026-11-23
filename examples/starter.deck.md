---
title: Bài trình bày của tôi
subtitle: Một câu mô tả ngắn
author: Tên bạn
theme: light
accent: "#e2572b"
---

Đoạn mở đầu, hiện ở trang bìa.

# Vấn đề

## Bước đầu tiên | Bắt đầu
Mỗi `##` là một bước. Viết 1–3 câu giải thích ở đây.

```scene
nodes:
  user: { shape: person, label: Người dùng }
  app: { shape: device, label: Ứng dụng }
  api: { shape: server, label: API, icon: server }
links: [user-app, app-api]
flows: [user>app>api]
```

> [!tip] Callout dùng để nhấn mạnh một ý.

# Giải pháp

## Thêm cơ sở dữ liệu | Lưu trữ
Scene chỉ cần ghi **phần thay đổi**: node cũ vẫn giữ nguyên.

```scene
nodes:
  db: { shape: database, label: Database }
links: [api-db]
flows:
  - { path: api>db, kind: data, label: lưu }
```

```changes
+ Database
```

???
Ghi chú người nói nằm sau dòng ???, nhấn N khi trình chiếu để mở.
