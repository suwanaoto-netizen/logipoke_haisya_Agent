# db ― 理想データモデルの DDL と移行

ロジポケ配車Agent の理想データ構造（[`docs/ideal-data-model.md`](../docs/ideal-data-model.md)）を
実装した PostgreSQL スキーマと、現行プロトタイプからの移行スクリプト。

> バックエンドは未確定のため、最も標準的で制約表現力の高い **PostgreSQL 16** を採用。
> 他RDBへの移植メモは `schema.sql` 末尾を参照。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `schema.sql` | DDL本体（型・テーブル・制約・索引・トリガ・派生ビュー）。これ単体で頭から流せる |
| `seed_from_prototype.sql` | プロトタイプ代表データの投入SQL（`transform_prototype.mjs` が自動生成） |
| `../migration/transform_prototype.mjs` | 現行 in-memory JS データ → 上記seed を生成するETL |

## 適用手順

```bash
# 1. DB作成
createdb logipoke

# 2. スキーマ適用
psql -d logipoke -v ON_ERROR_STOP=1 -f db/schema.sql

# 3. （任意）プロトタイプ代表データ投入
psql -d logipoke -v ON_ERROR_STOP=1 -f db/seed_from_prototype.sql
```

seed を再生成する場合:

```bash
node migration/transform_prototype.mjs > db/seed_from_prototype.sql
```

## 検証済みの性質（PostgreSQL 16）

- スキーマ・seed ともにエラーなく適用できる。
- **同一ドライバー/車両の時間重複INSERTを DB が拒否**（`EXCLUDE` 制約、旧 `validateAssignment` のDB保証）。
- 運行層(SSoT)から `v_schedule_block` / `v_dnd_board` / `v_case_timeline` の3ビューが復元される
  （中継案件 `20240524104` を実データで再現）。
- `goods`/`deadline`/`fare` の文字列が構造化列へ変換される。
- `invoice.profit_jpy` は `total_jpy - cost_jpy` の生成列。

## レイヤー構成（詳細は docs/ 参照）

```
① マスタ  company / base / vehicle / driver / vehicle_type / app_user / recurring_route
② 受付    reception
③ 案件    transport_order / order_event / order_requirement
④ 運行★   trip / leg / stop / assignment / leg_tracking    ← 単一情報源(SSoT)
⑤ 法令    compliance_check / compliance_item / driver_work_log
⑥ 請求    fare / fare_surcharge / invoice / invoice_line
⑦ 横断    ownership / edit_lock / audit_log / notification
```

運行層(④)の設計詳細は [`docs/operation-layer-deep-dive.md`](../docs/operation-layer-deep-dive.md)。
