# ロジポケ配車Agent ― 増車判定ロジック設計

> 「**どの案件を増車（複数台編成）に回すべきか**」をAIが提案するフェーズ（= 案件カードに
> 「⊕ AI増車プラン」ボタンが出るロジック）の設計ドキュメント。
>
> 増車対応パイプライン `案件受付 → AI増車判定 → 自社車両推薦 → 協力会社推薦 → 運賃推薦 → 自動配車`
> のうち、本書は最上流の **AI増車判定** だけを対象とする（後続の推薦・配車は別書）。

---

## 1. 目的とスコープ

| 項目 | 内容 |
| --- | --- |
| 対象 | 受付済み案件に対する「増車要否・優先度」の判定と、UI（ボタン）への写像 |
| 解決したい課題 | 手配漏れ（増車見逃し）と、ボタン疲れ（過検知）の両立した抑制 |
| 非対象 | どの車両/協力会社を充てるか（推薦）・運賃計算・実配車（後続フェーズ） |
| 設計方針 | **可能性（決定的）と最適性（AI）を分離**し、可能性を優先する2段構え |

### 1.1 関連ドキュメント / 成果物

| ファイル | 内容 |
| --- | --- |
| [`docs/ideal-data-model.md`](./ideal-data-model.md) | 7層データモデル（`Cargo`/`TimeWindow`/`VehicleType`/`Order` 等の値の出所） |
| [`docs/operation-layer-deep-dive.md`](./operation-layer-deep-dive.md) | 運行層 Trip/Leg。増車の実体（1案件→複数Leg）の表現 |
| [`docs/mockups/scale-out-plan.html`](./mockups/scale-out-plan.html) | 運行スケジュール（ガント）での増車UIモック |
| [`docs/mockups/scale-out-assign.html`](./mockups/scale-out-assign.html) | 配車割当（D&D）での増車UIモック（充足カウンタ・一括配車） |

### 1.2 流用する既存実装（index.html）

本判定はゼロからではなく、既存ロジックの組み合わせで構成する。

| 既存シンボル | 場所 | 増車判定での役割 |
| --- | --- | --- |
| `estimateDistance(from, to)` | `index.html:18207` | 距離 → 所要時間（時間窓判定 H3） |
| `getVehicleParams(vehicle)` | `index.html:18236` | 車格別の積載・コスト基礎値 |
| `calcFare(caseObj)` | `index.html:18245` | 原価・粗利（採算ガード・ソフト判定 S3） |
| `AI_WEIGHTS` | `index.html:11940` | 重み付け（増車推奨度の重み源） |
| `VEHICLE_RAW_SCORES` | `index.html:11949` | 最適1台の選抜 |
| `VEHICLE_SCHEDULE` | `index.html:11974` | 空き枠（実現可能性ガード） |
| `CASE_PATTERNS` | `index.html:11874` | パターン係数（ソフト判定 S5） |
| `proposeKaizenFix(...)` | `index.html:27467` | 改善基準違反検出（ハード判定 H4） |
| `partnerMasterData` | `index.html:9293` | 協力会社の実在性（実現可能性ガード） |
| `aiResult.count` / `confidence` | `ai-phone-reception.html` | 受付時の推定台数・信頼度（一次シグナル・データ信頼度ガード） |

---

## 2. 設計原則

1. **可能性と最適性の分離** ― 「1台で物理的に可能か（A）」と「可能でも増車が得/安全か（B）」は別問題。Aを先に判定し、Aが崩れたら無条件で増車「必須」。
2. **不足量を定量化** ― ハード判定は True/False ではなく「あと◯台 / ◯kg / ◯分」を返す。後続の台数決定・利益試算に直結させる。
3. **決定的判定はLLMに委ねない** ― 積載・時間・法令の成立判定は数式で固定（再現性・監査）。LLMは説明文・並べ替え・微妙な推奨に限定。
4. **抑制ガードを一級市民に** ― 「手配困難」「採算割れ」「情報不足」を明示的な状態として持ち、提案できない時にボタンを出さない。
5. **しきい値は設定連動** ― 積載率閾値・納期マージン・採算下限・推奨スコア閾値・重みは設定画面（`AI_WEIGHTS` と同居）で調整可能に。
6. **状態であって破壊変更でない** ― 判定結果は `Order` に対する派生情報。元案件を書き換えず、再評価可能（§9）。

