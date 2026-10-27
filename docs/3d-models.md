# 3Dモデルの登録と更新

ボスのデスドラグーンはキャラ管理DBとは別の配信素材です。配置と差し替え方法は [ボス素材](boss-models.md) を参照してください。

3Dモデルは、NFCタグ登録と同じ `/admin/characters/[id]` のキャラ編集画面で管理します。モデル本体・ファイル名・サイズを `CharacterModel` テーブルへ保存し、キャラにはモデルIDと正面補正角度を持たせます。

## 管理画面で変更する

1. `/admin` にログインし、対象キャラの「編集・タグ管理」を開きます。
2. 「3Dモデル」の「3Dモデルファイル」から `.glb` を選びます。
3. プレビューを確認します。横や後ろを向く場合は「モデルの正面調整（度）」を−180〜180で調整します。大きさと足元の位置は自動補正し、正面のキャラ画像も512px・透過で自動作成します。画像を別途アップロードする必要はありません。
4. 「キャラ情報を保存」で登録・差し替えを確定します。プレビューだけでは保存しません。
5. モデルを外す場合は「3Dモデルを外す」→「キャラ情報を保存」。自動作成した画像も削除し、標準表示へ戻ります。

モデルの変更でNFCタグURL・キャラID・所持・育成値は変わりません。タグの再発行は不要です。別画面で先に更新された場合は409で保存を拒否し、旧モデルを維持します。モデルとキャラ情報の保存・旧データ削除は同じDBトランザクションです。

## 使用できるモデル

- glTF Binary（`.glb`）、20MB以内。Blenderの `.blend` は直接アップロードできません。
- メッシュ・マテリアル・PNG/JPEGテクスチャを1ファイルに含めてください。外部URL・別ファイル参照・圧縮専用デコーダーは使用できません。
- 上限はメッシュ500個・ノード1000個・頂点50万・画像16枚。画像は各4096px以内、合計約3355万画素以内です。疎アクセサを使う特殊な書き出しには未対応です。
- 選択時にブラウザーでもGLBの構造と外部参照を確認し、保存時にサーバーでバイナリ範囲・シーングラフ・画像サイズなどを検証します。

## アプリへの反映

スマホの `/battle/raid` と会場用 `/raid/screen` は `/api/character-models` からモデルIDと角度だけを取得し、`/api/character-models/[id]` でDB内のGLBを読み込みます。通常のキャラ一覧でモデルのバイナリは取得しません。

開いているレイド画面は表示中15秒ごと、タブへ戻った際にもモデル情報を更新します。差し替えごとに別のURLを使うため、古いキャッシュが残る問題を避けます。スクリーンはWebGLや戦闘の時計を作り直さずモデルだけを更新し、同じキャラのモデルリソースを共有します。

読み込み中は仮キャラを見せずローディングを表示します。失敗時は仮モデル、WebGL非対応時は2D画像／イラストです。ホーム・図鑑・獲得には3Dモデルから自動作成した画像を表示します。GLB内のアニメーションクリップは自動再生しません。

`/models` はDBに登録したモデルの確認・ダウンロードページです。管理画面で変更した後は再読み込みしてください。

## Blenderから書き出す

オブジェクトモードで必要なパーツを選択し、「ファイル → エクスポート → glTF 2.0」を開きます。「glTF Binary (.glb)」「選択したオブジェクト」を指定し、マテリアル・UV・モディファイアを含めて書き出してください。そのGLBを管理画面から登録します。

