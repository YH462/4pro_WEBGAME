# FOUR PRO — 4学科合同 展示周遊Webゲーム

4学科の展示でキャラクターを集め、育成し、最大20人の協力レイドに挑むWebゲーム。現在は**フェーズ1の基盤・フェーズ2の展示獲得と、レイドの試作**を実装しています。既存の `battle.html` は参考プロトタイプとして保存し、新アプリからは読み込みません。

## 実装範囲

- Next.js / React / TypeScript / Tailwind CSS、PostgreSQL / Prisma、Docker Compose
- ゲスト開始・任意ニックネーム更新・Cookieによるセッション継続
- DBに接続したホーム・12体の図鑑（うち仮キャラ7体）・キャラ詳細・所持状態・プロフィール
- 変更可能な学科／キャラマスタ、各キャラ3つの未確定技スロット
- Zod検証、Origin検証、DB共有レート制限、期限切れ／偽造セッション拒否
- 明示的なイベント終了・保存期限後のゲスト削除・開発用所持フィクスチャ
- Vitest単体テストとPlaywrightのPC／スマホE2E
- 参加者と独立した管理者ログイン、キャラ一覧、学科なしのキャラにも対応した獲得タグ管理（[管理画面の使い方](docs/admin-management.md)）

NFCのURLから4学科のキャラ獲得・4プロ自動解放まで追加しています。タグ用URL・QRの発行と実機確認の手順は [docs/nfc-acquisition.md](docs/nfc-acquisition.md) を参照してください。物理タグへの書き込み・実機NFCの動作確認は別途必要です。育成・スタッフ認証・正式なレイド受付・報酬は後続フェーズで、全MVPや20人レイドの完成状態ではありません。

## 前提

Node.js 22.12以上とnpm、推奨はDocker Desktop / Docker Compose v2。Pythonは使わないためuv／venvは不要です。依存関係は `node_modules` と `package-lock.json` で管理します。

## Docker Composeで起動

```powershell
docker compose up --build -d
docker compose logs -f web
```

`http://localhost:3000` を開きます。DBのhealthcheck後、webがマイグレーションと冪等seedを実行します。ポートはPCのループバック限定です。停止は `docker compose down`。DBはボリュームに残ります。通常の停止に `down -v` は使わないでください。

DockerのないPCではCompose実行確認はできないため、次のNode直接起動で検証します。

## Nodeで開発

Windows PowerShellで「スクリプトの実行が無効」「npm.ps1 を読み込むことができません」と表示された場合は、以下を含む手順の `npm` を **`npm.cmd`** に置き換えてください。PowerShellの実行ポリシーを変更せずに実行できます。

既に環境構築済みでDockerを使わない場合は、ターミナル1でDBを起動します。

```powershell
npm.cmd run db:local
```

起動ログを確認してから、同じリポジトリを開いたターミナル2で実行します。

```powershell
npm.cmd run dev
```

初回のDB初期化がまだの場合だけ、DB起動後に `npm.cmd run db:setup` を実行してから開発サーバーを起動してください。

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d db
npm run db:setup
npm run dev
```

Dockerがない場合は、`docker compose up -d db` の代わりに**別のターミナル**で次を起動し、そのまま開いておきます。

```powershell
npm run db:local
```

DB起動後、元のターミナルで `npm run db:setup`、`npm run dev`。ブラウザは **`http://localhost:3000`** を使います。Originを検証するため `127.0.0.1:3000` と混在させないでください。補助コマンドは実PostgreSQLを起動し、SQLiteやモックへの変更はありません。Ctrl+Cで停止、データはGit対象外の `.local/postgres` に残ります。Dockerと同時に起動しないでください。5432が使用中なら `.env` のDBポートを変更します。

npmがインストールスクリプトを制限する場合は、案内に従ってPrisma、esbuild、embedded-postgresの必要なスクリプトを確認してください。

## 画面とAPI

UIは赤白のハニカムを背景とする、画面内で完結するゲーム画面です。`100dvh` で画面の高さに合わせ、ホームは4学科の展示ガイド、図鑑は12枠の六角形一覧（既存5体＋仮キャラ7体）から個別のステータス／必殺技／紹介タブへ移動、プロフィールは編集／記録タブ、遊び方はモーダルで表示します。下部のホーム・図鑑・バトルと上部のプロフィールから移動します。展示マップは学科同士の関係を示す概念図で、実際の校内配置図ではありません。

