# present-maker

Biến một file Markdown thành **website trình bày dạng sơ đồ isometric 3D**, bấm qua từng bước, có gói tin chạy theo luồng. Dùng cho thuyết trình với khách hàng, trình bày quy trình với team và webinar.

```
ý tưởng / tài liệu / UML ──(AI agent + skill)──▶ deck.md ──(present-maker)──▶ website
```

## Cài đặt

```bash
npm install
npm run build          # build runtime (three.js) + CLI
npm link               # tuỳ chọn: để có lệnh `present-maker` toàn máy
```

Yêu cầu Node ≥ 20.

## Dùng

```bash
present-maker init my-talk                         # tạo my-talk.deck.md mẫu
present-maker dev my-talk.deck.md                  # xem trực tiếp, tự tải lại khi lưu
present-maker check my-talk.deck.md                # kiểm tra lỗi (file:dòng:cột)
present-maker build my-talk.deck.md                # site tĩnh ở out/my-talk/ (deploy lên Vercel/Netlify…)
present-maker build my-talk.deck.md --single       # 1 file HTML tự chứa, chạy offline
```

Khi trình chiếu: `→` `←` `Space` chuyển bước · `P` chế độ trình chiếu (ẩn panel chữ) · `N` cửa sổ ghi chú người nói · `F` toàn màn hình · `T` sáng/tối · `#/5` trên URL để nhảy tới bước 5.

## Viết deck

````md
---
title: Đồng bộ đơn hàng
accent: "#e2572b"
---

## Shop gọi thẳng ERP | Gọi trực tiếp
Khi khách đặt hàng, Shop gọi API của ERP ngay trong request.

```scene
nodes:
  customer: { shape: person, label: Khách hàng }
  shop: { shape: device, label: Shop }
  erp: { shape: building, label: ERP, icon: warehouse }
links: [customer-shop, shop-erp]
flows: [customer>shop>erp]
```

> [!warn] Shop chỉ sống được khi ERP sống.
````

Đặc tả đầy đủ: [skill/present-maker/reference/format.md](skill/present-maker/reference/format.md). Bộ khối: [shapes.md](skill/present-maker/reference/shapes.md). Ví dụ: [examples/](examples/).

## Dùng với AI agent (Claude Code)

Thư mục [skill/present-maker/](skill/present-maker/) là một skill. Cài cho mọi project:

```bash
ln -s "$PWD/skill/present-maker" ~/.claude/skills/present-maker
```

Sau đó chỉ cần nói với agent, ví dụ "làm deck trình bày luồng thanh toán từ file docs/payment.md cho khách hàng". Agent sẽ viết `.deck.md`, chạy `check` cho tới khi sạch, rồi `build`.

## Cấu trúc

| Thư mục | Vai trò |
|---|---|
| `src/core/` | parse Markdown → kiểm tra scene → tính trạng thái từng bước → auto-layout (elkjs) → JSON |
| `src/runtime/` | ứng dụng three.js (renderer isometric, UI), đóng gói thành 1 file HTML |
| `src/cli/` | lệnh `check` / `build` / `dev` / `init` |
| `skill/present-maker/` | skill cho AI agent |
| `examples/` | deck mẫu: tích hợp, nghiệp vụ, khoa học |
| `scripts/screenshot.mjs` | chụp màn hình bằng Playwright để kiểm tra giao diện |

## Phát triển

```bash
npm test              # vitest: parser, scene, layout, compile
npm run typecheck
node scripts/screenshot.mjs "$PWD/out/erp-sync/index.html" /tmp/erp 1,2,3   # cần Google Chrome
```
