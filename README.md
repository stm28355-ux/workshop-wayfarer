# Workshop Wayfarer

勇者の冒険はオートランで止まらず進む。その間に、手元の工房で強さを作る。拾った素材を合わせる盤、地金を叩いて武器を作る打ち分け、巻物を解いて技を覚える道場の3つの段があり、慣れた段から職人や門下生に任せていくインクリメンタルRPG。

- 企画の正：Claude Docs「インクリメンタルRPG 企画まとめ（引き継ぎ用）」
- 計画のメモ：[docs/plan.md](docs/plan.md)

## 遊ぶ

https://stm28355-ux.github.io/workshop-wayfarer/

いまは試作（工程4）：冒険・マージの盤・打ち分け（装備作り）・職人・工房・道場（守りの流派）。`?speed=4` で4倍速、`?test=open` で地域1のボスを倒した後から（素材つき）、`?test=dojo` で地域2のボスの後から（道場が開いている）、`?test=line` で同じく守りの札が全部使える（枠6）状態から、`?test=all` で地域3のボスの後から（職人が2人とも来ている）。試すときの保存は本番と別。道場の巻物の試しは https://stm28355-ux.github.io/workshop-wayfarer/dojo.html 。

## 開発

```
npm test                      # テスト
node tools/serve.mjs 5194     # 手元で http://localhost:5194/
node tools/measure-run.mjs 25 # 地域1をボットで回して測る
node tools/forge-solve.mjs    # 打ち分けの盤を解いて、集中力と火ごとの一番の出来を出す
node tools/plan-balance.mjs   # 地域ごとの強さの予定表
node tools/scroll-gen.mjs 30  # 道場の巻物を作る速さと難しさ
```

ビルドはない。静的な HTML と JavaScript（ES モジュール）だけで動く。
