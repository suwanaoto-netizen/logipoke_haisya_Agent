# 運行層 深掘り設計 ― Trip / Leg / Stop / Assignment

> 本書は [`docs/ideal-data-model.md`](./ideal-data-model.md) の **④ 運行層** を深掘りした設計書。
> DDLは [`db/schema.sql`](../db/schema.sql)、移行は [`migration/transform_prototype.mjs`](../migration/transform_prototype.mjs)。
> 記載のSQL・制約・ビューは PostgreSQL 16 で実行検証済み（中継案件 `20240524104` を実データで再現）。

---

## 0. なぜ運行層が「単一情報源（SSoT）」なのか

現行プロトタイプは「いつ・誰が・どの車で・どの荷を運ぶか」を **4箇所に重複**して持っている。

| 現行の持ち方 | 役割 | 問題 |
| --- | --- | --- |
| `scheduleData.planning/confirmed[].blocks[]` | 配車計画ガントの行とバー | 案件情報(client/from/to/goods)をバーに複製 |
| `dndDrivers[].preset` | ドラッグ&ドロップ盤 | ガントとは別構造。`_DND_INIT_DRIVERS` で再生成 |
| `assignments[]`（レイヤー2） | 運行レコード | `_scheduleRowToAssignments()` でガントから変換 |
| `case.legs[]`（中継）/ ジョブ generator | 多段運行 | `relay/single/multi` と `sequenceNo/role/handoff` の2系統が併存 |

→ **同じ事実が4つの表現を持ち、相互変換が必要**（課題C6）。どれが「真」かが曖昧で、片方だけ更新するとズレる。

### 理想形：1つの真実 + 派生ビュー

```
                       ┌──────────────────────────────────────┐
   ★唯一の書込先 ──▶  │  Trip ─< Leg ─< Stop      Assignment    │  ← ここだけが真実
                       └───────────────┬──────────────────────┘
                       読取専用に派生   │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  v_schedule_block               v_dnd_board                  v_case_timeline
 (配車計画ガント)               (DnDボード)                   (案件タイムライン)
```

ガント・DnD盤・案件タイムラインは **SQL VIEW（読取専用の射影）** にする。
書き込みは Trip/Leg/Stop/Assignment にのみ行う。これで三重管理が消える。

---

## 1. 4エンティティの責務

| エンティティ | 1行が表すもの | 主キーに対する粒度 | 旧構造との対応 |
| --- | --- | --- | --- |
| **Trip**（運行） | 1台が担う「仕事のまとまり」。複数区間・複数日にまたがれる | tab × 基準日 × ドライバー/車両系列 | `scheduleData` の1行 / `jobId` |
| **Leg**（区間） | 1ドライバー×1車両が**連続して**動く単位 | Trip内で `sequence_no` 連番 | `case.legs[]` / `schedule blocks` |
| **Stop**（立寄地） | 区間内の発地・着地・中継地・休憩地 | Leg内で `sequence_no` 連番 | `from`/`to`/`relayFrom`/`relayTo` |
| **Assignment**（割当） | 「どの案件の荷を、どの区間で運ぶか」の対応 | Order × Leg の多対多 | `assignments[]` |

### 設計上の要点

- **Trip ≠ 案件**。1運行が複数案件を運ぶ（相積み）こともあれば、1案件が複数運行に分かれる（中継）こともある。両者は `Assignment` で多対多に結ぶ。
- **Leg がドライバー/車両の割当単位**。中継は「Tripの中でLegごとにドライバーが替わる」と表現する。`case.vehicleMode:'relay'` のような区分フラグは `Trip.shape` に集約しつつ、本質は「Legが複数あり担当が違う」こと。
- **Stop は経路の節点**。多地点配送（旧 `多地点配送`）は1 Legに複数 Stop で表す。
- 時刻は `start_at` / `end_at` を **TIMESTAMPTZ（日付込み）** で持つので、日跨ぎ運行が自然に表現でき、`'05/25 AM'` のような文字列パースが不要（課題C5）。

