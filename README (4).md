# ロジポケ配車Agent デモサイト

物流配車管理SaaSのフロントエンドモック。AI電話受付で受け付けた案件が、個別案件処理（未処理）と配車計画表（未割当）の両方に自動反映されるデモが動作します。

## ファイル構成

```
.
├── index.html                  # 配車管理本体（ダッシュボード / 配車計画表 / 個別案件処理 / 各種マスタ）
├── ai-phone-reception.html     # AI電話受付ページ
├── .nojekyll                   # GitHub Pages の Jekyll処理を無効化（_で始まるパスを保護）
└── README.md
```

`index.html` がエントリーポイントです。サイドバーの「AI電話受付」リンクから `ai-phone-reception.html` が開きます。

## AI電話受付 → 業務反映の連動仕様

AI電話受付ページでデモ通話を受けて「通話完了」になると、以下の流れで案件が伝搬します。

1. AI電話受付（`ai-phone-reception.html`）が `localStorage` のキー `logipoke_ai_intake_queue` に案件オブジェクトをプッシュ
2. 本体（`index.html`）が以下のタイミングでキューを取り込み
   - 起動時（`DOMContentLoaded`）
   - 他タブからの `storage` イベント発火時（リアルタイム）
   - タブが再表示されたとき（`visibilitychange`、保険）
3. 取り込まれた案件は以下の **両方** に登録される
   - **個別案件処理 / 未処理タブ**（`unprocessedCases.unshift(...)` 経由）
   - **配車計画表 / 未割当案件**（`addToDispatchUnassigned(...)` 経由）
4. 完了トーストが表示され、未処理タブのカウントと配車計画表サイドバーバッジが同期更新される

### 動作確認手順

1. `index.html` をブラウザで開く（配車計画表が表示される）
2. サイドバーの「AI電話受付」をクリック → `ai-phone-reception.html` が開く
3. 「デモ通話を開始」ボタンを押す → 通話シナリオが自動進行
4. 通話完了後、`index.html` を開いていたタブに戻る → 自動でトーストが出て案件が反映済み
5. 個別案件処理（未処理）にも、配車計画表（未割当）にも、同じ案件IDのカードが現れていることを確認できる

## GitHub Pages での公開手順

1. このリポジトリを GitHub に push する
2. リポジトリ設定 → Pages → Source を `Deploy from a branch` にして、`main` ブランチ ＋ `/ (root)` を指定
3. 数分後、`https://<username>.github.io/<repo-name>/` でアクセス可能

`.nojekyll` を置いているので、Jekyll による不要な処理は走りません。すべて静的ファイルとして配信されます。

## ローカル動作確認

`file://` でも動きますが、`localStorage` の同一オリジン要件があるためHTTPサーバ経由が安全です。

```bash
# Python 3 を使う場合
python3 -m http.server 8000
# → http://localhost:8000/index.html を開く
```

## 技術メモ

- 外部CDN: Google Fonts (`Noto Sans JP`, `Inter`)。フォント読み込みに失敗してもsystem-uiにフォールバック
- データはすべてフロントエンドのインメモリ（リロードで初期化）。AI受付のキューだけ `localStorage` に一時保管
- IE非対応（ES6+構文を使用）
