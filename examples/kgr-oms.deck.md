---
title: KGR OMS — Luồng tích hợp
subtitle: Từ đơn trên sàn đến giao hàng, hoá đơn điện tử và NetSuite qua REST /api/oms/v1
author: KGR / CEV · Tài liệu hướng dẫn tích hợp
accent: "#e2572b"
---

Dành cho dev và đối tác tích hợp: ai gọi API nào, Odoo tự làm gì sau mỗi lệnh, và gọi lại thế nào khi có lỗi.

# Bức tranh chung

## Các bên tham gia | Các bên
Kênh bán không gọi thẳng vào Odoo. Mọi lệnh đi qua **Hub** (WSO2), rồi Hub gọi REST `/api/oms/v1` của **Odoo OMS**. OMS là nơi giữ đơn, kho và hoá đơn.

```scene
zones:
  hubz: { label: Hub tích hợp, color: "#e6dcf5" }
  oms: { label: Odoo OMS, color: "#d6e2f3" }
nodes:
  market: { shape: cloud, label: Sàn TMĐT, sub: kênh bán online }
  hub: { shape: gateway, label: Hub, sub: WSO2 MI, icon: network, zone: hubz }
  api: { shape: server, label: OMS API, sub: /api/oms/v1, icon: plug, zone: oms }
links: [market-hub, hub-api]
flows:
  - { path: market>hub>api, count: 3 }
```

???
Module Odoo: `oms_config` (Odoo 18, chạy trên `base_rest` + Pydantic).
Không còn `POST /sales-orders` và JSON-RPC `hub_upsert_marketplace_order`, mọi thứ đi qua REST.

## Xác thực và nhật ký | Xác thực
Mỗi request mang `Authorization: Bearer <API key>` (scope `rpc`). Swagger sinh tự động ở `/api-docs`. Mọi request, thành công hay lỗi, đều được ghi vào **rest.log**, với header Authorization đã bị che.

```scene
nodes:
  log: { shape: database, label: rest.log, sub: giữ 30 ngày, icon: scroll-text, zone: oms }
links: [api-log]
flows:
  - { path: hub>api, kind: ping, label: Bearer API key }
  - { path: api>log, kind: data }
focus: [hub, api, log]
```

> [!info] Lỗi luôn có dạng `{"error": {"code", "message"}}`.

???
User tích hợp cần nhóm: Sales / User: All Documents, Contacts, Accounting / Invoicing, Inventory / User. `POST /teams` cần thêm Sales / Administrator.
`rest.log.retention.days` = 0 thì tắt ghi log.

# Đơn hàng

## Khai báo kênh bán | Kênh bán
`POST /teams` tạo hoặc cập nhật **kênh bán** (`crm.team`), nhận diện theo `name`. Trường quan trọng nhất là `fulfillment_type`: **smartlog** (kho 3PL giao) hay **consigned** (hàng ký gửi). Trường này không có giá trị mặc định.

```scene
remove: [log]
nodes:
  team: { shape: team, label: Kênh bán, sub: crm.team, zone: oms }
links: [api-team]
flows:
  - { path: hub>api>team, label: POST /teams }
```

> [!warn] Kênh mới mà gắn sẵn Smartlog có thể giao nhầm hàng ký gửi, nên luôn khai rõ.

???
Tạo mới trả 201 `created: true`, gọi lại trả 200 `created: false`. Tên trùng với kênh đã lưu trữ thì 422.
`TeamOut.id` dùng để điền `team_id` trên đơn.

## Gửi đơn hàng | Tạo đơn
`POST /orders`: cặp `client_order_ref` + `team_id` là khoá của đơn, nên gọi lại không sinh đơn thứ hai. SKU không tìm thấy thì dòng dùng sản phẩm **UDF**. Gửi `state: sale` để xác nhận đơn.

```scene
nodes:
  order: { shape: document, label: Đơn bán, sub: sale.order, icon: shopping-cart, zone: oms }
links: [api-order, { from: team, to: order, style: dashed, label: team_id }]
flows:
  - { path: market>hub>api>order, count: 3, label: POST /orders }
```

```changes
+ Đơn mới: 201 · đơn đã có: 200
~ Đơn đã có thì không sửa dòng hàng
~ Kho lấy theo warehouse_code, hoặc kho của kênh
```

???
`discount` (%) và `discount_amount` (tiền) chỉ gửi một trong hai. Lệch quá một đơn vị làm tròn thì 422.
Không gửi `partner` thì dùng khách mặc định của sàn.

## Đơn bị giữ lại | Giữ đơn
Odoo không xác nhận đơn còn `hold_reasons`: có dòng **UDF**, giá thấp hơn bảng giá cần duyệt, hoặc kênh chưa khai loại giao. API vẫn trả 201/200 kèm `confirm_held` và không rollback, để không mất đơn.