学科4体と学科なし6体の一括書き出しも利用できます。対応は `src/lib/bundled-character-models.json` で管理します。

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/export-character-models.py
```

出力先は `public/models/characters/` です。元の `.blend` は保存し直しません。書き出しただけではDBの登録内容は変わりません。管理画面でそのGLBをアップロードしてください。

| 学科 | 元データ | 初期GLB | キャラID | 初期角度 |
| --- | --- | --- | --- | --- |
| M：機械科 | `M科ポケモン.blend` | `m.glb` | `forest-golem` | −90 |
| E：電気情報 | `E科ポケモン修正版.blend` | `e.glb` | `thunder-fox` | 180 |
| S：電子制御 | `S科ポケモン_リセンコ.blend` | `s.glb` | `flame-dragon` | −90 |
| C：建設システム | `C科ポケモン_ポンタス.blend` | `c.glb` | `aqua-spirit` | 0 |
| 学科なし | `Morinokami.blend` | `morinokami.glb` | `temp-06` | 0 |
| 学科なし | `PasoconMon.blend` | `pasocon-mon.glb` | `temp-07` | −90 |
| 学科なし | `コートロン.blend` | `coatoron.glb` | `temp-08` | 0 |
| 学科なし | `デンラコ.blend` | `denrako.glb` | `temp-09` | 0 |
| 学科なし | `トショカン.blend` | `toshokan.glb` | `temp-10` | 0 |
| 学科なし | `ブシラッコ.blend` | `bushirakko.glb` | `temp-11` | 0 |

追加6体は既存の仮キャラIDを引き継ぎ、学科なしの通常キャラに変更しています。名前はファイル名を仮採用し、紹介文は作成者への確認待ちです。能力値・NFCタグ・所持情報は維持し、`temp-12` は仮キャラのまま残します。

追加分だけを書き出す場合はコマンド末尾に `-- --additional`、1体だけなら `-- --id=temp-10` を付けます。USBケーブルなどのカーブは書き出し時にメッシュへ変換します。重いモデルは表示用に頂点数を削減し、トショカンの重複頂点は結合します。いずれも元のBlenderデータには保存しません。

書き出し後、開発サーバーを起動して `npx tsx scripts/generate-character-thumbnails.ts --bundled --additional` で追加6体の同梱画像を生成できます。このモードはDBを変更しません。

### デンラコ・ブシラッコの上下修正（2026-10-27）

2体の元 `.blend` は上下を反転し、Blenderで上が+Z・正面が−Yになるよう修正済みです。デンラコの稲妻が頭上、ブシラッコの赤い帯が目の上に来ます。原本の編集可能なメッシュ・Mirrorモディファイアは維持しています。

`scripts/normalize-character-orientation.py` は旧原本を修正する一度限りの処理です。元データを `.local/model-orientation-originals/` にバックアップし、シーンの `webgame_orientation=upright-front-v1` で二重反転を防ぎます。修正済み原本では再実行不要です。

通常の書き出しスクリプトは、このマーカーがある静的モデルの評価済みメッシュをすべて取得してから、ワールド変換を頂点に反映します。Mirrorの左右を維持し、負スケールの面の表裏も補正します。出力GLBは上が+Y・正面が+Zで、ノードの回転・負スケール・表示側の上下補正を必要としません。DB／初期マニフェストの正面角度は0度です。

```powershell
# 修正済み原本から再出力する場合（2体それぞれ実行）
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/export-character-models.py -- --id=temp-09
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/export-character-models.py -- --id=temp-11
npx tsx scripts/generate-character-thumbnails.ts --bundled --id=temp-09
npx tsx scripts/generate-character-thumbnails.ts --bundled --id=temp-11
```

既存DBはGitの更新・seedだけでは差し替わりません。サーバー反映時は通常のDBバックアップ後、接続先 `DATABASE_URL` を確認して以下を実行します。自動起動処理やマイグレーションには組み込んでいません。

```powershell
npx tsx scripts/update-character-orientation.ts          # 検証のみ
npx tsx scripts/update-character-orientation.ts --apply  # 対象2体だけ反映
```

この処理は既知の旧GLBのSHA-256と角度−90度が一致した場合だけ更新し、管理画面で変更した別モデルや角度は拒否します。旧GLB・画像・IDは `.local/model-orientation-backups/` に保存し、管理画面と同じ検証・revision付きトランザクションでGLB／画像／角度を変更します。更新済みの場合はスキップします。キャラ名・能力値・NFC・所持・レイド記録は変更しません。別のモデルを登録済みなら管理画面でプレビューし、修正GLBを角度0度でアップロードしてください。

ローカル専用検証DBのみ反映済みです。本番DBへの反映は別途必要です。`tests/unit/character-orientation.test.ts` はGLBの実頂点から目が+Z・稲妻と帯が目より上・両手が左右に存在することと、回転補正なしの構造を確認します。

## 既存環境の更新

DBを起動して `npm run db:migrate`、`npm run db:generate`、`npx tsx scripts/import-character-models.ts` を実行し、サーバーを再起動します。WindowsでPrismaのDLLが使用中の場合は生成前に開発サーバーを停止してください。新規環境は `npm run db:setup` で初期モデルも登録します。

初期取り込みは未設定のキャラだけが対象です。管理画面から差し替え・削除したモデルはseedを再実行しても元に戻しません。

既存モデルのキャラ画像だけを作成し直す場合は、開発サーバーを起動した状態で npx tsx scripts/generate-character-thumbnails.ts を実行します。モデルから画像を作成し、現在のモデルID・角度が変わっていないキャラだけDBを更新します。属性は変更しません。