---

## 3. パイプライン中の位置づけ

```
案件受付（AI電話受付：aiResult.count / confidence を含む）
   │
   ▼
★ AI増車判定（本書）= evaluateScaleOut(order) → verdict
   │   ├ required     … 増車必須（ハード判定True）
   │   ├ recommended  … 増車推奨（ソフトスコア≧閾値）
   │   ├ negotiate    … 手配困難（要交渉）
   │   ├ review       … 情報不足（要確認）
   │   └ none         … 通常配車（ボタン非表示）
   ▼
AI自社車両推薦 → AI協力会社推薦 → AI運賃推薦 → 自動配車
```

`verdict` がそのままUIのボタン状態に写像される（§7）。

---

## 4. 入力シグナルと既存データの対応

判定器の入力は「正規化済みの案件」。7層モデルが理想だが、現行プロトタイプは文字列パースで代替する。

| シグナル | 7層モデル（理想） | プロトタイプ（現行） |
| --- | --- | --- |
| 必要積載量 | `Cargo.weightKg` / `volumeM3` | `goods` を `/([\d,]+)\s*kg/` でパース |
| 温度帯・危険物 | `Cargo.tempZone` / `hazardous` | `goods` / `conditions` 文字列 |
| 発着地・距離 | `Location` + `BaseDistance` | `estimateDistance(from, to)` |
| 指定時間窓 | `TimeWindow.latest` / `strict` | `deadline` をパース |
| 必要車格・最大積載 | `VehicleType.maxLoadKg` / `tonClass` | `getVehicleParams()` |
| 多地点（巡回） | `Order` 配下の複数 `Stop` | `casePattern === '多地点配送'` |
| 車両の空き | `VEHICLE_SCHEDULE.gaps` / `idleHours` | 同左 |
| 採算 | `Fare` / 原価内訳 | `calcFare()` |
| 緊急度・パターン | `Order.priority` / `pattern` | `CASE_PATTERNS` |
| 顧客重要度・ペナルティ | `Company`（重要度属性は要追加） | `clientMasterData`（要拡張） |
| 受付推定台数・信頼度 | `AiExtraction.suggestedCount` / `confidence` | `aiResult.count` / `aiResult.confidence` |

> **前処理**：`parseCargo()` / `parseTimeWindow()` で値オブジェクト化してから判定に渡す。
> プロトタイプの文字列パースは課題C4/C5（`ideal-data-model.md`）のため、信頼度低はガードへ（§6）。

---

## 5. レイヤー1：ハード判定（増車「必須」・決定的）

「1台で物理的に不可能 or 法令違反」の判定。**不足量（deficit）を返す**。1つでも成立すれば `required`。

| # | トリガー | 判定式（概念） | 返す不足量 | 分割形態 |
| --- | --- | --- | --- | --- |
| H1 | 積載超過（重量） | `必要kg > 最適1台.maxLoadKg` | `ceil(必要kg / 1台容量)` 台 | parallel / co_split |
| H2 | 積載超過（容積） | `volumeM3 > 1台容積` | 同上 | parallel |
| H3 | 時間窓不成立 | `所要(走行 + 積降 + 多地点巡回) > (latest − 出発可能時刻)` | 超過分（分） | relay / parallel |
| H4 | 改善基準違反 | 単独運行で拘束/連続運転が上限超過（`proposeKaizenFix` で検出） | 必要分割数 | relay |
| H5 | 地理的同時集荷 | 同時刻に離れた複数発地で集荷必須 | 発地数 | parallel |
| H6 | 混載不可 | `tempZone` 競合（冷凍＋常温）/ 危険物分離 | 温度帯/区分数 | parallel |

### 5.1 各トリガーの算定詳細

