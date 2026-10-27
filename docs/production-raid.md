# 本番サーバーの同期バトル

## 利用する画面

| 用途 | パス |
| --- | --- |
| 運営PC・会場スクリーン | `/raid/screen`（管理者ログインが必要） |
| アプリ内の参加入口 | `/battle`（ホームと共通のQR読み取り） |
| 参加者のスマホ | `/battle/raid` |
| 演出だけの確認 | `/raid/screen?demo=effects` |
| スマホの独立した操作プレビュー | `/battle/raid?preview=1` |

現在の公開先では、スクリーンは `https://163.43.128.139/raid/screen`、参加者は `https://163.43.128.139/battle/raid` を開きます。参加QRは `APP_URL` のオリジンから作り、開発用LANアドレスは使いません。`APP_URL` は実際の公開HTTPS URLと一致させてください。Dockerではホストの `.env` だけでなく、webコンテナーへ渡す `compose.override.yaml` の環境変数を確認します。

`ENABLE_DEV_SIMULATOR=false` のまま動きます。本番で開発用モードを有効にする必要はありません。`?sync=local` と `/api/local-raid` は従来通り本番では利用できません。

CPU対戦は廃止しました。アプリの「バトル」では会場QRを読み取り、`/battle/raid` の同期バトルへ進みます。未登録の場合はゲスト登録後にQR参加画面へ戻ります。ホームにも同じ読み取りを残しています。QRは同一サイトの参加URLを確認する入口で、参加権限は既存のゲストセッションで検証します。読み取り前の `/battle` では部屋への参加処理を行いません。スマホの標準カメラから会場QRを直接開く導線も利用できます。

## 運営の流れ

1. 運営PCで `/raid/screen` を開き、管理者としてログインします。ログイン後はスクリーンに戻ります。管理画面ヘッダーの「会場スクリーン」からも開けます。
2. スクリーンの参加QRをスマホの標準カメラで読み取ります。初めての参加者はゲストではじめると、そのまま同期バトルへ戻ります。
3. 参加キャラはNFC等で所持しているキャラから選びます。未所持の場合は、正式な通常キャラを使った体験参加ができます。体験参加でキャラ所持は増えません。
4. 参加者を確認し、「10秒の入力受付を開始」を押します。以後は10秒の入力→全員共通のじゃんけん→攻撃・自己回復→ボスの全体反撃→次の受付と進みます。
5. 討伐成功・全滅後は「同期設定」→「同期をリセット」で次のグループへ切り替えます。接続中のスマホは再参加するため、前のグループには画面を閉じてもらってください。

運営PCはスクリーンを前面で表示し続けてください。スマホの勝敗・HPと次ラウンドの開始はスクリーンの演出通知に合わせます。タブを閉じたり非表示にした場合は進行が待機します。開き直すと保存済みの段階から再開します。複数の運営PCで同じバトルの演出を同時進行させないでください。管理者セッションは8時間です。操作中にログインを求められた場合は「同期設定」の管理者ログインから入り直します。

## 保存と権限

- イベントごとに1部屋、最大20人です。戦闘ルール・HP・演出は従来の同期テストを引き継ぎます。現時点のボスHPは450、基本攻撃50、基本自己回復30、全体反撃20です。報酬や育成値の付与はありません。
- `RaidRoom` に参加者・入力・HP・結果・演出の公開段階・送信IDを保存します。再読み込み・webコンテナーの再起動後にも継続します。参加者の所持・NFCタグ・取得日時は変更しません。
- `/api/raid` で同期します。参加・行動送信は有効なゲストセッション、開始・リセット・演出進行・スクリーン用取得は有効な管理者セッションが必要です。参加者からHP・攻撃量は指定できません。
- イベントの共有ロック→部屋の更新ロックの順で処理し、複数のプロセスからも同じ部屋を更新します。1人1ラウンド1回、同じ送信IDの再送は重複適用しません。過去10ラウンドの結果・送信IDだけを保持します。
- イベント終了後は参加・戦闘操作を停止します。既存のイベント削除CLIで保存期限後のゲストを削除すると、戦闘状態も削除します。リセットでも部屋の参加者情報・結果を消します。

## 既存サーバーへの反映

