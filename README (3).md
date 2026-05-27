# ロジポケ配車Agent デモサイト

GitHub Pagesで公開するための静的HTMLサイトです。

## ファイル構成

| ファイル | 説明 |
| --- | --- |
| `index.html` | トップページ(配車管理 / 案件処理画面) |
| `ai-phone-reception.html` | AI電話受付画面 |
| `.nojekyll` | GitHub PagesのJekyll処理を無効化する空ファイル |

サイドバーの「AI電話受付」をクリックすると `ai-phone-reception.html` に遷移し、AI電話受付ページ側の「案件処理」「配車計画表」をクリックすると `index.html` に戻ります。

## GitHub Pagesでの公開手順

1. GitHubで新しいリポジトリを作成する(例: `logipoke-demo`)。
2. このフォルダの中身(`index.html`, `ai-phone-reception.html`, `.nojekyll`, `README.md`)をすべてリポジトリのルートにアップロードする。
   - Webからの場合: リポジトリ画面の「Add file」→「Upload files」でドラッグ&ドロップ。
   - CLIの場合:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
     git push -u origin main
     ```
3. リポジトリの **Settings** → **Pages** を開く。
4. **Build and deployment** で:
   - Source: **Deploy from a branch**
   - Branch: **main** / **/(root)** を選択して **Save**
5. 数十秒〜1分ほどで `https://<ユーザー名>.github.io/<リポジトリ名>/` にて公開されます。

## ローカル確認方法

ファイルをダブルクリックしてブラウザで開くだけでOKです。Pythonがインストールされている場合は以下でも確認できます:

```bash
python3 -m http.server 8000
# → http://localhost:8000/ をブラウザで開く
```