- **H1/H2 積載**：相積み（co_split）で複数案件に按分する場合は合算で判定（不変条件 I6, `operation-layer-deep-dive.md`）。
- **H3 時間窓**：所要時間 = `estimateDistance/平均速度(60km/h) + 積降(既定1.5h) + 多地点の巡回加算`。`TimeWindow.strict=true`（時間厳守）のときのみ必須に昇格、`strict=false` はソフト判定（S1）に降格。
- **H4 改善基準**：`proposeKaizenFix()` が「単独では解消不可、別便分割で解消可能」を返したら relay 必須。違反でなく警告ゾーンならソフト（S2）へ。
- **H5 地理**：拠点解決後、同一 `pickupWindow` に複数拠点があれば台数 = 拠点数。
- **H6 混載**：`Cargo.tempZone` が複数種、または `hazardous` と一般貨物の同載 → 車両分割。

> **出力**：成立トリガーの配列 `reasons[]` と、それらを集約した `deficit { vehicles?, weightKg?, minutes? }`。複数成立時は理由を併記し、最大の必要台数を採用。

---

## 6. レイヤー3：抑制ガード（先に評価）

ハード判定がTrueでも、**提案として成立しない/不適切なケース**を先に弾く。順序が重要（ガード → ハード → ソフト）。

| ガード | 条件 | 結果 verdict |
| --- | --- | --- |
| G1 データ信頼度 | `aiResult.confidence === 'low'`（積載量/時間が曖昧） | `review`（要確認・自動判定を保留） |
| G2 実現可能性 | 自社（`VEHICLE_SCHEDULE`）＋協力（`partnerMasterData`）で**組める候補が0** | `negotiate`（手配困難・要交渉） |
| G3 採算下限 | スポット案件で、増車構成の粗利率が下限（既定10%）割れしかない | 推奨は出さない（必須H系は警告色で残す） |
| G4 重複抑制 | 既に分割済み / 確定済み / 協力依頼済み | `none`（対象外） |

> G1 が無いと、文字列パース失敗（重量不明）で誤って `required` を出し、手配事故の温床になる。**情報不足は必須化せず `review`** が鉄則。

---

## 7. レイヤー2：ソフト判定（増車「推奨」・AIスコア）

ハードが全てOK（1台で可能）でも、増車した方が良いケース。**増車推奨度（0–100）**を算出し、閾値超えで弱めの推奨ボタンを出す。

```
増車推奨度 =
   w1 × 余裕の薄さ        （積載率>95% / 納期マージン<30分 → 高）
 + w2 × 法令リスク        （違反ではないが警告ゾーン=連続運転残30分以内）
 + w3 × 採算改善余地      （相積み/帰り荷とのセットで粗利率が上がる）
 + w4 × 顧客重要度×ペナルティ（重要顧客×時間厳守 → 確実性優先）
 + w5 × パターン係数      （緊急/多地点は増車に振れやすい：CASE_PATTERNS）
```

| 軸 | シグナル | 既存流用 |
| --- | --- | --- |
| S1 余裕の薄さ | 積載率 / 納期マージン | `getVehicleParams` / `estimateDistance` |
| S2 法令リスク | 拘束・連続運転の残余 | `proposeKaizenFix`（警告ゾーン） |
| S3 採算改善 | 増車後の粗利率差分 | `calcFare` |
| S4 顧客重要度 | 重要度 × ペナルティ条項 | `clientMasterData`（要拡張） |
| S5 パターン係数 | 緊急/多地点/スポット | `CASE_PATTERNS` |

- 重み `w1..w5` の初期値は `AI_WEIGHTS`（distance/load/driver/law/customer）に準じて設定。
- 既定の推奨閾値 `SCALEOUT_THRESHOLD = 70`。
- 採算ガード（G3）を通過した場合のみ `recommended`。

---

## 8. AI（LLM）と決定的ロジックの役割分担

既存システムの思想（数値=決定的、説明=Claude）を踏襲する。

| 決定的ロジック（JS・再現性・監査） | AI / LLM（Claude） |
| --- | --- |
| H1–H6 の成立判定と不足量 | ソフト判定の総合推奨度の言語化、微妙ケースの最終助言 |
| 積載率・時間余裕・距離・原価・粗利 | 増車理由文、推奨分割形態（relay / parallel / co_split）の提案 |
| 増車推奨度の重み付き合計 | 優先順位コメント（過去事例・天候/交通・顧客文脈の加味） |

