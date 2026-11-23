---
title: Quy trình duyệt đề nghị mua hàng
subtitle: Ai làm gì, chứng từ đi đâu, và chỗ nào hay bị kẹt
author: Phòng Vận hành
accent: "#3b6fd8"
---

# Luồng hiện tại

## Nhân viên lập đề nghị | Lập đề nghị
Nhân viên điền **phiếu đề nghị mua hàng** gồm mặt hàng, số lượng, dự toán và lý do.

```scene
zones:
  dept: { label: Phòng ban, color: "#dbe6f7" }
  finance: { label: Tài chính, color: "#dcefe6" }
  purchasing: { label: Mua hàng, color: "#f5e6cc" }
nodes:
  staff: { shape: person, label: Nhân viên, zone: dept }
  pr: { shape: document, label: Phiếu đề nghị, sub: PR-0142, icon: file-text, zone: dept }
links: [staff-pr]
flows: [staff>pr]
```

## Trưởng phòng duyệt | Trưởng phòng
Phiếu chuyển tới **trưởng phòng**. Dưới 20 triệu thì trưởng phòng duyệt luôn.

```scene
nodes:
  manager: { shape: person, label: Trưởng phòng, color: orange, zone: dept }
  check1: { shape: decision, label: "< 20 triệu?", icon: scale, zone: dept }
links: [pr-manager, manager-check1]
flows:
  - { path: pr>manager>check1, label: chờ duyệt }
```

> [!info] Trung bình mất **1,5 ngày** ở bước này, vì trưởng phòng duyệt bằng email.

```metrics
thời gian chờ: 1.5 ngày
```

## Trên 20 triệu: Kế toán kiểm tra ngân sách | Kế toán
Phiếu lớn được chuyển sang **kế toán** để đối chiếu ngân sách còn lại của phòng.

```scene
nodes:
  accountant: { shape: person, label: Kế toán, color: teal, zone: finance }
  budget: { shape: database, label: Ngân sách, icon: wallet, zone: finance }
links: [check1-accountant, { from: accountant, to: budget, dir: both }]
flows:
  - { path: check1>accountant>budget, kind: ping, label: đối chiếu }
```

```metrics
thời gian chờ: 3 ngày
```

## Mua hàng đặt với nhà cung cấp | Đặt hàng
Phiếu đã duyệt sang **phòng mua hàng**, tạo **đơn đặt hàng (PO)** gửi nhà cung cấp.

```scene
nodes:
  buyer: { shape: team, label: Phòng mua hàng, zone: purchasing }
  po: { shape: document, label: Đơn đặt hàng, sub: PO-0088, icon: shopping-cart, zone: purchasing }
  vendor: { shape: building, label: Nhà cung cấp, icon: truck }
links: [accountant-buyer, check1-buyer, buyer-po, po-vendor]
flows:
  - { path: check1>buyer>po>vendor, kind: data }
```

# Vấn đề

## Chỗ kẹt nằm ở đâu? | Điểm nghẽn
Hơn **70%** thời gian chờ nằm ở hai bước duyệt. Không ai biết phiếu đang nằm ở đâu.

```scene
nodes:
  manager: { status: hot }
  accountant: { status: hot }
focus: [manager, check1, accountant]
```

> [!warn] Phiếu bị "rơi" khi trưởng phòng đi công tác: không có người duyệt thay.

```metrics
thời gian chờ: 4.5 ngày
phiếu bị trễ: 38%
```

# Đề xuất

## Duyệt trên một hệ thống chung | Đề xuất
Đưa phiếu lên **hệ thống duyệt** với thông báo tự động, người duyệt thay và hạn xử lý 24 giờ.

```scene
nodes:
  manager: { status: ok }
  accountant: { status: ok }
  wf: { shape: server, label: Hệ thống duyệt, icon: workflow, color: purple }
links: [pr-wf, { from: wf, to: manager, style: dashed, label: thông báo }, { from: wf, to: accountant, style: dashed }]
flows:
  - { path: pr>wf>manager, kind: event, label: nhắc việc }
  - { path: wf>accountant, kind: event }
```

```changes
+ Hệ thống duyệt có SLA 24h
+ Người duyệt thay khi vắng
~ Email chỉ còn để thông báo
```

```metrics
thời gian chờ: 1 ngày
phiếu bị trễ: 5%
```
