# Workshop Wayfarer

勇者の冒険はオートランで止まらず進む。その間に、手元の工房で強さを作る。拾った素材を合わせる盤、地金を叩いて武器を作る打ち分け、巻物を解いて技を覚える道場の3つの段があり、慣れた段から職人や門下生に任せていくインクリメンタルRPG。

- 企画の正：Claude Docs「インクリメンタルRPG 企画まとめ（引き継ぎ用）」
- 計画のメモ：[docs/plan.md](docs/plan.md)

## 遊ぶ

https://stm28355-ux.github.io/workshop-wayfarer/

いまは作り始めたところ（工程0）。

## 開発

```
npm test                      # テスト
node tools/serve.mjs 5194     # 手元で http://localhost:5194/
```

ビルドはない。静的な HTML と JavaScript（ES モジュール）だけで動く。
