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
- ✅ **マスタ層は全てSSoT派生済み（`_ssotDerive`）**: 拠点 `bases` / 取引先 `clientMasterData` /
  協力会社 `partnerMasterData` / ユーザー `TEAM_MEMBERS` / 定期便 `TEIKI_SAMPLES` に加え、
  **ドライバー `drivers` / 車両 `vehicles`** も `seedMasters → toDriversArray/toVehiclesArray` で
  derive（往復ロスレス時は LogipokeDB 由来、失敗時は seed フォールバック＝`_ssotDerive` が JSON 一致で自己検証）。
  検証は `verify_model.mjs`（計16件）、実ブラウザQAで drivers/vehicles 50/50・名前/プレート・全画面整合を確認。
  ※`vehicleMasterData` は固有データを持つ独立レジストリのため物理統合はデータ判断を要する（保留）。
- ✅ **拠点 `bases`**: 本体が `window.LogipokeDB` を読み込み、`seedMasters → toBasesArray` で
  **derive**。読み込み失敗時は seed にフォールバックするため、オフライン / 厳格 CSP でも壊れません。
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
- ✅ **正規化モデルの拡張フィールド吸収＝完全ロスレス化（課題C6・第7段／完全インバージョンの土台）**:
  `ingestAssignments`/`toAssignments` を拡張し、`assignments[]` の拡張フィールド
  （`effectiveBaseId`/`crossBase`/`ownerId`/`mainOwnerId`/`caseIds`/`isReturn`/`relatedReturnId`/監査）を
  Leg/Order の**正規化スロットへ吸収**。DnD固有の派生項目（`loadMin`/`driveMin`/`sub`/`isPreset` 等）は
  `_extra` に温存し、**元のキー集合だけを射影**して `deepStrictEqual` を満たす。同様に `c.legs`（中継）も
  `vehicleType`/`vehicleIdx`/`lawOk` 等まで吸収する `toCaseLegs` を追加。これにより
  **`toX(ingest(X)) === X`（拡張フィールド込み）** が成立し、`reassignLeg` で driver を変えても
  拡張フィールドは保持されることを `verify_operation.mjs`（計26件）で保証。jsdom（既定ON）でも
  `deriveAssignmentsView` のロスレス・ガント/DnD無例外を再確認済み。**SSoTを唯一の物理ストアにする前提
  （無損失表現）が整った**。
- ✅ **物理統合の段階適用①：永続ストア導入＋ガントのreader切替（課題C6・第8段）**:
  `LogipokeDB.createOperationStore()`（単一の永続 `LogipokeDB` を保持し、`syncFromAssignments` で
  完全ロスレス再構築、`getAssignments(tab)` でフラット層をライブ派生、`reassign` で I1/I2 検証付き書込）を
  追加。本体は **全 `assignments[]` 変更が通る `rebuildAssignmentIndex()` を単一同期点**に永続ストア
  `window.__opStore` を常時再構築し、**ガント（`buildScheduleViewFromAssignments`）の reader を永続ストア
  からのライブ派生へ切替**（無ければ都度往復→素配列へ多段フォールバック）。jsdom（既定ON）で
  起動時のストア生成・ロスレス一致・ガント無例外・**書込(reassign)後の単一同期点での追従**を目視確認、
  `verify_operation.mjs` 計30件で永続ストアの一致/再同期/書込反映を保証。
- ✅ **物理統合の段階適用②：DnDボード通常行の reader 切替（課題C6・第9段）**:
  3つ目のレガシーストア `dndAssignments`（D&Dの書込面・積荷段組フィールドを持つ）も正規化モデルへ。
  `ingestDndBlocks`/`toDndBlocks` を追加し、**1ブロック=1 Leg・start/end/from/to を正規化スロット＋
  その他（積荷段組 loadMin等／中継注入マーカー _relayLegId 等）を `_extra` 温存**で**完全ロスレス**化。
  本体は `renderDndTimeline` の通常行読取点で `applyDndBlocksViaSSoT` を呼び、live配列を
  `ingestDndBlocks→toDndBlocks` でロスレス往復して **in-place 反映**（配列 identity と「中継/増車区間の
  push 永続」semantics を保持＝表示・挙動は不変だが reader が正規化SSoTを経由）。件数不一致/失敗時は
  live配列を一切触らず縮退。jsdom（既定ON）で往復ロスレス（値不変）・`renderDnd` 無例外・再入維持を目視、
  `verify_operation.mjs` 計32件で DnDブロックの拡張フィールド込み deepStrictEqual 往復・driver/date 分離を保証。