> **禁則**：ハード判定（積載超過・時間窓・法令）をLLMに委ねない。LLM出力は提案テキストに限定し、配車可否の決定権は決定的ロジックが持つ。LLM呼び出しは既存 `calcFare()` と同じく失敗時フォールバック（固定文）必須。

---

## 9. 判定の出力（verdict）とUI写像

### 9.1 出力スキーマ

```typescript
interface ScaleOutVerdict {
  verdict: 'required' | 'recommended' | 'negotiate' | 'review' | 'none';
  reasons: { type: 'overload'|'volume'|'time_window'|'compliance'|'geo'|'mixload'; detail?: string }[];
  deficit?: { vehicles?: number; weightKg?: number; minutes?: number };
  score?: number;        // recommended 時の増車推奨度
  shapeHint?: 'relay' | 'parallel' | 'co_split';  // 推奨分割形態
  rationale?: string;    // LLM生成の理由文（任意）
}
```

### 9.2 ボタン4状態への写像（モックと整合）

**配色方針：新規色を増やさず、システム既存トークンのみで構成する（グリーン基調）。**
増車・自社・推奨・AI提案＝グリーン（`#0D4A3A`/`#3BB888`/`#EAF5F0`）、協力会社・傭車＝既存オレンジ
（`#c2410c`/`#fff7ed`、アプリの協力会社表示と同系）、要対応＝オレンジ/アンバー、要確認＝グレー。

| verdict | ボタン表示 | 色（既存トークン） | モック該当 |
| --- | --- | --- | --- |
| `required` | ⊕ 増車必要（不足◯台/◯kg） | オレンジ・常時強調（要対応） | `dnd-card-scaleout-badge` |
| `recommended` | ⊕ AIで増車プランを見る | **グリーン**・標準（推奨） | `btn-ai-scaleout` |
| `negotiate` | ⚠ 要交渉（手配困難） | アンバー・別系統 | （新規・協力会社モーダル誘導） |
| `review` | 要確認（情報不足） | グレー | （新規・案件編集誘導） |
| `none` | 非表示（通常配車） | — | 通常の `dnd-card` |

> 増車グループの「束ね」は**色相ではなく便番号タグ（①②③）＋連結ブラケット＋淡グリーンの行ハイライト**で表現する。
> これにより自社バーが通常運行と同じグリーン系でも、グループの識別性を確保できる（色を増やさないための設計）。

### 9.3 ランキング（サマリーの「増車要N件」並び順）

```
必須(required) → 期限が近い → ペナルティ/重要顧客 → 採算インパクト大 → recommended
```

サマリーバーの「⊕ 増車要 N件」クリックで、この順に該当案件へスクロール誘導する。

---

## 10. 判定アルゴリズム（擬似コード）

```js
function evaluateScaleOut(order) {
  const cargo = parseCargo(order.goods);          // weightKg / volumeM3 / tempZone
  const win   = parseTimeWindow(order.deadline);  // latest / strict
  const dist  = estimateDistance(order.from, order.to);
  const best  = bestSingleVehicle(order);         // 最適1台（AI_WEIGHTS × VEHICLE_RAW_SCORES）

  // ── Layer3 先行ガード ──
  if (order.aiConfidence === 'low' || cargo.weightKg == null)
      return { verdict: 'review', reasons: [{ type: 'time_window', detail: '情報不足' }] };

  // ── Layer1 ハード判定 ──
  const reasons = [];
  if (cargo.weightKg > best.maxLoadKg)
      reasons.push({ type:'overload', detail: `不足 ${cargo.weightKg - best.maxLoadKg}kg` });
  if (cargo.volumeM3 && cargo.volumeM3 > best.maxVolumeM3)
      reasons.push({ type:'volume' });
  if (win.strict && overTimeWindow(dist, order.stops, win))
      reasons.push({ type:'time_window', detail: `${timeDeficit(dist, win)}分超過` });
  if (violatesKaizen(order, best))                // proposeKaizenFix 流用
      reasons.push({ type:'compliance' });
  // geo / mixload も同様に push

  if (reasons.length) {
      if (!hasFeasibleCombination(order))         // G2 実現可能性
          return { verdict: 'negotiate', reasons };
      return {
          verdict: 'required', reasons,
          deficit: aggregateDeficit(reasons, cargo, best),
          shapeHint: pickShape(reasons)           // relay / parallel / co_split
      };
  }

  // ── Layer2 ソフト判定 ──
  const score = scaleOutScore(order, best);       // 0-100（w1..w5、設定連動）
  if (score >= SCALEOUT_THRESHOLD && profitGuardOk(order))   // G3 採算下限
      return { verdict: 'recommended', score, shapeHint: pickShape([]) };

  return { verdict: 'none', reasons: [] };
}
```

