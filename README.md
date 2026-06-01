# ロジポケ配車Agent

物流配車管理 + AI電話受付のプロトタイプ UI です。
静的 HTML / CSS / JavaScript のみで構成されており、GitHub Pages でそのまま公開できます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 配車管理画面（メイン）|
| `ai-phone-reception.html` | AI 電話受付画面 |

両ページは `localStorage`（キー: `logipoke_ai_intake_queue`）経由でデータを連携しています（AI 電話受付で取り込んだ案件が配車管理側の「未処理 / 未割当」に自動反映）。

### アセット構成（`index.html` の物理分割）

肥大化（旧 41,605 行 / 2.0MB）を避けるため、`index.html` にインラインだった CSS / JS を
**ビルド不要のまま**外部ファイルへ物理分割しています（`<link>` / `<script src>` で読み込み。
**読み込み順・挙動は分割前と完全に同一**で、抽出は無損失であることを検証済み）。

| ディレクトリ | 内容 |
| --- | --- |
| `assets/css/01-base.css` … `07-settings.css` | 旧 `<style>` ブロック（7ファイル） |
| `assets/js/01-customer-master.js` … `15-ai-intake-bridge.js` | 旧 `<script>` ブロック（15ファイル） |

- `assets/js/02-dispatch-core.js` が配車コア（データ＋ロジック）の本体で最大。
- `assets/js/01-customer-master.js` に取引先 / 協力会社などのマスタ literal を含む。
- Chart.js / html2canvas / jsPDF は従来どおり CDN から読み込み。
- **配色はデザイントークン化**: 色は `assets/css/01-base.css` の `:root`（CSS カスタム
  プロパティ）に集約。配色変更は原則このトークン定義のみ修正すれば全体に反映される。
  - 現状 CSS は token 化済み。HTML インライン `style` / JS 生成スタイルは未対応（後続）。
  - JS の `canvas` / Chart.js の色は `var()` 不可のため token 化対象外。

> 注: これは「巨大 1 ファイルを**レビュー可能にする**」ための機械的分割です。
> ファイル内の「データとロジックの分離」「`assets/logipoke-data-model.js` への接続」は別タスク（下記）。

## データモデル / アーキテクチャ

> **⚠ 実装の実態（重要）**
> 7 層データモデルと SSoT は **設計・スタンドアロンのライブラリとしては存在しますが、
> 現行プロトタイプ本体（`index.html` / `ai-phone-reception.html`）にはまだ接続されていません。**
> 過去に接続を試みたコミットは revert 済みで、本体は今もインライン literal と
> 旧 `localStorage` キーで動作しています。以下の 7 層モデル関連ファイルは
> **未接続の構想（設計・将来用）** として扱ってください。

理想形として 7 層データモデル（マスタ / 受付 / 案件 / 運行 / 法令 / 運賃・請求 / 横断）を設計しており、
その単一情報源（SSoT）候補が `assets/logipoke-data-model.js`（バックエンド不要のフロント実装）です。

### 未接続の構想（設計・ライブラリ・将来用）

| ファイル | 役割 | 接続状況 |
| --- | --- | --- |
| `assets/logipoke-data-model.js` | 7層 正規化データモデル本体（`window.LogipokeDB` / Node 両対応） | ⛔ 本体 UI からは未参照 |
| `docs/ideal-data-model.md` | データモデル設計書（7層 + 値オブジェクト） | 設計のみ |
| `docs/operation-layer-deep-dive.md` | 運行層 Trip/Leg/Stop/Assignment の深掘り | 設計のみ |
| `db/schema.sql` | 将来のバックエンド用 PostgreSQL DDL（34テーブル） | ⛔ 未使用（バックエンド未実装） |
| `migration/verify_model.mjs` | 上記ライブラリ**単体**の検証（`node migration/verify_model.mjs`） | ✅ ライブラリのみ検証可 |

### 現行プロトタイプ本体の実態

- **マスタ層**: `index.html` は `clientMasterData` / `partnerMasterData` / `TEAM_MEMBERS` /
  `TEIKI_SAMPLES` など **インライン literal を直接使用**。SSoT(`LogipokeDB`)からの derive には
  **未移行**（新デザイン＋SSoT 接続を入れたコミットは revert 済み）。
- **受付層**: AI 電話受付 ↔ 配車本体の連携は **旧キー `logipoke_ai_intake_queue`**（生 JSON キュー）で実装。
  設計上の正規化キー `logipoke_db_receptions_v1` / `Reception(+AiExtraction)` への構造化は**未接続**。
- **その他**（ドライバー / 車両 / 案件 / 運行）も本体は独自の literal / state で動作。

### 検証スクリプトについて

```bash
node migration/verify_model.mjs
```

このスクリプトが検証するのは **`assets/logipoke-data-model.js` ライブラリ単体**（値オブジェクト構造化 /
受付ブリッジの round-trip / 中継運行のタイムライン復元）です。
**① マスタ層の lossless 検証は、本体 `index.html` が SSoT に未接続のため SKIP されます。**
表示される `PASS` は「ライブラリが正しい」ことを示すもので、「`index.html` が移行済み」を意味しません。

### 今後（移行の方向性）

現行 UI を壊さない「ストラングラー方式」での段階移行を想定しています（いずれも**未着手 / 一部 revert 済み**）。

1. `index.html` に `assets/logipoke-data-model.js` を読み込み、マスタ literal を `*_Seed` 化して
   `LogipokeDB` からの derive に置換（`verify_model.mjs` の ① が緑になることを移行完了の判定に使う）。
2. 受付キューを `logipoke_ai_intake_queue` → 正規化 `Reception` ストアへ移行。
3. 運行層を `Trip>Leg>Stop+Assignment` へ集約。

## ローカルで動かす

リポジトリを clone してブラウザで `index.html` を開くだけで動作します。
ただし `localStorage` 連携を試す場合は、両ファイルを同一オリジンで配信する必要があるため、簡易サーバ経由での起動を推奨します。

```bash
# Python 3 が入っていれば
python3 -m http.server 8000
# → http://localhost:8000/ にアクセス
```

## GitHub Pages で公開する

1. このリポジトリを GitHub に push します。
2. リポジトリの **Settings → Pages** を開きます。
3. **Source** を `Deploy from a branch` にし、ブランチを `main`(または公開したいブランチ)、フォルダを `/ (root)` に設定して保存します。
4. 数十秒待つと `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

`.nojekyll` を含めているため、Jekyll による処理は行われず、ファイルがそのまま配信されます。

## ライセンス

社内検証用のプロトタイプです。