- ✅ **物理統合の段階適用③：案件詳細・確定タブの reader 切替（課題C6・第10段）**:
  - **案件詳細**（`renderProcessingDetail`）の運行層読取＝複数台サマリーは第2段で `deriveRelayLegsView`
    によりSSoT派生済み（中継編集リストは書込面＝第5段でSSoT検証）。読取投影は既にSSoT経由。
  - **確定タブ**（`renderDndTimeline` の `dndConfirmedAssignments` 行・読取専用＝注入なし）にも
    `applyDndBlocksViaSSoT` を適用し、`ingestDndBlocks→toDndBlocks` のロスレス往復を in-place 反映。
    jsdom（既定ON）で 確定タブ切替・`renderDnd` 無例外・確定行のロスレス往復・計画タブ復帰を目視確認。
  これで運行層の主要 reader（ガント／DnD通常行／DnD確定行／中継表示／案件サマリー）が**すべてSSoT経由**に。
- ✅ **唯一ストアの権威確立：書込先一本化＋読取ファサード（課題C6・第11段）**:
  - **書込先一本化**：`reassignDriver`/`reassignVehicle` を「永続ストア `__opStore` へ書込（I1/I2判定）→
    `assignments[]` を `toAssignments` で再導出（in-place・**完全ロスレス**）」へ反転。**store が書込先（権威）**、
    `assignments[]` はその射影（`const` 参照は保持）。失敗時は in-place＋SSoT検証へ縮退。
  - **読取ファサード**：`window.OpStore`（`assignments(tab)`/`conflicts(id)`）を**単一情報源の読取API**として公開。
  - **整合不変条件**：`window.__opStoreConsistent()` が「store 由来 ≡ `assignments[]`」を常時検証。jsdom（既定ON）で
    起動時整合・store-first reassign（`via:'opstore'`・store/legacy 両反映・整合維持）・描画無例外を目視確認。
- ✅ **受付 C1 カットオーバー**: `index.html` の `drainIntakeQueue` を「正規化受付ストア
  `logipoke_db_receptions_v1` を単一の取込パイプライン」に再構成。旧 `logipoke_ai_intake_queue` は
  併読をやめ "一度きりの移行元" に降格（モデル利用可能時は旧キュー項目を正規化ストアへ移送→単一経路で取込、
  モデル未読込時のみ直接取込の安全網）。`ai-phone-reception.html` は既に正規化ストアが主経路（旧キューは
  フォールバックのみ）。実ブラウザQA（HTTP同一オリジン）で 正規化経由取込／旧キュー→移送→取込・旧キー除去・
  ストア空 を確認。
- ✅ **assignments→store 単方向化（C6 仕上げ）**: 残る直接変異 writer の汎用CRUD
  `createAssignment`/`updateAssignment`/`deleteAssignment` を **store-first 化**（store へ add/remove → 
  `assignments[]` を再導出）。これで reassign/DnD/中継 を含む**全 writer が store-first** に。
  `rebuildAssignmentIndex` の常時 back-sync（store←assignments）を**自己修復型・単方向**へ変更：
  既定 strict で「乖離が無ければ再同期しない（単方向）／乖離検出時のみ自己修復＋warn」（`window.__opStoreStrict=false`
  で従来の常時同期に戻せる）。実ブラウザQAで CRUD/reassign/DnD 実行後も **乖離 0**（=全 writer が store-first で
  back-flow 不要）・store/legacy 一致・全画面整合 true・エラー0 を確認。store が単一権威、`assignments[]` は
  その射影。万一の非 store-first 変異も自己修復＋warn で検出（データ損失なし）。
- ✅ **案件層統合 基盤（課題C7・第1段）**: 旧 4分割配列（`unprocessedCases`/`processingCases`/
  `processedCases`/`allCasesMasterData`）を `LogipokeDB.ingestCases` で**単一ストアへ統合**し、
  per-phase 配列を**完全ロスレス復元**（`toUnprocessedCases`/`toProcessingCases`/`toProcessedCases`/
  `toAllCasesMaster`）＋横断ビュー `toCaseOverview`。同一 id が複数フェーズに異なるシェイプで併存できる
  よう (phase, id) キーで保持。`verify_cases.mjs`（8件）でロスレス往復・フェーズ分離・順序保持・決定性を検証。
  **本体UIは未変更**（4配列の reader を派生へ接続するのが後続フェーズ＝段階適用・全画面QA）。
- 🔜 **残（C7 後続）**: 本体の一覧/詳細 reader（未処理/処理中/完了/総覧）を `LogipokeDB` の per-phase 派生へ
  1画面ずつ切替え、最終的に 4配列を「単一ストアの派生ビュー」に降格。`vehicleMasterData` は固有データを
  持つ独立レジストリのため、物理統合はデータ判断を要します。

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