---

## 11. しきい値・設定（設定画面と連動）

| キー | 既定値 | 意味 |
| --- | --- | --- |
| `SCALEOUT_THRESHOLD` | 70 | ソフト推奨を出す増車推奨度の下限 |
| `LOAD_RATE_TIGHT` | 0.95 | 「余裕薄」と見なす積載率（S1） |
| `DEADLINE_MARGIN_MIN` | 30 | 「余裕薄」と見なす納期マージン（分・S1） |
| `PROFIT_FLOOR_PCT` | 10 | 採算下限（％・G3） |
| `KAIZEN_WARN_MIN` | 30 | 連続運転の警告残余（分・S2） |
| `w1..w5` | `AI_WEIGHTS` 準拠 | ソフト判定の重み |

すべて `window.AI_WEIGHTS` と同じ場所に置き、設定画面から変更 → 即時再評価（§12）。

---

## 12. 再評価のタイミング

判定は派生情報なので、入力が変われば再計算する（`ideal-data-model.md` 設計原則8と整合）。

- 受付確定時（`Reception → Order`）
- 案件編集時（`dnd-edit-modal` での荷物/時間/車格の変更）
- マスタ/空き状況の更新時（`VEHICLE_SCHEDULE` 変化）
- しきい値・重みの設定変更時
- 一括配車/手配後（G4 で `none` に落ちる）

---

## 13. テスト観点 / 受け入れ基準

| # | ケース | 期待 verdict |
| --- | --- | --- |
| T1 | 4t車・必要6,800kg | `required`（不足2,800kg / 2台） |
| T2 | 時間厳守・1台では納期40分超過 | `required`（time_window / relay or parallel） |
| T3 | 単独で拘束超過、別便分割で解消可 | `required`（compliance / relay） |
| T4 | 積載率96%・時間厳守だが1台可能 | `recommended`（score≧70） |
| T5 | 重量不明（confidence=low） | `review` |
| T6 | 必須だが自社・協力とも空き0 | `negotiate` |
| T7 | スポットで増車すると粗利8% | 推奨は出さない（必須なら警告色） |
| T8 | 1台で余裕・増車メリットなし | `none`（非表示） |

**受け入れ基準**：T1–T8 が期待通り、かつハード判定が同一入力に対し**決定的に再現**すること（LLM出力に依存しない）。

---

## 14. 段階実装

1. **Phase 1**：`evaluateScaleOut()` のハード判定（H1/H3/H4）＋ガード（G1/G2）のみ実装。`required/negotiate/review/none` を出し、案件カードに増車バッジ（モック `dnd-card-scaleout-badge`）。LLM・ソフト判定なし。
2. **Phase 2**：ソフト判定（S1–S5）＋ `recommended` ＋採算ガード（G3）。閾値・重みを設定画面に追加。
3. **Phase 3**：LLM による理由文・分割形態の助言・優先順位コメント（フォールバック付き）。サマリーの「増車要N件」ランキング。
4. **Phase 4**：再評価フック（§12）の全結線とバックエンド化（判定をサーバ側へ、監査ログに記録）。

---

## 付録: 用語

| 用語 | 意味 |
| --- | --- |
| 増車 / scale-out | 1案件を複数台（自社＋協力会社）で編成すること |
| 不足量 / deficit | 1台に対して足りない量（台数・kg・分） |
| ハード判定 | 1台で物理的に不可能/法令違反かの決定的判定 |
| ソフト判定 | 1台で可能でも増車が得/安全かのスコア判定 |
| 分割形態 / shape | relay（中継）/ parallel（並走）/ co_split（相積み分割） |
| verdict | 判定結果（required/recommended/negotiate/review/none） |