---

## 2. 不変条件（Invariants）と強制方法

| # | 不変条件 | 強制レイヤー | 実装 |
| --- | --- | --- | --- |
| I1 | 同一ドライバーは同時刻に2区間を持てない | **DB** | `EXCLUDE USING gist (driver_id WITH =, tstzrange(start_at,end_at) WITH &&)` |
| I2 | 同一車両は同時刻に2区間を持てない | **DB** | 同上（vehicle_id） |
| I3 | 区間は `end_at > start_at` | **DB** | `CHECK (end_at > start_at)` |
| I4 | Trip内の `sequence_no` は一意 | **DB** | `UNIQUE (trip_id, sequence_no)` |
| I5 | 案件×区間の割当は重複しない | **DB** | `UNIQUE (order_id, leg_id)` |
| I6 | 積載重量 ≦ 車両最大積載 | **App** | `cargo_weight_kg` vs `vehicle_type.max_load_kg`（相積みは合算） |
| I7 | ドライバー免許 ≧ 車格要件 | **App** | `driver.licenses` vs `vehicle_type.ton_class` |
| I8 | 改善基準告示の適合 | **App→記録** | 計算後 `compliance_check` にスナップショット |
| I9 | 中継の引き継ぎ地点が連続（前Legの着 = 次Legの発） | **App** | `leg[n].最終stop.location == leg[n+1].先頭stop.location` |

> **I1/I2 は DB が拒否する**ことを実証済み（重複INSERTで `conflicting key value violates exclusion constraint`）。
> これは旧 `validateAssignment()` の `_overlaps()` 判定を、アプリ任せにせずDB制約として保証したもの。
> 取消した区間は `leg.active=false` にすると EXCLUDE 対象外になる（部分インデックス `WHERE (active)`）。

---

## 3. 運行パターン別の表現（worked examples）

以下はすべて同じ4エンティティだけで表現できる。`Trip.shape` は分類ラベルであり、構造は共通。

### 3.1 単一便（single）

最も単純。Trip 1 / Leg 1 / Stop 2（pickup→dropoff）/ Assignment 1。

```
Trip(shape=single)
└─ Leg#1  driver=D, vehicle=V, role=pickup_delivery, 09:00–11:00
   ├─ Stop#1 pickup   川口市
   └─ Stop#2 dropoff  横浜市
   └─ Assignment → Order(20240524001)
```

### 3.2 中継便（relay）― 旧 `case.legs[]` / `vehicleMode:'relay'`

長距離を複数ドライバーでリレー。**Trip 1 に Leg 複数（担当が替わる）**。引き継ぎは `handoff_type='driver_swap'` と `next_leg_id` で連結。
実データ `20240524104`（品川→名古屋→大阪）の再現：

```
Trip(shape=relay, multi_reasons=['改善基準対策','拘束時間の分散'])
├─ Leg#1 driver=松本十郎 vehicle=車両2580 06:00–10:30
│   ├─ Stop#1 pickup        東京都品川区
│   └─ Stop#2 relay_handoff 愛知県名古屋市
│   ├─ handoff_type=driver_swap, handoff_location=名古屋, next_leg_id=Leg#2
│   └─ Assignment → Order(20240524104)
└─ Leg#2 driver=山田一郎  vehicle=車両1245 11:00–14:30
    ├─ Stop#1 relay_handoff 愛知県名古屋市
    └─ Stop#2 dropoff       大阪府大阪市
    └─ Assignment → Order(20240524104)   ← 同一案件を両Legに割当
```

`v_case_timeline` での復元結果（検証済み）:

| order_no | seq | role | driver | vehicle | handoff |
| --- | --- | --- | --- | --- | --- |
| 20240524104 | 1 | relay | 松本 十郎 | 車両2580 | driver_swap |
| 20240524104 | 2 | relay | 山田 一郎 | 車両1245 | （最終Leg） |