反映するブランチは `codex/production-raid`。DB移行は `202610260001_production_raid` のテーブル追加だけです。既存の本番用Compose設定を保持します。管理者アカウントはDBに残りますが、発行時のパスワードJSONはコンテナー内のファイルなので、更新前にパスワードを手元へ保存してください。

SSHで接続したUbuntu上で、1行ずつ実行します。途中で失敗したら次へ進まず、結果を確認します。

```bash
cd /home/ubuntu/4pro_WEBGAME
git status --short
sudo docker compose ps
sudo docker compose exec -T web node -e 'console.log(JSON.stringify({APP_URL:process.env.APP_URL,EVENT_ID:process.env.EVENT_ID,ENABLE_DEV_SIMULATOR:process.env.ENABLE_DEV_SIMULATOR},null,2))'
```

`APP_URL` が公開HTTPS URL、開発シミュレーターが `false` であることを確認します。未追跡の `compose.override.yaml` は保持します。ソースのローカル変更がある場合は、内容を確認してから進めます。

更新前のDBと設定を保存します。

```bash
raid_backup="$HOME/fourpro-backups/fourpro-before-raid-$(date +%Y%m%d-%H%M%S)"
(
umask 077
mkdir -p "$HOME/fourpro-backups"
sudo docker compose exec -T db pg_dump -U fourpro -d fourpro -Fc > "$raid_backup.dump"
test -s "$raid_backup.dump"
sudo docker compose exec -T db pg_restore --list < "$raid_backup.dump" > /dev/null
git rev-parse HEAD > "$raid_backup.commit"
cp compose.override.yaml "$raid_backup.compose.override.yaml"
)
```

作業ツリーが反映可能な状態になってから取得・ビルドします。`--ff-only` が失敗した場合は停止し、ブランチの差分を確認してください。

```bash
git fetch origin
git merge --ff-only origin/codex/production-raid
sudo docker compose build web
sudo docker compose up -d --no-deps web
sudo docker compose logs --tail=80 web
curl --retry 10 --retry-connrefused --retry-delay 2 --max-time 10 -fsS http://127.0.0.1:3000/api/health
```

コンテナー起動時に `db:migrate`→`db:seed`→本番起動が実行されます。通常の更新でDBボリュームの削除やDBリセットは行いません。`/api/health` の正常応答に加え、実機で管理者ログイン・参加QR・スマホ2台以上の入力・HP更新・スクリーン再読み込み・リセット・既存のNFC URLからの獲得を確認します。

バックアップの `umask 077` は括弧内のサブシェルだけに適用します。シェル全体へ設定したままGitでファイルを取得すると、ソースが所有者しか読めない権限になる場合があります。Dockerfileではコピー時に `node` へ所有権を設定し、ホスト側で制限されたソースも非rootユーザーで読み込めるようにしています。

旧Dockerfileで `EACCES: permission denied, open '/app/prisma/schema.prisma'` が出て再起動を繰り返す場合は、`umask 022` を実行してから、この修正を取得しwebを再ビルド・再作成します。既に作られたファイルの権限は `umask` だけでは変更されません。DBコンテナーやDBボリュームを削除する必要はありません。

更新後に問題がある場合はログを保存し、控えたコミットへソースを戻してwebを再ビルドする方法を検討します。追加テーブルは旧版の既存テーブルと独立しているので、アプリを戻すためだけに本番DB全体を復元する必要はありません。

## 検証

`npm test` と型チェックに加え、`playwright.production.config.ts` は実際の `next build` / `next start` と専用PostgreSQLで、開発同期を無効にして検証します。テストは `EVENT_ID=raid-production-test`、DBポート55436、アプリURL `http://localhost:13026` の専用環境だけで実行します。既存の開発・本番DBでは実行しません。

専用DBの準備・マイグレーション・seedと本番ビルド後、同じ環境変数で次を実行します。

```bash
npx playwright test --config playwright.production.config.ts
```

20人同時入力・再送・古い部屋IDの拒否、運営操作の権限、別イベント・終了イベントの拒否、実ブラウザのスクリーンとスマホ2台、再読み込み後の復帰、次ラウンドへの自動進行を検証します。負荷試験・実際の投影PCやスマホ機種すべての表示確認とは別です。
