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
  フラグ `window.__useOperationSSoT`（既定 **OFF**）を追加。ONにすると `c.legs` 系の**読取専用ビュー**を
  `ingestCaseLegs → toCaseTimeline` 経由で再構成して描画する。現在の切替対象は
  **(1) DnD盤の中継行（束ねモード）/ (2) DnD盤の中継区間注入（分散モード）/ (3) 案件詳細の複数台サマリー**
  の3つ。構造（誰/どこ/いつ/順序/引継ぎ）は SSoT 由来、表示用の付帯情報（車格ラベル/積載/法令バッジ）は
  順序対応で原データから引継ぐ。書込先は引き続き中継編集UIの `c.legs` で、差し替えるのは読取専用ビューのみ。
  派生失敗時は `c.legs` にフォールバックして描画を壊さない。フラグON時も従来描画と**1:1一致**することを
  `verify_operation.mjs` の「描画切替パリティ」で保証済み。既定OFFのため通常表示は無変更で、有効化は
  `window.__useOperationSSoT = true` のみ。
- ✅ **運行層SSoT 取込＋ガント裏付け（課題C6・第3段）**: 配車計画ガント/DnD通常行の正準フラット層
  `assignments[]`（1ブロック=1運行）を `LogipokeDB.ingestAssignments` で **Trip>Leg>Stop+Assignment** へ
  取込み、`toAssignments` で**ロスレスに復元**（同一 tab×日×driver×vehicle を1 Tripに束ね、ブロックを Leg、
  発着を Stop に正規化）。本体に `deriveAssignmentsView(tab)` を追加し、フラグON時の
  `buildScheduleViewFromAssignments`（=ガント `__useAssignmentView` 経路）が**正規化SSoTに裏付けられた
  往復ビュー**を使うよう接続（往復失敗時は素の `assignments` に縮退）。往復の無損失性は
  `verify_operation.mjs`（計14件）で保証。これで正規化モデルが **中継案件(c.legs) と ガント(assignments)
  の両方を読取側で表現可能**になり、C6の読取側基盤がほぼ揃った。
- ✅ **運行層SSoT 書込先化＋不変条件強制（課題C6・第4段）**: `LogipokeDB.checkLegConflicts` /
  `reassignLeg` を追加し、**I1/I2（同一ドライバー/車両が同一 service_date で時間重複する区間を持てない＝
  schema.sql の EXCLUDE 制約相当）を正規化レイヤーで強制**。本体は (1) `validateAssignment` の I1/I2 判定を
  フラグON時に**SSoTへ委譲**（全書込経路の検証権威が正規化モデルに集約）、(2) `reassignDriver` /
  `reassignVehicle` をフラグON時に**SSoTへ書込→`toAssignments` でフラット層を再導出**（フラット層を
  派生に降格）。I6 積載量は車両マスタ参照のためアプリ層に残置（deep-dive §2）。失敗時はレガシーへ縮退。
  `verify_operation.mjs`（計19件）で I1/I2 検出・書込後の射影・非重複時OK を検証。
- ✅ **運行層SSoT を既定ON化（課題C6・第6段）**: `window.__useOperationSSoT` を**既定 `true`** に変更。
  jsdom（実機相当）で `index.html` を読み込み、フラグON経路を実データで検証済み——LogipokeDB ロード、
  中継読取ビュー（品川→名古屋→大阪の2区間）、`assignments` のロスレス往復（件数一致＋全件値一致）、
  `validateAssignment`(I1/I2 SSoT)、`renderSchedule`(assignmentView)/`renderDnd`/`_ssotValidateRelay` の
  **無例外実行**を確認（全8項目パス・fatal 0）。読取＝SSoT派生・書込検証＝SSoT権威が**既定で有効**。
  万一に備え、各ブリッジは失敗時レガシーへフォールバックし、`window.__useOperationSSoT=false;` で
  従来挙動へ即時復帰できる。以降の各段の「既定OFF」記述は導入時点の値で、現行の既定はON。
- ✅ **運行層SSoT 書込側の完結（課題C6・第5段）**: 残る書込経路の不変条件もSSoT権威下へ。
  (1) **中継編集**（`addRelayLeg` / `removeRelayLeg` / `updateRelayLeg` / `setRelayLegVehicle` → `c.legs`）に
  `LogipokeDB.validateRelayLegs`（I9 引き継ぎ連続性／同一ドライバーの時間重複）を接続し、編集のたびに
  SSoT検証して不整合をUI提示。(2) **D&D配車**（`dndTrackDrop` → `__notifyDndChange` → `assignments[]`）は
  追加時点で SSoT 委譲済みの `validateAssignment`（I1/I2）を通すよう接続。あわせて第4段の `reassign*` を
  **ロスレス化**（`toAssignments` 全置換をやめ、`assignments[]` の拡張フィールド
  effectiveBaseId/crossBase/ownerId/caseIds を保持したまま in-place 変更＋SSoT検証）。
  これで **reassign / D&D / 中継編集 の全書込経路で不変条件が正規化SSoTに集約**された
  （`verify_operation.mjs` 計23件）。書込面（リッチな編集レコード）は据え置き＝SSoTが「不変条件の権威」。
- 🔜 **本体ではまだ未接続（順次対応）**: 他マスタ（取引先 / 協力会社 / ユーザー / 定期便）、
  受付（旧 `logipoke_ai_intake_queue` → `logipoke_db_receptions_v1` 未切替）、案件4分割
  （`unprocessed` / `processing` / `processed`）。運行層は**読取＝SSoT派生・書込検証＝SSoT権威**まで到達。
  残るは「正規化モデルが拡張フィールドまで吸収し**唯一の物理ストア**になる」完全インバージョン（現状は
  リッチなレガシーレコードを編集面に残す折衷）と、上記マスタ/受付/案件層の接続。`vehicleMasterData` は
  固有データを持つ独立レジストリのため、物理統合はデータ判断を要します。

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
