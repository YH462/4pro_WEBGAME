# FOUR PRO — 4学科合同 展示周遊Webゲーム

4学科の展示でキャラクターを集め、育成し、最大20人の協力レイドに挑むWebゲーム。現在は**フェーズ1**を実装しています。既存の `battle.html` は参考プロトタイプとして保存し、新アプリからは読み込みません。

## 実装範囲

- Next.js / React / TypeScript / Tailwind CSS、PostgreSQL / Prisma、Docker Compose
- ゲスト開始・任意ニックネーム更新・Cookieによるセッション継続
- DBに接続したホーム・5体の図鑑・キャラ詳細・所持状態・プロフィール
- 変更可能な学科／キャラマスタ、各キャラ3つの未確定技スロット
- Zod検証、Origin検証、DB共有レート制限、期限切れ／偽造セッション拒否
- 明示的なイベント終了・保存期限後のゲスト削除・開発用所持フィクスチャ
- Vitest単体テストとPlaywrightのPC／スマホE2E

NFC獲得・4プロ自動解放・育成・スタッフ認証・レイド・報酬は後続フェーズです。画面でも実装予定と表示しています。全MVPや20人レイドの完成状態ではありません。

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

UIは赤白のハニカムを背景とする、画面内で完結するゲーム画面です。`100dvh` で画面の高さに合わせ、ホームは4学科の展示ガイド、図鑑は5体の切替と情報タブ、プロフィールは編集／記録タブ、遊び方はモーダルで表示します。下部のホーム・図鑑・バトルと上部のプロフィールから移動します。展示マップは学科同士の関係を示す概念図で、実際の校内配置図ではありません。

背景は `public/red-white-honeycomb-background.png`（リポジトリ直下の指定画像のコピー）を使っています。バトル入口 `/battle` は案内画面で、レイド受付・戦闘は未実装です。

| パス | 内容 |
| --- | --- |
| `/`、`/start` | イベント案内、ゲストID発行、任意ニックネーム |
| `/collection`、`/collection/[id]` | 5体の図鑑、詳細、未確定技3枠 |
| `/profile` | ニックネーム更新、プレイヤーID |
| `/battle` | 協力レイドの案内（受付・戦闘は準備中） |
| `/dev` | 開発用シミュレーター案内（本番では無効） |
| `POST /api/guest` | ゲスト作成、有効な既存セッションは再利用 |
| `GET /api/me`、`PATCH /api/me` | 自分のデータ取得、ニックネーム更新 |
| `GET /api/characters` | DBマスタ＋自分の所持状態 |
| `GET /api/health` | DB疎通 |

更新APIは `Origin: APP_URLのオリジン` と `Content-Type: application/json` が必須です。ゲストCookieから対象プレイヤーを決め、クライアントのIDやHPでデータを更新しません。

## シミュレーターとマスタ

ゲスト開始後 `/dev` または `/profile` でプレイヤーIDを確認します。

```powershell
npm run simulator:grant -- <プレイヤーID> forest-golem
npm run db:studio
```

図鑑再読込で所持状態を確認できます。キャラIDは `forest-golem`、`thunder-fox`、`flame-dragon`、`aqua-spirit`、`four-pro`。これは表示検証用のDBフィクスチャで、NFC獲得／4プロ自動解放ルールではありません。同一キャラは重複しません。開発モード・ループバックURL・`ENABLE_DEV_SIMULATOR=true` が必要で、HTTP所持追加APIはありません。

Prisma Studioで `Department` の名前、`Character` の基本値と学科対応を変更できます。対応交換はトランザクションで一度NULLにしてから変更してください。seedは既存マスタやイベント状態を上書きしません。`src/lib/master-data.ts` は初期投入値です。

`Skill` は各キャラslot 1〜3。Ver.1.9／2.1が未提供のため `confirmed=false`、`effect=null`。効果を勝手に確定しません。スタッフ用マスタ編集画面と別認証はフェーズ4です。

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