```scene
nodes:
  order: { status: hot, sub: confirm_held }
  lead: { shape: person, label: Trưởng nhóm, sub: nhận activity, zone: oms }
links: [{ from: order, to: lead, style: dashed, label: activity }]
flows:
  - { path: order>lead, kind: event }
focus: [order, lead, team]
```

> [!tip] Trưởng nhóm đổi dòng UDF sang sản phẩm thật trên giao diện, và giá sàn đã gửi vẫn được giữ.

```metrics
hold_reasons: udf · price_approval · fulfillment_type_missing
```

## Khuyến mại cả đơn | Khuyến mại
`order_discount_amount` trở thành một dòng giảm riêng và được ghi lên header đơn. Khi xác nhận, số này được **phân bổ hết** xuống các dòng hàng không phải quà tặng (`disc_amount`), rồi header về 0.

```scene
nodes:
  order: { status: ok, sub: sale.order }
remove: [lead]
focus: [order]
```

```changes
+ Dòng giảm oms_order_discount (ẩn trên form)
~ Xác nhận: chia xuống disc_amount từng dòng
~ Header order_discount_amount về 0
```

> [!warn] Còn số khuyến mại chưa phân bổ thì đơn không xác nhận được. Nút **Phân bổ** cho phép chọn dòng nhận.

# Giao hàng

## Hub lấy phiếu cần giao | Phiếu xuất
Đơn xác nhận sinh ra **phiếu xuất**. Hub gọi `GET /fulfillment-pickings?fulfillment_type=smartlog` để lấy các phiếu đang chờ, rồi chuyển cho **Smartlog**. Hàng ký gửi không đi đường này.

```scene
nodes:
  picking: { shape: box, label: Phiếu xuất, sub: stock.picking, icon: package, zone: oms }
  smartlog: { shape: building, label: Smartlog, sub: kho 3PL, icon: truck }
links: [order-picking, hub-smartlog]
flows:
  - { path: picking>api>hub>smartlog, kind: data, count: 2, label: GET /fulfillment-pickings }
```

???
Chỉ trả phiếu outgoing của đơn bán, không phải phiếu trả, không phải backorder. Hub tự lần các backorder.

## Báo đã giao | Giao hàng
Smartlog giao xong thì Hub gọi `POST /deliveries` với một `external_ref` riêng cho lần giao. Odoo chốt phiếu, **commit**, rồi lập và vào sổ **hoá đơn** ngay.

```scene
nodes:
  invoice: { shape: document, label: Hoá đơn, sub: account.move, icon: receipt, zone: oms }
links: [picking-invoice]
flows:
  - { path: smartlog>hub>api>picking, label: POST /deliveries }
  - { path: picking>invoice, kind: data, label: posted }
```

> [!info] Trên `/orders`: `fulfillment_status: full` chốt hết phần còn lại và xuất hoá đơn. Giao từng phần (`partial`) thì phải dùng `/deliveries`.

## Lỗi giữa chừng và gọi lại | Gọi lại
Nếu hoá đơn lỗi **sau khi** phiếu đã commit, phiếu giữ cờ `oms_invoice_pending` và API trả lỗi. Hub chỉ cần **gọi lại với cùng `external_ref`**: Odoo bỏ qua phần đã xong và làm nốt hoá đơn.

```scene
nodes:
  invoice: { status: down }
flows:
  - { path: picking>invoice, kind: fail, label: lỗi hoá đơn }
  - { path: hub>api>picking, kind: ping, label: cùng external_ref }
focus: [hub, api, picking, invoice]
```

```changes
~ Gọi lại phiếu đã xong: replayed = true
~ Lần giao sau tự làm nốt phiếu còn treo trước
- Không chốt phiếu mới khi phiếu cũ còn lỗi
```

## Trả hàng | Trả hàng
`POST /returns` (hoặc `returns[]` trong `/orders`) tạo phiếu trả từ phiếu xuất gốc. Nếu dòng đã xuất hoá đơn, Odoo lập **credit note**. `refund_amount` ép tổng credit bằng đúng số tiền sàn đã hoàn.

```scene
nodes:
  invoice: { status: ok }
  ret: { shape: box, label: Phiếu trả, sub: restock?, icon: undo-2, color: orange, zone: oms }
  credit: { shape: document, label: Credit note, sub: out_refund, icon: receipt-text, zone: oms }
links: [picking-ret, ret-credit]
flows:
  - { path: hub>api>ret, label: POST /returns }
  - { path: ret>credit, kind: data }
```

> [!tip] `restock: false` đưa hàng về vị trí **Non-restock return location**. Kết quả từng lệnh trả: `done`, `replayed`, `waiting`, `error`.

???
`waiting` và `error` không đổi HTTP của đơn. `REFUND_EXCEEDS_RETURN_VALUE` khi số hoàn lớn hơn giá trị hàng trả.

# Kế toán

