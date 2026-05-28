# ロジポケ配車Agent

物流配車管理 + AI電話受付のプロトタイプ UI です。
静的 HTML / CSS / JavaScript のみで構成されており、GitHub Pages でそのまま公開できます。

## 構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | 配車管理画面（メイン）|
| `ai-phone-reception.html` | AI 電話受付画面 |

両ページは `localStorage` 経由でデータを連携しています（AI 電話受付で取り込んだ案件が配車管理側の「未処理 / 未割当」に自動反映）。

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