### 3.3 相積み（co_load）― 1区間に複数案件

1台で複数荷主の荷を同時輸送。**Leg 1 に Assignment 複数**。`loaded_weight_kg` で按分し、合算が `max_load_kg` 以内か検査（I6）。

```
Trip(shape=co_load)
└─ Leg#1 driver=D vehicle=V(4t/4000kg)
   ├─ Stop#1 pickup  A社倉庫
   ├─ Stop#2 pickup  B社倉庫
   ├─ Stop#3 dropoff X店
   ├─ Stop#4 dropoff Y店
   ├─ Assignment → OrderA (loaded_weight_kg=1500)
   └─ Assignment → OrderB (loaded_weight_kg=2000)   # 計3500 ≤ 4000 OK
```

### 3.4 前日積込＋翌日配送 / 長距離3日便（multiday）― 旧ジョブ generator

夜間に積込み、翌朝以降に配送。**Leg を日付跨ぎで複数**、接続は `handoff_type='overnight_park'`。
`start_at`/`end_at` が別日付なので `v_case_timeline.is_multiday=true` が自動判定される（旧 `isMultiDay`）。

```
Trip(shape=multiday)
├─ Leg#1 role=preload   05-26 18:00–18:30  Stop: 出発地デポ  handoff=overnight_park
├─ Leg#2 role=transport 05-27 04:00–20:00  handoff=overnight_park（中継ターミナル泊）
└─ Leg#3 role=delivery  05-28 07:00–10:00  Stop: 配達先
```

### 3.5 戻り回送（return）― 旧 `relatedReturnId`

実車運行と空車回送をペアにする。`Trip.related_return_trip_id` で相互参照（連鎖参照のため FK は `DEFERRABLE`）。

```
Trip#A(shape=single)  ──related_return_trip_id──▶  Trip#B(shape=return, role=transport 空車)
```

---

## 4. 状態と進捗

### Trip 状態機械（旧 `_pickStatus` の 運行中/待機/アラート/休車 を整理）

```
planned ──確定──▶ confirmed ──出発──▶ in_progress ──完了──▶ completed
   └──────────────── cancelled ────────────────┘
```

| 旧表現 | 理想表現 |
| --- | --- |
| 待機 | `trip.status='planned'`（区間あり・未出発） |
| 運行中 | `trip.status='in_progress'` + `leg_tracking` |
| アラート（遅延の恐れ） | `trip.risk_flag=true`（状態とは独立したフラグ） |
| 休車 | `vehicle.status='maintenance'`（その日Tripを持たない） |

### 進捗トラッキング（旧 `progress/eta/remain/donekm` を分離）

運行中の実績は可変・高頻度更新なので、`Trip`/`Leg` 本体と分けて `leg_tracking`（1区間1行）に持つ。

```sql
-- 例：運行中Legの進捗
SELECT l.id, lt.progress_pct, lt.driven_km, lt.remaining_km, lt.eta
FROM leg l JOIN leg_tracking lt ON lt.leg_id = l.id
WHERE EXISTS (SELECT 1 FROM trip t WHERE t.id=l.trip_id AND t.status='in_progress');
```

---

## 5. 派生ビューの定義（SSoT → 旧3画面）

`db/schema.sql` 末尾で定義済み。要点のみ抜粋。

- **`v_schedule_block`**（配車計画ガント）: 1 Leg = 1ブロック。`from_city`/`to_city` は Leg内 Stop の最初/最後、`clients` は Assignment→Order→Company を `string_agg`（相積みは複数社連結）。
- **`v_dnd_board`**（DnD盤）: `service_date × driver × vehicle` で `json_agg` し、Legの配列を返す。
- **`v_case_timeline`**（案件タイムライン）: Order を起点に Assignment→Leg を並べ、`is_multiday`・`handoff_type` を付与。