## Gom đơn tổng hằng ngày | Đơn tổng
Mỗi ngày cron gom các dòng **đã giao đủ** đến hết hôm qua thành **đơn tổng** (`master.order`). Đơn tổng nào còn `problems` thì `ready = false` và chưa được đẩy đi.

```scene
remove: [ret]
nodes:
  master: { shape: database, label: Đơn tổng, sub: master.order, icon: layers, zone: oms }
links: [order-master]
flows:
  - { path: order>master, kind: data, count: 3, label: cron hằng ngày }
focus: [order, master, team]
```

```metrics
gộp theo: kênh · ngày giao · kho · thuế
```

???
`problems`: ORDER_DISCOUNT_NOT_ALLOCATED, MISSING_PARTNER, MISSING_WAREHOUSE, LINE_WITHOUT_PRODUCT, LINE_MULTIPLE_TAXES, TAX_INCLUDED_WITHOUT_EXCLUDED, NO_LINES, TOTAL_MISMATCH.

## Đẩy đơn tổng sang NetSuite | NetSuite
Cron 30 phút gửi id các đơn tổng đã xác nhận cho Hub. Hub đọc `GET /master-orders`, tạo hoá đơn trên **NetSuite**, rồi gọi `push-result` để ghi `erp_id`. Khi đó đơn tổng chuyển sang **done**.

```scene
nodes:
  netsuite: { shape: building, label: NetSuite, sub: ERP, icon: landmark }
links: [hub-netsuite, { from: master, to: hub, style: dashed, label: /sync/master-order }]
flows:
  - { path: master>hub, kind: event, label: ids }
  - { path: hub>netsuite, kind: data }
  - { path: hub>api>master, kind: ping, label: push-result }
```

> [!warn] Gọi `push-result` với `erp_id` khác trên một đơn đã **done** thì nhận 409. Cùng `erp_id` thì 200 và không đổi gì.

## Hoá đơn điện tử VNPAY | VNPAY
Odoo **không gọi VNPAY**. Cron 10 phút gửi id các hoá đơn đã vào sổ cho Hub. Hub gửi sang VNPAY rồi ghi số hoá đơn ngược vào Odoo. **n8n** hỏi lại VNPAY theo lịch cho tới trạng thái cuối.

```scene
nodes:
  vnpay: { shape: cloud, label: VNPAY, sub: hoá đơn điện tử }
  n8n: { shape: server, label: n8n, sub: hỏi lại theo lịch, icon: workflow, zone: hubz }
links: [hub-vnpay, n8n-vnpay, { from: n8n, to: invoice, style: dashed, label: ghi vnpay_* }]
flows:
  - { path: invoice>hub>vnpay, label: /sync/sales-invoice }
  - { path: n8n>vnpay, kind: ping }
  - { path: n8n>invoice, kind: data }
focus: [invoice, hub, vnpay, n8n, api]
```

```metrics
vnpay_status: submitted → issued → accepted
```

???
Lỗi hoặc thuế từ chối: Hub/n8n ghi đè `narration` bằng "VNPAY <thời gian> <lỗi> (traceId ...)".
Chỉ bật MỘT trong hai: cron Odoo hoặc lịch workflow n8n 10.

## Hoá đơn sang NetSuite | ERP invoice
Hoá đơn và credit note đã có số VNPAY được Hub lấy qua `GET /erp-invoices` để tạo **ECOM Transaction Data** trên NetSuite, rồi `push-result` ghi `erp_id`. Khách trên ERP là khách đại diện của kênh.

```scene
flows:
  - { path: invoice>hub>netsuite, kind: data, label: GET /erp-invoices }
  - { path: credit>hub, kind: data }
  - { path: hub>api>invoice, kind: ping, label: push-result }
focus: [invoice, credit, hub, netsuite, api]
```

> [!info] Hoá đơn thiếu dữ liệu vẫn trả 200, nhưng với `ready = false` và danh sách `problems`.

# Vận hành

## Toàn cảnh và quy tắc gọi lại | Toàn cảnh
Mọi lệnh ghi đều **idempotent** theo khoá: `client_order_ref` + `team_id`, `external_ref`, `erp_id`. Gặp lỗi mạng hay 503 thì gọi lại với cùng body là an toàn.

```scene
remove: [n8n-invoice, master-hub]
flows:
  - { path: market>hub>api>order, label: đơn }
  - { path: smartlog>hub>api>picking, kind: event, label: giao }
  - { path: invoice>hub>vnpay, kind: data }
  - { path: master>hub>netsuite, kind: data }
```

> [!tip] 503 nghĩa là database đang bận: đọc header `Retry-After: 5`, chờ rồi gọi lại.

???
Mã HTTP: 401 sai key · 403 thiếu quyền · 404 không thấy · 409 xung đột (erp_id khác) · 422 body sai hoặc lỗi nghiệp vụ · 503 DB bận · 500 xem log máy chủ.
Cài: `odoo-bin -c odoo_18.conf -d <db> -u oms_config --stop-after-init`.