スマホUIの背景は `public/mobile-ui-background.png` を共通で使い、スマホ表示の管理画面にも適用しています。会場スクリーンは従来の `public/red-white-honeycomb-background.png` を維持しています。`/battle` は1体を選んで遊ぶCPU対戦、`/battle/raid` は会場スクリーンと同期する協力レイドです。運営は管理者ログイン後に `/raid/screen` から開始・リセットします。DB保存・本番反映は [本番同期バトル](docs/production-raid.md) を参照してください。

ホームの展示マップ下に「QRでレイドに参加」を配置しています。ゲスト開始後に押すと背面カメラを優先して開き、同じオリジンの `/battle/raid` URL（旧 `/battle` URLも互換対応）を読み取るとカメラを停止してバトル画面へ移動します。今回は読み取りと画面移動までで、参加登録・受付トークン検証は後続対応です。他サイトや別のパスのQRでは移動しません。QRの例は `https://実際の会場アプリのホスト/battle/raid` です。`tests/fixtures/raid-entry.svg` はlocalhostでの自動テスト専用です。

QRのデコードには[スタンドアロンのjsQR](https://github.com/cozmo/jsQR)をボタン操作後に読み込みます。映像は端末内で処理し、保存・送信しません。読み取り後・閉じる・Escape・別画面への切替時にカメラを停止し、許可待ちの間に閉じた場合も後から開いたストリームを停止します。実機のカメラには[HTTPSまたはlocalhostの安全なコンテキスト](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)が必要です。LAN上のHTTP URLでは利用できません。

| パス | 内容 |
| --- | --- |
| `/`、`/start` | イベント案内、ゲストID発行、任意ニックネーム |
| `/collection`、`/collection/[id]` | 六角形12枠の一覧（既存5体＋仮キャラ7体）、個別詳細、キャラごとの必殺技1枠 |
| `/profile` | ニックネーム更新、プレイヤーID |
| `/admin/login`、`/admin` | 管理者認証、キャラ一覧・検索 |
| `/admin/characters/[id]` | キャラの名前・紹介・画像・基本値の編集、タグ発行、QR保存、有効・無効 |
| `/acquire/[token]` | NFC／展示QRからのキャラ獲得、ゲスト開始後の復帰 |
| `POST /api/acquisitions` | 自分の所持へ付与・4学科判定・4プロ自動解放 |
| `/battle` | 全12体から1体を選ぶ、仮ルールのCPU対戦 |
| `/battle/raid` | 上半分に敵、下半分にスマホ操作を配置したレイドプレビュー |
| `/dev` | 開発用シミュレーター案内（本番では無効） |
| `POST /api/guest` | ゲスト作成、有効な既存セッションは再利用 |
| `GET /api/me`、`PATCH /api/me` | 自分のデータ取得、ニックネーム更新 |
| `GET /api/characters` | DBマスタ＋自分の所持状態 |
| `GET /api/health` | DB疎通 |

更新APIは `Origin: APP_URLのオリジン` と `Content-Type: application/json` が必須です。ゲストCookieから対象プレイヤーを決め、クライアントのIDやHPでデータを更新しません。

## シミュレーターとマスタ

### CPU対戦

`/battle` は全12体から1体をお試し選択し、攻撃・防御・必殺の3つを押して遊ぶ1対1のCPU戦です。7体は「仮キャラ06〜12」としてseedに追加します。未所持でも選べますが所持・育成値は変更せず、勝敗や報酬も保存しません。登録済みの所持キャラは育成値を反映します。

両キャラを同じフィールドに表示し、CPUの次の行動を予告します。EP0開始、攻撃・防御でチャージ、EP100で必殺（攻撃力2.4倍で計算）。防御で被ダメージ65%軽減、受け止めるとEP25追加。CPUの必殺直後は1ターンだけダメージ1.5倍の反撃チャンスです。両者の行動を確定して攻撃・反撃を順に演出する同時ターン制で、HP0が敗北、同時KOか30ターン経過は引き分けです。再戦・キャラの選び直しに対応します。設定と純粋な戦闘処理は `src/lib/cpu-battle.ts`、詳しい暫定仕様は `docs/cpu-battle.md` にまとめています。正式な必殺技・レイド仕様を確定する変更ではありません。

### レイド画面の操作プレビュー

会場スクリーン `/raid/screen` には新しい3D・光・じゃんけん演出を組み込んでいます。通常表示は管理者認証付きの本番同期、`/raid/screen?sync=local` は開発用の同期テストです。どちらも入力受付が10秒の一斉ラウンド制です。PCで「10秒の入力受付を開始」を押すと、全員共通のボスの手に対して各自の勝敗を判定し、本人のキャラから同時に攻撃・自己回復を再生します。同じキャラの参加者も公開用IDで区別します。ボスの全体反撃後、次の10秒へ自動で進みます。演出だけを確認する `/raid/screen?demo=effects` は独立して残しています。本番では開始・リセット・演出進行に管理者認証を使い、イベントごとの戦闘状態をDBに保存します。

実機スマホとのローカル同期テストを追加しています。`npm.cmd run dev:lan` でLAN向けに起動し、`npm.cmd run local:urls` で接続先を確認できます。スマホは `/battle/raid?sync=local`、PCスクリーンは `/raid/screen?sync=local` を使用します。1人1ラウンド1回の入力を締め切り後にまとめて計算し、通常500msごとに同期します。スマホの結果はスクリーンの「ぽん！」で公開し、HPは攻撃命中・回復・全体反撃命中の通知に合わせて更新します。未入力の人は攻撃・回復をせず反撃だけ受け、演出中の初参加者は次のラウンドから参加します。正式なイベント受付・報酬保存とは別の試作です。詳細は [ローカル同期の手順](docs/local-raid-sync.md) を参照してください。独立した操作プレビューは `/battle/raid?preview=1` に残しています。

`/battle/raid` と同期用スマホ画面は、赤・白・黒と六角形を基調にしたスマホUIです。上部にボスのHP・ラウンド・参加人数を小さくまとめ、中央に自分のキャラの正面向き3Dモデルと直下のHP、下部に攻撃／回復とじゃんけんを配置します。スマホに敵のキャラクターモデルは表示しません。ボスと自分のHPは、切れ目のない六角形の連続バーと横の数値で統一しています。送信後も選んだ手を確認でき、結果の自動復帰とHPの演出同期を維持します。討伐後は送信操作を隠し、実際の勝敗・効果量・反撃値を専用パネルに表示します。WebGL非対応時はイラストへ切り替わります。デザインと検証方法は [スマホUI](docs/raid-mobile-ui.md) を参照してください。

所持キャラがあればそのキャラとDBの育成済みHPを表示します。未所持の場合は通常4体を「体験」として表示し、所持には追加しません。未所持の4プロは選べません。回復は自分のみを対象とし、ハートの演出を表示します。レイド画面には防御・必殺・EPを表示しません。CPU対戦や図鑑の必殺技データは維持します。

`/battle/raid?preview=1` はUIと演出の確認用です。ボス「キング・アクア」とHP450は表示用で、じゃんけんはブラウザ内でランダムに選び、共通の `src/lib/raid-rps.ts` で判定します。基本攻撃50・基本回復30は仮値です。約2.1秒の待機後に効果量の例を表示し、HP・所持データ・報酬は変更しません。`?sync=local` はサーバー計算とスクリーンの公開通知へ接続し、実際に共有HPを更新する開発用モードです。見本の設定は `src/lib/battle-preview.ts`、会場スクリーンの説明は `docs/raid-screen.md` を参照してください。

### 所持状態・マスタの確認

ゲスト開始後 `/dev` または `/profile` でプレイヤーIDを確認します。

```powershell
npm run simulator:grant -- <プレイヤーID> forest-golem
npm run db:studio
```

図鑑再読込で所持状態を確認できます。キャラIDは `forest-golem`、`thunder-fox`、`flame-dragon`、`aqua-spirit`、`four-pro`。これは表示検証用のDBフィクスチャで、NFC獲得／4プロ自動解放処理を経由しません。同一キャラは重複しません。開発モード・ループバックURL・`ENABLE_DEV_SIMULATOR=true` が必要で、任意のキャラを直接指定して所持追加するHTTP APIはありません。

Prisma Studioで `Department` の名前、`Character` の基本値と学科対応を変更できます。対応交換はトランザクションで一度NULLにしてから変更してください。seedは既存マスタやイベント状態を上書きしません。`src/lib/master-data.ts` は初期投入値です。

`Skill` は各キャラslot 1〜3。Ver.1.9／2.1が未提供のため `confirmed=false`、`effect=null`。効果を勝手に確定しません。キャラ名・画像・基本値は別認証の管理画面から編集できます。必殺技やレイド受付の管理は後続対応です。

## テスト

DBを起動して `npm run db:setup` 後、**開発専用DB**で実行します。

```powershell
npm run test
npm run typecheck
npm run build
npm exec playwright install chromium
npm run test:e2e
npm audit
```

E2EはDesktop ChromeとPixel 7相当で実行し、3000番にサーバーがなければ自動起動します。作成したテストIDだけを削除します。20人同時接続／切断／Socket再送はフェーズ7、NFC／カメラQRは手動テストです。[docs/testing.md](docs/testing.md) を参照してください。

レイアウトE2Eは360×640、375×667、390×844、844×390、1440×900の5サイズで、主要画面・全キャラ・情報タブ・ガイドを確認します。ページのスクロールだけでなく、ボタンが画面外に出たり他の要素に覆われたりしていないことも検証します。

バトルE2EはPC／スマホで技選択、演出中の操作抑止、DBの育成値反映、進行データが変化しないこと、WebGL代替表示を確認します。レイアウトE2Eでは上下の高さが等しく、技／演出ボタンが44px以上あることも検証します。

Windowsで起動中の開発サーバーがPrismaのDLLを使用していると、`npm.cmd run build` の再生成段階でEPERMになることがあります。開発サーバーをCtrl+Cで止めてからビルドしてください。スキーマ・依存関係に変更がなく生成済みクライアントを使う場合は `npm.cmd exec next build` でも本番ビルドを確認できます。

## イベント運用

現段階はローカル確認用です。スマホをLANでつなぐ会場運用にはHTTPS、会場URL、スタッフ別認証など後続実装が必要です。

1. `.env` の `EVENT_ID` を開催単位の固定IDにしてseed。日付で自動変更しません。
2. DB／webを起動し `/api/health`、ゲスト開始、図鑑を確認。
3. 同じ端末・ブラウザで継続するよう案内。Cookie削除や端末変更後の復旧は未対応です。
4. 開催中は日付が変わっても削除しません。明示的な終了後、保存期限が過ぎてから削除します。

```powershell
# 24時間保存して終了（省略時も24時間）
npm run event:end -- local-exhibition 24
# 期限経過後のみ削除。イベントIDと --confirm が必須
npm run event:purge -- local-exhibition --confirm
```

Dockerでは `docker compose exec web npm run event:end -- local-exhibition 24` のように実行します。終了後は新規発行を停止し、有効セッションの閲覧は継続可能。削除はゲスト・セッション・所持に連鎖し、イベントとマスタは保持します。終了の再実行は保存期限を変更しません。次回は新しい `EVENT_ID` でseedし、webを再起動します。ログ／バックアップの削除方針は別途運営で決めてください。

CookieはHttpOnly / SameSite=Lax / Path=/、HTTPSではSecure。HTTP例外は明示許可のループバックだけです。会場では `APP_URL=https://...`、`ALLOW_INSECURE_LOCAL_HTTP=false`、`ENABLE_DEV_SIMULATOR=false` としてください。初期DBパスワードはローカル用です。

## 設計

[docs/architecture.md](docs/architecture.md) に構成、DB設計、後続フェーズとTODOを記載しています。静的NFC／QR URLだけでは現地訪問を厳密に証明できません。

フェーズ1のHTTP APIはNext.jsと同じNodeサーバーで実行。Socket.IO／戦闘エンジンはフェーズ5で追加します。Prismaは6.19系列を採用し、deepmerge-tsの既知問題は修正版8系列へのoverrideで解消しています。

参考：[Next.js環境要件](https://nextjs.org/docs/app/getting-started/installation)、[Prisma 6のseed](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/seeding)。
