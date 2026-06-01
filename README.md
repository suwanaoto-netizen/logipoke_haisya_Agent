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
> 7 層データモデル(SSoT)のうち、**① マスタ層は本体プロトタイプに接続済み**です
> （取引先 / 協力会社 / 拠点 / 社内ユーザー / 定期便を `LogipokeDB` から derive。
> `node migration/verify_model.mjs` の ① が緑 = lossless を検証済み）。
> **受付層 / 運行層など他層は、ライブラリとしては実装済みだが本体への接続は未了（今後）**です。
> 下表の「接続状況」を参照してください。

7 層データモデル（マスタ / 受付 / 案件 / 運行 / 法令 / 運賃・請求 / 横断）を設計し、
その単一情報源（SSoT）が `assets/logipoke-data-model.js`（バックエンド不要のフロント実装）です。

### データモデル関連ファイル

| ファイル | 役割 | 接続状況 |
| --- | --- | --- |
| `assets/logipoke-data-model.js` | 7層 正規化データモデル本体（`window.LogipokeDB` / Node 両対応） | ✅ マスタ層で本体 UI が参照 |
| `docs/ideal-data-model.md` | データモデル設計書（7層 + 値オブジェクト） | 設計 |
| `docs/operation-layer-deep-dive.md` | 運行層 Trip/Leg/Stop/Assignment の深掘り | 設計（運行層は未接続） |
| `db/schema.sql` | 将来のバックエンド用 PostgreSQL DDL（34テーブル） | ⛔ 未使用（バックエンド未実装） |
| `migration/verify_model.mjs` | データモデル + **マスタ層 SSoT 接続**の検証（`node migration/verify_model.mjs`） | ✅ ① 接続検証 + ライブラリ検証 |

### 現行プロトタイプ本体の実態

- **マスタ層 ✅ 接続済み**: 取引先 / 協力会社 / 拠点 / 社内ユーザー / 定期便は、各ファイルの
  `_*Seed`（旧 literal）を `LogipokeDB.to*()` に通して **derive**（`clientMasterData` /
  `partnerMasterData`（`assets/js/01-customer-master.js`）、`bases` / `TEIKI_SAMPLES`
  （`02-dispatch-core.js`）、`TEAM_MEMBERS`（`07-dispatch-ext-v2.js`））。
  `index.html` は consumer より前に `assets/logipoke-data-model.js` を読み込む。
  derive 結果が元 seed と完全一致（lossless）であることは `verify_model.mjs` ① で検証済み。
  万一 `LogipokeDB` 未読込時は seed へフォールバック（同一データのため挙動不変）。
- **受付層 ⏳ 未接続**: AI 電話受付 ↔ 配車本体の連携は今も **旧キー `logipoke_ai_intake_queue`**（生 JSON キュー）。
  正規化キー `logipoke_db_receptions_v1` / `Reception(+AiExtraction)` への移行は今後。
- **運行層ほか ⏳ 未接続**（ドライバー / 車両 / 案件 / 運行）は本体の独自 state で動作。

### 検証スクリプトについて

```bash
node migration/verify_model.mjs
```

このスクリプトは以下を検証します（現状 **PASS=14 / FAIL=0**）:

- **① マスタ層 SSoT 接続（lossless）**: 本体が使う各 `_*Seed` を model に通して旧形へ復元した結果が
  元 seed と完全一致すること（= UI が受け取るデータが移行前と同一であること）。
- ② 受付層の値オブジェクト構造化 / ②b 受付ブリッジの round-trip / ④ 中継運行タイムライン（ライブラリ）。

マスタ層は接続済みのため ① は緑です。万一 `_*Seed` が無い（移行が revert された）場合は ① のみ SKIP します。

### 今後（移行の方向性）

現行 UI を壊さない「ストラングラー方式」で段階移行中です。

1. ✅ **マスタ層**: `_*Seed` → `LogipokeDB.to*()` で derive 済み（`verify_model.mjs` の ① が緑）。
2. ⏳ 受付キューを `logipoke_ai_intake_queue` → 正規化 `Reception` ストアへ移行。
3. ⏳ 運行層を `Trip>Leg>Stop+Assignment` へ集約。

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
