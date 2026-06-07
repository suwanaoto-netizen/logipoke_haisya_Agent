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
- 🔜 **本体ではまだ未接続（順次対応）**: 他マスタ（取引先 / 協力会社 / ユーザー / 定期便）、
  受付（本体は今も旧 `logipoke_ai_intake_queue` を使用。`logipoke_db_receptions_v1` への切替は未）、
  案件（`unprocessed` / `processing` / `processed` の4分割）、運行（`scheduleData` / `dndDrivers`
  / `assignments`）は本体側が literal のまま。`vehicleMasterData` は固有データを持つ独立レジストリ
  のため、物理統合はデータ判断を要します（次段階）。運行層は `Trip>Leg>Stop+Assignment` へ集約予定。

```bash
# モデルの自動検証（adapter の lossless / 値構造化 / 受付ブリッジ / 中継運行）
node migration/verify_model.mjs
```

## ローカルで動かす

リポジトリを clone してブラウザで `index.html` を開くだけで動作します。
ただし `localStorage` 連携を試す場合は、両ファイルを同一オリジンで配信する必要があるため、簡易サーバ経由での起動を推奨します。

```bash
# Python 3 が入っていれば
python3 -m http.server 8000
# → http://localhost:8000/ にアクセス
```

## GitHub Pages で公開する（Actions 自動デプロイ）

`.github/workflows/pages.yml` を同梱しており、対象ブランチ（`main` / `claude/gallant-gauss-UsC5y`）への
push で自動的に GitHub Pages へデプロイされます。初回のみ以下の設定が必要です。

1. リポジトリの **Settings → Pages** を開きます。
2. **Source** を **`GitHub Actions`** に設定します。
3. 対象ブランチへ push（または Actions タブから `Deploy to GitHub Pages` を手動実行）。
4. 数十秒〜数分で `https://<ユーザー名>.github.io/<リポジトリ名>/` に公開されます。

公開後の入口:

- `/` … 配車管理（メイン, `index.html`）
- **`/review.html` … レビュー入口**（各画面・増車UIモック・設計ドキュメントへのリンク集）

> `.nojekyll` を含めているため Jekyll 処理は行われず、ファイルがそのまま配信されます。
> 従来の「Deploy from a branch（`/ (root)`）」方式でも公開できます（その場合 Actions は不要）。

## ライセンス

社内検証用のプロトタイプです。
