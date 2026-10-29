# モーションの統合管理

ゲームへの再出力はこのフォルダを参照します。アップロード元は削除・変更しません。

- 入力 46 件 → 内容が異なる 30 件（完全重複 16 件を統合）。
- キャラID別の attack / heal が採用原本です。拡張子が特殊だったBlender原本は、内容を変えず .blend 名へ統一しています。
- references/ は別形式の書き出し・行動不明GLB・未使用のボス演出です。既存の確認済みBlender原本を採用し、別形式GLBは上書きせず保管しています。
- temp-07/heal.glb は1フレームの静止ポーズだけなので、実行用モーションには登録しません。ゲームの既存回復演出を維持します。
- flame-dragon/attack.glb は動く対象が表示されない補助オブジェクトだけなので、実行用モーションに登録せず既存の攻撃演出を維持します。
- inventory.json に各ファイルのSHA-256・元の場所・採用状態を記録しています。

追加取り込み: node scripts/merge-raid-motion-sources.mjs
再出力: scripts/export-raid-motions.py（Blender）→ node scripts/build-raid-motion-manifest.mjs

採用対象を変えるときは scripts/raid-motion-sources.json を更新します。異なる内容で既存の採用原本を自動上書きすることはありません。詳しくは ../../docs/raid-character-motions.md を参照してください。
