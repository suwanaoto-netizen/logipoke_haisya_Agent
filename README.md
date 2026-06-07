# ロジポケ配車Agent

物流配車管理 + AI電話受付のプロトタイプ UI です。
静的 HTML / CSS / JavaScript のみで構成されており、GitHub Pages でそのまま公開できます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 配車管理画面（メイン）|
| `ai-phone-reception.html` | AI 電話受付画面 |
| `review.html` | レビュー入口（各画面・増車モック・設計ドキュメントへのリンク集）|

両ページは `localStorage` 経由でデータを連携しています（AI 電話受付で取り込んだ案件が配車管理側の「未処理 / 未割当」に自動反映）。

## データモデル / アーキテクチャ

理想の 7 層データモデル（マスタ / 受付 / 案件 / 運行 / 法令 / 運賃・請求 / 横断）を採用しています。
設計の単一情報源（SSoT）は `assets/logipoke-data-model.js`（バックエンド不要のフロント実装）です。

| ファイル | 役割 |
| --- | --- |
| `assets/logipoke-data-model.js` | 7層 正規化データモデル本体（ブラウザ `window.LogipokeDB` / Node 両対応） |
| `docs/ideal-data-model.md` | データモデル設計書（7層 + 値オブジェクト） |
| `docs/operation-layer-deep-dive.md` | 運行層 Trip/Leg/Stop/Assignment の深掘り |
| `db/schema.sql` | 将来のバックエンド用 PostgreSQL DDL（in-browser 版と参照規約を一致） |
| `migration/verify_model.mjs` | モデルの検証（`node migration/verify_model.mjs`） |

### 移行状況（プロトタイプ本体）

「ストラングラー方式」で段階移行を進めています。**設計資産（理想モデル / DDL / 検証）** と、
**プロトタイプ本体（`index.html`）への接続状況** を分けて記載します（両者は別物で、本体は長く
SSoT 未接続のままでした）。

#### 設計資産（`assets/logipoke-data-model.js` + `db/schema.sql` + `migration/`）
- ✅ 7層モデルの in-browser 実装（`window.LogipokeDB`）と PostgreSQL DDL を整備。
- ✅ マスタ層 / 受付層 / 中継運行の **lossless 往復**を `verify_model.mjs`（Node）で検証済み
  （`toClientMaster` / `toBasesArray` 等の adapter が旧 literal と完全一致、受付の値構造化
  Location / Cargo / TimeWindow と round-trip）。

#### プロトタイプ本体（`index.html`）への接続状況
- ✅ **拠点 `bases`**: 本体が `window.LogipokeDB` を読み込み、`seedMasters → toBasesArray` で
  **derive** するよう変更（"縦串" 第1号）。読み込み失敗時は seed にフォールバックするため、
  オフライン / 厳格 CSP でも壊れません。
- ✅ **車両 / ドライバーの ID 互換**: `vehicles[]` に `legacyIds[]`（`V1245` / `1245` / `車両1245`
  / 紐づくドライバー `D-id`）を付与し、**あらゆる旧IDを 1 台へ解決する単一窓口
  `resolveVehicleRef()`** を追加。`vehicleMasterData` には正規車両への `_canonicalVehicleId`
  クロスリンクを後付け（非破壊）。
- ✅ **運行層SSoT 取込＋派生（課題C6・第1段）**: 旧 `case.legs[]`（単一/中継）を
  `LogipokeDB.ingestCaseLegs` で **Trip>Leg>Stop+Assignment へ取込み**、SSoT から
  ガント／DnD盤／案件タイムラインを **派生**（`toScheduleBlocks` / `toDndBoard` /
  `toCaseTimeline`）する純ロジックを整備。中継案件 `20240524104` でロスレス往復・
  引き継ぎ連続性（I9）・sequence_no 一意（I4）・区間連鎖を `verify_operation.mjs` で検証済み。
  本体UIは未変更（描画系の接続は第2段）。
- ✅ **運行層SSoT 描画ブリッジ（課題C6・第2段）**: 本体に `deriveRelayLegsView()` と
  フラグ `window.__useOperationSSoT`（既定 **OFF**）を追加。ONにすると DnD盤の**中継行（読取専用）**を
  `ingestCaseLegs → toCaseTimeline` 経由で再構成して描画する（書込先は引き続き中継編集UIの `c.legs`、
  差し替えるのは読取専用ビューのみ。派生失敗時は `c.legs` にフォールバックし描画を壊さない）。
  フラグON時も従来描画と**バーが1:1一致**することを `verify_operation.mjs` の「描画切替パリティ」で保証済み。
  既定OFFのため通常表示は無変更で、有効化は `window.__useOperationSSoT = true` のみ。
- 🔜 **本体ではまだ未接続（順次対応）**: 他マスタ（取引先 / 協力会社 / ユーザー / 定期便）、
  受付（本体は今も旧 `logipoke_ai_intake_queue` を使用。`logipoke_db_receptions_v1` への切替は未）、
  案件（`unprocessed` / `processing` / `processed` の4分割）。運行層は中継行の読取ビューをSSoT派生へ
  切替可能にしたが、ガント本体（`renderSchedule`）・DnDの通常行・案件詳細の描画は引き続き旧構造を参照。
  `vehicleMasterData` は固有データを持つ独立レジストリのため、物理統合はデータ判断を要します。

```bash
# モデルの自動検証（adapter の lossless / 値構造化 / 受付ブリッジ / 中継運行）
node migration/verify_model.mjs
# 運行層SSoT 取込＋派生（課題C6・第1段：中継案件の往復・不変条件）
node migration/verify_operation.mjs
```

## ローカルで動かす

リポジトリを clone してブラウザで `index.html` を開くだけで動作します。
ただし `localStorage` 連携を試す場合は、両ファイルを同一オリジンで配信する必要があるため、簡易サーバ経由での起動を推奨します。

```bash
# Python 3 が入っていれば
python3 -m http.server 8000
# → http://localhost:8000/ にアクセス
```

## GitHub Pages で公開する

公開後の入口:

- `/` … 配車管理（メイン, `index.html`）
- **`/review.html` … レビュー入口**（各画面・増車UIモック・設計ドキュメントへのリンク集）

### A. マージ後に Actions で自動公開（推奨・本番）

`.github/workflows/pages.yml` を同梱。**`main` への push（PRマージ）で自動デプロイ**されます。初回のみ:

1. **Settings → Pages** で **Source = `GitHub Actions`** に設定。
2. PR をマージ（or Actions タブから `Deploy to GitHub Pages` を手動実行）。
3. 数分で `https://<ユーザー名>.github.io/<リポジトリ名>/` に公開。

> `github-pages` 環境は既定で **デフォルトブランチ(main)のみ**デプロイ許可のため、
> feature ブランチからの自動デプロイはブロックされます（これは仕様です）。

### B. マージ前に feature ブランチをプレビューしたい場合

次のいずれか:

- **classic 方式**: Settings → Pages → Source = `Deploy from a branch` → ブランチ
  `claude/gallant-gauss-UsC5y`・フォルダ `/ (root)`。環境制限を受けず即時公開。
- または Settings → Environments → `github-pages` → Deployment branches に当該ブランチを追加後、
  Actions タブから手動実行。

`.nojekyll` を同梱しているため Jekyll 処理は行われず、ファイルがそのまま配信されます。

## ライセンス

社内検証用のプロトタイプです。
