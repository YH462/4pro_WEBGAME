# モーションの統合管理

ゲームへの再出力はこのフォルダを参照します。アップロード元は削除・変更しません。

- 入力 48 件 → 内容が異なる 32 件（完全重複 16 件を統合）。
- キャラID別の attack / heal が採用原本です。拡張子が特殊だったBlender原本は、内容を変えず .blend 名へ統一しています。
- references/ は別形式の書き出し・行動不明GLB・未使用のボス演出です。既存の確認済みBlender原本を採用し、別形式GLBは上書きせず保管しています。
- temp-07/heal.glb は1フレームの静止ポーズだけなので、実行用モーションには登録しません。ゲームの既存回復演出を維持します。
- flame-dragon/attack.glb は動く対象が表示されない補助オブジェクトだけなので、実行用モーションに登録せず既存の攻撃演出を維持します。
- inventory.json に各ファイルのSHA-256・元の場所・採用状態を記録しています。

追加取り込み: node scripts/merge-raid-motion-sources.mjs
再出力: scripts/export-raid-motions.py（Blender）→ node scripts/build-raid-motion-manifest.mjs

採用対象を変えるときは scripts/raid-motion-sources.json を更新します。異なる内容で既存の採用原本を自動上書きすることはありません。詳しくは ../../docs/raid-character-motions.md を参照してください。

## モーションファイル3の回復テスト素材

入力は「モーションファイル」「モーションファイル2」「モーションファイル3」の3フォルダです。Mモンとリセンコはユーザー指定により heal-test.glb を採用します。以前の heal.glb は原本を維持し、参照用として残します。

- forest-golem/heal-test.glb: Mモン回復_test.glb。本体と球は動きますが、開始時の大きな球が本体を隠す既知の見た目を保持します。離れた制作参照平面だけは配信用から除外します。
- flame-dragon/heal-test.glb: S科ポケモン_リセンコ_回復_test.glb。動く対象は表示されない「ビーム先端」の補助ノードだけです。本体とビームは静止したままですが、このテスト素材を回復時に使用します。
- 攻撃の素材・ゲームの回復量・2.2秒の演出枠・DBは変更しません。
- 回復だけの再出力: Blender ... --python scripts/export-raid-motions.py -- --id=forest-golem,flame-dragon --action=heal
