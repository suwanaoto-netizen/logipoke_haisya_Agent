# ロジポケ配車Agent

物流配車管理 + AI電話受付のプロトタイプ UI です。
静的 HTML / CSS / JavaScript のみで構成されており、GitHub Pages でそのまま公開できます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 配車計画表（新デザイン / React standalone バンドル）。7層データモデル + AI受付ブリッジに接続済み |
| `index.legacy.html` | 旧・配車管理画面（フル機能 + 7層データモデル連携）。新デザイン導入前の稼働版を保全 |
| `ai-phone-reception.html` | AI 電話受付画面 |

両ページは `localStorage` 経由でデータを連携しています（AI 電話受付で取り込んだ案件が配車管理側の「未処理 / 未割当」に自動反映）。

## データモデル / アーキテクチャ

理想の 7 層データモデル（マスタ / 受付 / 案件 / 運行 / 法令 / 運賃・請求 / 横断）を採用しています。
設計の単一情報源（SSoT）は `assets/logipoke-data-model.js`（バックエンド不要のフロント実装）です。

| ファイル | 役割 |
| --- | --- |
| `assets/logipoke-data-model.js` | 7層 正規化データモデル本体（ブラウザ `window.LogipokeDB` / Node 両対応） |
| `assets/logipoke-design-bridge.js` | 新デザイン ⇄ 7層モデル ブリッジ。AI受付(Reception)を `window.LP_DATA` に接続 |
| `migration/repack_design.mjs` | 新デザインバンドルへ AI受付ライブ取込みを注入する再パックツール |
| `docs/ideal-data-model.md` | データモデル設計書（7層 + 値オブジェクト） |
| `docs/operation-layer-deep-dive.md` | 運行層 Trip/Leg/Stop/Assignment の深掘り |
| `db/schema.sql` | 将来のバックエンド用 PostgreSQL DDL（in-browser 版と参照規約を一致） |
| `migration/verify_model.mjs` | モデルの検証（`node migration/verify_model.mjs`） |

### 移行状況（プロトタイプ本体）

> 注: 下記の7層データモデル移行は `index.legacy.html`（旧・配車管理画面）に対するものです。
> 現行の `index.html` は新デザイン（React standalone バンドル）に置き換わっています。

現行 UI を壊さない「ストラングラー方式」で段階移行しています。

- ✅ **① マスタ層**: 取引先 / 協力会社 / 拠点 / 社内ユーザー / 定期便 を正規化ストア(SSoT)から
  derive するよう変更（旧 literal と完全一致を `verify_model.mjs` で検証済み = lossless）。
- ✅ **② 受付層**: AI 電話受付を `Reception(+AiExtraction)` として正規化し、住所 / 荷 / 期限を
  値オブジェクト（Location / Cargo / TimeWindow）へ構造化。`localStorage` の生キュー
  （旧 `logipoke_ai_intake_queue`）を正規化キー（`logipoke_db_receptions_v1`）へ置換。
- 🔜 ドライバー / 車両 / 案件 / 運行（scheduleData・dnd・assignments）の各画面は、
  同じモデルへ順次移行予定（運行層は `Trip>Leg>Stop+Assignment` に集約）。

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

## GitHub Pages で公開する

1. このリポジトリを GitHub に push します。
2. リポジトリの **Settings → Pages** を開きます。
3. **Source** を `Deploy from a branch` にし、ブランチを `main`(または公開したいブランチ)、フォルダを `/ (root)` に設定して保存します。
4. 数十秒待つと `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

`.nojekyll` を含めているため、Jekyll による処理は行われず、ファイルがそのまま配信されます。

## ライセンス

社内検証用のプロトタイプです。