```sql
-- ガント1行（ドライバー単位）への集約はビューを更にGROUP BYするだけ
SELECT driver_id, driver_name, service_date,
       json_agg(json_build_object('from',from_city,'to',to_city,'start',start_at,'end',end_at,'client',clients)
                ORDER BY start_at) AS blocks
FROM v_schedule_block
WHERE tab='planning' AND service_date='2026-05-27'
GROUP BY driver_id, driver_name, service_date;
```

---

## 6. クロス配車・拠点（旧 Phase 1a 資産の昇格）

現行コードの良い概念をそのまま運行層に持ち込む。

- `leg.effective_base_id` … 当日その区間がどの拠点運用か（旧 `assignment.effectiveBaseId`）。
- `leg.cross_base` … ドライバーの所属拠点と `effective_base_id` が異なる等のクロス配車（旧 `isCrossBaseAssignment()` の結果をブール保存）。判定ロジックはアプリ、結果はDBに保存して検索・KPI集計を高速化。
- 協力会社ドライバーは `driver.is_partner=true` / `home_base_id=NULL`。クロス配車判定の対象外（旧 論点3）。

```sql
-- クロス配車になっている区間の抽出（KPI/アラート用）
SELECT t.service_date, d.name, l.effective_base_id
FROM leg l JOIN driver d ON d.id=l.driver_id JOIN trip t ON t.id=l.trip_id
WHERE l.cross_base AND NOT d.is_partner;
```

---

## 7. 典型クエリ（運用で多用するもの）

```sql
-- (1) あるドライバーの当日運行（重複なしはI1で保証済み）
SELECT * FROM leg WHERE driver_id='drv_001'
  AND start_at::date='2026-05-27' ORDER BY start_at;

-- (2) 未割当の案件（運行層に割当がない Order）
SELECT o.* FROM transport_order o
WHERE o.status='unassigned'
  AND NOT EXISTS (SELECT 1 FROM assignment a WHERE a.order_id=o.id);

-- (3) 改善基準で要確認/違反の区間
SELECT l.id, c.overall, array_agg(ci.rule) FILTER (WHERE NOT ci.ok) AS ng_rules
FROM leg l
JOIN compliance_check c ON c.leg_id=l.id
JOIN compliance_item ci ON ci.check_id=c.id
WHERE c.overall<>'ok'
GROUP BY l.id, c.overall;

-- (4) 中継便の積み替え地点の整合チェック（I9。発着不連続を検出）
SELECT l1.id AS leg, s1.location_id AS handoff_out, s2.location_id AS next_in
FROM leg l1
JOIN leg l2 ON l2.id = l1.next_leg_id
JOIN stop s1 ON s1.leg_id=l1.id AND s1.kind='relay_handoff'
JOIN stop s2 ON s2.leg_id=l2.id AND s2.sequence_no=1
WHERE s1.location_id <> s2.location_id;
```

---

## 8. 移行マッピング（運行層のみ。全体は ideal-data-model §9）

| 現行 | 変換 | 先 |
| --- | --- | --- |
| `scheduleData[tab][i]`（行） | 行→Trip、`blocks[]`→Leg群 | `trip` + `leg` |
| `block.{client,from,to,goods}` | from/to→Stop、client/goods→Order経由 | `stop` / `assignment`→`transport_order` |
| `case.legs[]`（relay） | 各leg→Leg、relayFrom/To→Stop、引き継ぎ→handoff | `leg` + `stop` |
| ジョブgenerator `role/handoff/sequenceNo` | そのまま昇格 | `leg.role` / `leg.handoff_type` / `leg.sequence_no` |
| `assignments[].effectiveBaseId/ownerId/...` | 区間/運行へ再配置 | `leg.effective_base_id` / `trip.owner_id` |
| `driverOwners` / `driverLocks` | 正規化 | `ownership` / `edit_lock` |

> 変換の実装は [`migration/transform_prototype.mjs`](../migration/transform_prototype.mjs) の
> `emitRelayTrip()` を参照（中継案件 → Trip/Leg/Stop/Assignment/Compliance を生成し、検証済み）。
