---
title: Đồng bộ đơn hàng Shop ↔ ERP
subtitle: Từ gọi API trực tiếp đến tích hợp qua hàng đợi
author: Team Tích hợp
accent: "#e2572b"
---

Câu chuyện về việc vì sao đơn hàng bị mất khi ERP bảo trì, và cách hàng đợi giải quyết nó.

# Hiện trạng

## Shop gọi thẳng ERP | Gọi trực tiếp
Khi khách đặt hàng, **Shop** gọi API của **ERP** ngay trong request. Đơn chỉ được báo "thành công" khi ERP trả lời.

```scene
zones:
  web: { label: Kênh bán, color: "#f1d9c9" }
  core: { label: Nội bộ, color: "#d6e2f3" }
nodes:
  customer: { shape: person, label: Khách hàng }
  shop: { shape: device, label: Shop, sub: web + app, zone: web }
  erp: { shape: building, label: ERP, sub: kế toán & kho, icon: warehouse, zone: core }
links: [customer-shop, shop-erp]
flows: [customer>shop>erp]
```

```metrics
đơn/phút: 120
p95: 850 ms
mất đơn: 0
```

???
Nhấn mạnh: đây là kiến trúc đang chạy, không sai về nghiệp vụ, chỉ là quá chặt.

## ERP bảo trì lúc 22h | ERP sập
Mỗi tối ERP bảo trì 20 phút. Mọi request từ Shop đều lỗi, khách thấy "đặt hàng thất bại".

```scene
nodes:
  erp: { status: down }
flows:
  - { path: customer>shop>erp, kind: fail, count: 3, label: timeout }
```

> [!warn] Ràng buộc chặt về thời gian: Shop chỉ sống được khi ERP sống.

```metrics
đơn/phút: 120
p95: 30,000 ms
mất đơn: 2,400
```

# Giải pháp

## Thêm hàng đợi ở giữa | Hàng đợi
Shop chỉ cần **ghi sự kiện "đơn mới" vào queue** rồi trả lời khách ngay. Việc đẩy sang ERP để sau.

```scene
nodes:
  erp: { status: ok }
  queue: { shape: queue, label: order.created, icon: mail, zone: core }
remove: [shop-erp]
links: [shop-queue]
flows:
  - { path: customer>shop>queue, count: 3, label: đơn mới }
```

```changes
+ Queue order.created
- Shop không gọi ERP nữa
~ Shop trả lời khách sau khi ghi queue
```

```metrics
p95: 95 ms
mất đơn: 0
```

## Worker đọc queue | Worker
Một **worker** đọc từng sự kiện và gọi ERP. Nếu ERP lỗi, sự kiện vẫn nằm trong queue và được thử lại.

```scene
nodes:
  worker: { shape: server, label: Sync worker, icon: refresh-cw, zone: core }
links: [queue-worker, worker-erp]
flows:
  - { path: queue>worker>erp, kind: event, count: 3 }
```

> [!tip] Mỗi sự kiện mang `orderId` làm khoá idempotency, nên gọi lại ERP nhiều lần cũng không tạo trùng.

## ERP bảo trì lần nữa | Chịu lỗi
ERP lại bảo trì, nhưng giờ khách **không hề biết**. Sự kiện dồn trong queue và được xử lý khi ERP lên lại.

```scene
nodes:
  erp: { status: down }
  queue: { status: hot, sub: "đang dồn 2.4k" }
flows:
  - { path: customer>shop>queue, count: 2 }
  - { path: worker>erp, kind: fail, count: 2, label: retry }
focus: [queue, worker, erp]
```

```metrics
p95: 95 ms
mất đơn: 0
tồn queue: 2,400
```

## Phản hồi tồn kho ngược lại | Hai chiều
ERP phát sự kiện **tồn kho thay đổi** qua một topic khác để Shop cập nhật số lượng hiển thị.

```scene
nodes:
  erp: { status: ok }
  queue: { status: ok, sub: "" }
  stock: { shape: queue, label: stock.changed, icon: package, zone: core }
links: [erp-stock, { from: stock, to: shop, style: dashed, label: subscribe }]
flows:
  - { path: erp>stock>shop, kind: data, count: 2, label: tồn kho }
```

```metrics
tồn queue: 0
độ trễ tồn kho: 3 s
```

???
Câu hỏi hay gặp: "nếu Shop đọc tồn kho trễ 3 giây thì sao?" — trả lời bằng chính sách giữ hàng khi thanh toán.
