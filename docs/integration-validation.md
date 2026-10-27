# UIと本番レイドの統合検証

## 保存と統合

- UI保存：`codex/ui-screen-review` の `3854bc6`。
- 本番レイド：`de6c1da` とDockerの権限修正 `6ae1db6`。
- 統合：`codex/ui-production-integration` のマージコミット `5acc5a6`。

競合した4ファイルでは、補足文・英語ラベルの削除を維持し、管理者ログインの復帰先、会場スクリーンへのリンク、本番APIへの接続、QRの本番向け遷移を保持しています。10px以下の表示抑制も維持しています。通信エラー・保存完了・プレイヤーIDの表示を戻す変更は行っていません。

## 専用環境

- DB：`127.0.0.1:55436/fourpro_ui_integration`
- DB保存先：`.local/ui-production-integration/postgres`
- 本番モード結合テスト：`http://localhost:13026`、イベント `raid-production-test`
- 画面撮影：`http://localhost:13027`、イベント `ui-integration-review`
- 画像保存先：`.local/ui-review/2026-10-27-integration`
- 画像一覧：`http://127.0.0.1:4311/`

通常の開発DB（5432番）と公開サーバーには接続しません。既存の `.env` は書き換えず、検証コマンドのプロセス環境変数で接続先を指定します。

## 再実行

ターミナル1で専用DBを起動します。終了はCtrl+Cです。

```powershell
node scripts/integration-db.mjs
```

ターミナル2で以下を実行します。途中で失敗したら、その結果を確認してから進めてください。

```powershell
$env:DATABASE_URL='postgresql://fourpro:integration_test_only@127.0.0.1:55436/fourpro_ui_integration?schema=public'
$env:APP_URL='http://localhost:13026'
$env:EVENT_ID='raid-production-test'
$env:ALLOW_INSECURE_LOCAL_HTTP='true'
$env:ENABLE_DEV_SIMULATOR='false'
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright test --config playwright.production.config.ts
```

本番モードのテストには、管理者ログイン後のスクリーン復帰、NFC獲得の重複防止とプロフィール維持、モデル10件の配信、スマホ3サイズでのUI、イベント終了と削除、20人分の入力と再送、スクリーン＋スマホ2台の同期・再読み込み・リセットが含まれます。

画面撮影には同じDB接続先を指定し、`APP_URL=http://localhost:13027`、`EVENT_ID=ui-integration-review`、`ENABLE_DEV_SIMULATOR=true` へ切り替えて `npm.cmd run db:seed`、`npm.cmd run dev -- --port 13027` を実行します。

別ターミナルにもその撮影用環境変数を設定し、以下を実行します。

```powershell
$env:UI_TEXT_AUDIT='true'
$env:UI_REVIEW_OUTPUT='.local/ui-review/2026-10-27-integration'
$env:UI_REVIEW_DATE='2026-10-27'
$env:UI_GALLERY_URL='http://127.0.0.1:4311'
npm.cmd run ui:capture
```

画像一覧の配信・確認は同じ出力先の設定に加え、`UI_GALLERY_PORT=4311` を指定して `npm.cmd run ui:gallery`、別ターミナルから `npm.cmd run ui:verify` を実行します。プレビューは `?preview=1`、会場スクリーンは撮影専用管理者で開きます。

## 検証結果

2026年10月27日に、単体テスト118件・型チェック・本番ビルド・結合テスト6件が成功しました。全14ページ・177画面状態の撮影と一覧確認も成功し、画面外へのはみ出し・ブラウザ例外・10px以下の文字は0件でした。詳細は [統合完了報告書](reports/2026-10-27-ui-production-integration.md) を参照してください。

実際の会場PC・スマホ20台での負荷確認、公開サーバーへのデプロイ、Dockerイメージの実ビルドは今回のローカル検証には含みません。
