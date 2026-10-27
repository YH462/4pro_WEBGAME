# デスドラグーンのボス素材

ボスは `src/lib/boss.ts` で名前・使用するモデル・代替画像を指定する。現在は赤のデスドラグーンを使用する。青・緑・黄も配置済みだが、自動の色変更やゲームルールとの紐付けは行わない。

| 色 | 配信用GLB | 代替画像 |
|---|---|---|
| 赤（使用中） | `public/models/bosses/des-dragoon-red.glb` | `des-dragoon-red.webp` |
| 青 | `public/models/bosses/des-dragoon-blue.glb` | `des-dragoon-blue.webp` |
| 緑 | `public/models/bosses/des-dragoon-green.glb` | `des-dragoon-green.webp` |
| 黄 | `public/models/bosses/des-dragoon-yellow.glb` | `des-dragoon-yellow.webp` |

`3Dmodels/敵キャラ_デスドラグーン（色）.glb` を上記の場所へ移動した。元の `.blend` はそのまま保持する。GLBのテクスチャは内部に含まれており、外部素材は不要。

最初に受け取ったGLBにはミラーで生成する反対側の身体が含まれていなかったため、4色とも元の `.blend` の評価済みメッシュから書き出し直した。元GLBは `.local/boss-model-review/original-uploads/` に保管している。再出力は次のコマンドを使う。`.blend` 自体は保存し直さず、他のオブジェクトを対称面に使うミラーも、全オブジェクトを評価してからまとめてメッシュへ反映する。

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/export-boss-models.py
```

`tests/unit/boss-models.test.ts` で4色すべての胴体が対称面の両側に存在することと、GLBの構造・テクスチャを確認する。画像も修正済みGLBから再生成した。正面・背面・左右の確認画像は `.local/boss-model-review/fixed-facing-contact.png`。

会場スクリーン・演出デモと共通のボス表示処理が、GLBを読み込んで高さと足元を補正する。ラッパーに対して既存の揺れ・被弾・反撃・討伐アニメーションを適用し、以前の装甲亀のメッシュや追加装甲は描画しない。読み込み完了後に3D表示へ切り替え、失敗時とWebGL非対応時は同じモデルから生成した透過画像を表示する。CPU対戦にもその画像を使用する。

画像は既存の `renderCharacterThumbnail` を利用し、赤・青・緑・黄それぞれのGLBから正面斜め45度の向きで作成した。モデル内のアニメーションクリップは含まれていないため、戦闘の動きは従来の共通演出を使用する。

この変更ではボス素材と名前のみを差し替える。HP・攻撃・回復・反撃量、レイドの進行、プレイヤーの所持・能力値・DB構造は変更しない。素材はNext.jsの `public` から配信し、ボス用DBへの登録は不要。

2026-10-27に4色のGLB構造・画像を検証し、単体118件、表示・演出のブラウザテスト6件、本番起動の結合テスト6件、型チェックと本番ビルドが成功した。専用検証DBで管理者ログイン後の実GLB表示・4色の配信・スマホのCPU対戦画像・会場とスマホ2台のラウンド進行と再接続を確認した。ブレスの発射位置もドラゴンの口の高さへ変更した。本番反映とmainへの取り込みは行っていない。
