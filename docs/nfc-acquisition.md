# NFCタグからのキャラクター獲得

## 参加者の流れ

1. 展示のタグにスマホを近づけ、表示された通知からブラウザを開きます。
2. 初回はニックネームを入力（省略可）してゲスト開始します。そのまま元の展示の獲得画面へ戻ります。
3. 「仲間にする」を押すと、その学科のパートナーを獲得します。図鑑・ホーム・バトルの所持判定に反映します。
4. 同じキャラは増殖せず、再タッチ・再読み込み時は獲得済み表示になります。育成値と取得日時も維持します。
5. 4学科すべてのパートナーを持つと、最後の獲得処理で4プロも同時に付与します。仮キャラ7体は対象外です。

タグには **NDEFのURL/URIレコード** で `https://会場のホスト/acquire/発行されたコード` を保存します。テキストレコードではありません。参加アプリはWeb NFC APIを使用せず、端末のURL読み取りを利用します。iPhoneの対応端末ではバックグラウンド読み取りからSafariでURLを開けます（[Apple公式](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading)）。実際の通知・読み取り位置は端末側の動作です。

タグを読めない場合は、同時発行したQRをスマホの標準カメラで読み取ります。ホームの「QRでレイドに参加」はレイド専用なので、展示獲得用には使いません。

## ローカル準備

DB起動後、新しいスキーマを一度適用します。既存ゲストや所持データは削除しません。Windowsで生成時にDLLロックが出る場合は、開発サーバーだけを止めて生成後に起動します。

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run dev:lan
```

別ターミナルでURLを発行します。`http://PCの現在のIP:3000` は実際のPCのLANアドレスに置き換えます。開発HTTPでは既存の `ALLOW_INSECURE_LOCAL_HTTP=true`、`ENABLE_DEV_SIMULATOR=true` とループバックの `APP_URL` を使用します。現在のIPは `npm.cmd run local:urls` でも確認できます。

```powershell
npm.cmd run nfc:tags -- issue mechanical http://PCの現在のIP:3000
npm.cmd run nfc:tags -- issue electrical http://PCの現在のIP:3000
npm.cmd run nfc:tags -- issue control http://PCの現在のIP:3000
npm.cmd run nfc:tags -- issue civil http://PCの現在のIP:3000
```

| 学科ID | 初期マスタの対応キャラ |
| --- | --- |
| mechanical | フォレストゴーレム（機械科） |
| electrical | サンダーフォックス（電気情報） |
| control | フレイムドラゴン（電子制御） |
| civil | アクアスピリット（建設システム） |

対応はDBの学科／キャラマスタを使います。タグはキャラIDを指定できません。発行ごとに新しいタグIDとコードが生成され、URLとQRのSVGを `.local/nfc/タグID.json` / `.svg` に保存します。このフォルダはGit対象外です。再取得できるように発行ファイルを運営で保管してください。DBにはコード原文を保存しません。

初めに生成URLを実機ブラウザで開き、獲得できることを確認してからタグへ同じURLを書き込みます。HTTPローカルURLが端末のNFC通知から開けるかどうかは実機で確認してください。PCのIPが変わると書き込み済みURLは使えなくなります。

## 会場用の発行・無効化

本番の固定HTTPSホストを決めて `APP_URL` に設定し、その環境の同じDBで発行します。ホストを省略した発行は `APP_URL` のオリジンを使用します。localhostはスマホからPCへ接続するURLになりません。

```powershell
npm.cmd run nfc:tags -- issue mechanical
npm.cmd run nfc:tags -- list
npm.cmd run nfc:tags -- disable タグID
```

NDEF書き込み用アプリやリーダーで、発行ファイルのURLをURLレコードとして書き込みます。タグの型番・書き込み方法・実機読み取りは別途確認が必要です。この実装から物理タグへの書き込みは行いません。書き込みロックは運用確認後に判断してください。

無効化はそのタグからの以後の獲得を停止し、既存の所持を残します。DBトランザクションで処理中の獲得は、タグ無効化の更新より先に確定する場合があります。コードを失った場合や再発行する場合は、旧タグIDを無効化して新しいURLを書き込みます。ACTIVEの設定イベントだけが発行・獲得できます。

NFC・QR・通常プレイは **同じホスト・同じブラウザ** で開いてください。別ホストやアプリ内ブラウザではCookieが共有されず、別ゲストになる場合があります。タグの静的URLはコピーできるため、現地にいた証明には使いません。必要な場合は現地コード等を追加設計します。

## サーバー処理

- `/acquire/[token]`：有効なタグか確認し、必要なら `/start?next=acquire&tag=...` へ移動。GET・プレビュー・再読み込みで所持を変更しません。
- `POST /api/acquisitions`：Cookie、Origin、JSON、入力上限、厳密なtoken入力を検証。プレイヤー単位30回/分の制限。クライアントからキャラ・学科・プレイヤー・能力値は指定できません。
- `AcquisitionTag`：イベントと学科、256bit乱数のSHA-256、enabledを保存。発行・無効化は運営CLIのみ。
- `AcquisitionLog`：プレイヤー×タグで初回1件。実際の対象キャラと新規付与の有無を記録。所持はプレイヤー×キャラで一意。別タグ経由でも同じキャラは増えません。
- Event共有ロック → Player更新ロック → Tag共有ロックの順で取得。通常キャラ・ログ・4体判定・4プロ付与を同一トランザクションにします。失敗時はまとめてロールバックします。
- イベント終了後の獲得は拒否。既存のゲスト削除CLIは獲得ログもcascade削除し、タグとマスタは保持します。

## 検証

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e -- tests/e2e/acquisition.spec.ts tests/e2e/guest-entry.spec.ts --project=chromium
```

ゲスト復帰・確認前の無変更・図鑑反映・同時8リクエスト・4プロ一度だけ付与・育成値保持・無効／別イベント／終了イベント・不正Origin／入力・CLIのURL/QR発行と無効化を確認します。実機NFC、タグ書き込み、公開HTTPSはこの自動テストには含まれません。
