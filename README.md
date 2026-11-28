# Workshop Wayfarer

勇者の冒険はオートランで止まらず進む。その間に、手元で強さを作るインクリメンタルRPG。手元には3つの段がある。

- 荷車：拾った素材を合わせる盤
- 鍛冶場：地金を叩いて装備を作る
- 修練場：巻物（パズル）を解いて技を覚え、技の並びを組む

慣れた段から、まとめ職人・鍛冶職人・門下生に任せていく。地域は6つ（草原・坑道・古い森・雪山・沼地・魔王の城）。それぞれに壁がある（群れ・硬い殻・盾・回復・属性）。魔王を倒すと記録が出て、そのまま続けて遊べる。

- 企画の正：Claude Docs「インクリメンタルRPG 企画まとめ（引き継ぎ用）」
- 計画のメモ：[docs/plan.md](docs/plan.md)
- 測った記録：[docs/measure/](docs/measure/)
- ふり返り：[docs/retrospective.md](docs/retrospective.md)

## 遊ぶ

https://stm28355-ux.github.io/workshop-wayfarer/

版 1.0.0。魔王まで、手早く遊んで4時間半ほど。閉じている間とタブが裏にある間は止まる。

中身：
- 流派6つ。巻物の解き方が流派ごとに違う（守り＝罠の推理、剣＝絵の推理、魔法＝属性の数独、弓＝鏡と光、召喚＝部屋分け、隠密＝灯り）
- 札48枚
- 素材10種、装備の格1〜6

試すための入口（保存は本番と別）：
- `?speed=4`：4倍速
- `?test=open|dojo|line|all|r3|auto|sword|forge3|magic|summon|r6`：その段階の状態から始める（`r6` は魔王の手前から）
- 巻物だけを試すページ：[dojo.html](https://stm28355-ux.github.io/workshop-wayfarer/dojo.html)（守り）、[sword.html](https://stm28355-ux.github.io/workshop-wayfarer/sword.html)（剣）

## 開発

```
npm test                                   # テスト
node tools/serve.mjs 5194                  # 手元で http://localhost:5194/
node tools/run-through.mjs 100             # 地域1〜3 の通しのボット
CHAIN=1 REGION=4 node tools/region-time.mjs  # 地域4〜6 を続けて回すボット（入ってからボスを倒すまでの分）
REGION=6 node tools/r4-sim.mjs             # 予定どおりの勇者で、その地域の道とボスを回す
node tools/plan-balance.mjs                # 地域ごとの強さの予定表
node tools/forge-solve.mjs                 # 鍛冶場の盤（格1〜2）を解いて一番の出来を出す
node tools/forge-targets.mjs               # 鍛冶場の盤（格5〜6）の目標を探す
node tools/sudo-gen.mjs                    # 巻物の生成（ほかに nono・beam・rooms・lamps・scroll）
```

ビルドはない。静的な HTML と JavaScript（ES モジュール）だけで動く。ゲームの決まりは `src/core` の純粋な関数（1刻み＝0.1秒）、数値は `src/data`、画面は `src/ui`、ドット絵は `src/art`。
