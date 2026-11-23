---
title: Quang hợp diễn ra thế nào?
subtitle: Từ ánh sáng đến đường glucose, trong một chiếc lá
author: Webinar Sinh học phổ thông
theme: dark
accent: "#4f9d3a"
---

Một phương trình, hai giai đoạn, và vì sao lá có màu xanh.

# Tổng quan

## Phương trình tổng quát | Phương trình
Cây lấy **CO₂** từ không khí và **nước** từ rễ, dùng năng lượng ánh sáng để tạo **glucose** và thải **oxy**.

$$6\,CO_2 + 6\,H_2O \xrightarrow{\text{ánh sáng}} C_6H_{12}O_6 + 6\,O_2$$

```scene
direction: right
nodes:
  sun: { shape: sphere, label: Ánh sáng, color: yellow, size: l }
  co2: { shape: sphere, label: CO₂, color: gray, size: s }
  water: { shape: sphere, label: H₂O, color: blue, size: s }
  leaf: { shape: plate, label: Lục lạp, icon: leaf, color: green, size: l }
  glucose: { shape: box, label: Glucose, sub: C₆H₁₂O₆, color: sand }
  o2: { shape: sphere, label: O₂, color: teal, size: s }
links: [sun-leaf, co2-leaf, water-leaf, leaf-glucose, leaf-o2]
flows:
  - { path: sun>leaf, kind: event, count: 3 }
  - co2>leaf
  - water>leaf
```

???
Hỏi khán giả: "khối lượng của cây đến từ đâu?" trước khi bấm sang bước sau.

# Hai giai đoạn

## Pha sáng: tách nước | Pha sáng
Trong màng **thylakoid**, ánh sáng kích thích diệp lục. Nước bị tách, giải phóng **O₂**, đồng thời tạo **ATP** và **NADPH**.

```scene
zones:
  thylakoid: { label: Thylakoid, color: "#2f5a35" }
nodes:
  leaf: { label: Diệp lục, sub: hấp thụ đỏ & lam, zone: thylakoid }
  water: { zone: thylakoid }
  o2: { zone: thylakoid }
  atp: { shape: cylinder, label: ATP + NADPH, icon: battery-charging, color: orange, zone: thylakoid }
remove: [leaf-glucose]
links: [leaf-atp]
flows:
  - { path: sun>leaf, kind: event, count: 3 }
  - { path: water>leaf>o2, kind: data, label: "2H₂O → O₂" }
  - { path: leaf>atp, count: 2 }
focus: [sun, leaf, water, o2, atp]
```

> [!info] Lá xanh vì diệp lục **phản xạ** ánh sáng xanh lục, chứ không hấp thụ nó.

## Pha tối: chu trình Calvin | Calvin
Trong **chất nền stroma**, năng lượng từ ATP và NADPH được dùng để gắn CO₂ vào phân tử hữu cơ và tạo ra đường.

```scene
zones:
  stroma: { label: Stroma, color: "#4a3f24" }
nodes:
  calvin: { shape: cone, label: Chu trình Calvin, icon: rotate-cw, color: yellow, zone: stroma }
  co2: { zone: stroma }
  glucose: { zone: stroma }
links: [atp-calvin, co2-calvin, calvin-glucose]
flows:
  - { path: atp>calvin, count: 2, label: năng lượng }
  - { path: co2>calvin>glucose, kind: data, count: 3 }
focus: [atp, calvin, co2, glucose]
```

$$\text{3 CO}_2 \;\rightarrow\; \text{1 G3P} \quad(\text{tốn } 9\,\text{ATP},\ 6\,\text{NADPH})$$

## Bức tranh đầy đủ | Tổng kết
Hai pha nối với nhau qua ATP và NADPH. Pha sáng **cung cấp năng lượng**, pha tối **xây dựng phân tử**.

```scene
flows:
  - { path: sun>leaf>atp>calvin>glucose, count: 3 }
  - { path: water>leaf>o2, kind: data }
  - co2>calvin
```

```metrics
hiệu suất: 3 %
O₂ mỗi năm: 300 tỉ tấn
```
