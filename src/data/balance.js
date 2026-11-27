// 冒険とマージの盤の数値（仮）。判定表 第4回の予定表（docs/plan.md・tools/plan-balance.mjs）に合わせる。
// 時間は「刻み」で数える。1刻み＝0.1秒。歩く速さは1刻みに1歩。

export const TICKS_PER_SEC = 10;

// 勇者。攻撃と最大 HP はレベルで掛け算に伸びる（判定表 第4回 C2：1レベルで8%）。
// 素手の攻撃は attackTicks 刻みに1回。歩いている間は regenEvery 刻みごとに regen × レベルの倍率だけ回復する。
export const HERO = Object.freeze({
  baseAtk: 10,
  baseHp: 60,
  attackTicks: 10,
  regen: 4,
  regenEvery: 5,
  walk: 2,
});
export const LEVEL = Object.freeze({ mult: 1.08 });

// 経験：レベル L から L+1 に要る量は xpBase × xpGrowth^(L−1)（切り上げ）。
export const XP = Object.freeze({ base: 10, growth: 1.6 });

// 支度ゲージ。出発するときは baseSec 秒ぶん（その地域の減りで）。支度の出口に入れた物は価値1あたり perValue 伸びる。
// 帰ったら waitTicks 刻み待ってから次の出発（判定表 第4回 C4。支度した方が待ちの分お得）。
export const PREP = Object.freeze({ baseSec: 30, perValue: 50, waitTicks: 30 });

// マージの盤（判定表 第1回 D1：5×4 から 7×6 まで）。
export const BOARD = Object.freeze({ w: 5, h: 4, maxW: 7, maxH: 6 });

// 出口。workshop（工房）は地域1のボスの後に開く（判定表 第1回 D6）。
export const EXITS = Object.freeze(['prep', 'grow', 'forge', 'workshop']);

// マージの職人（地域2のボスで来る）。everyTicks 刻みに1回合わせる。工房で速さを上げると間が speedMult 倍ずつ縮む。
export const MERGE_CRAFTER = Object.freeze({ everyTicks: 30, speedMult: 0.8, rank: 1 });

// 工房で上げる物の費用（判定表 第3回 E4）。n は今までに上げた回数。
// arm：職人が合わせられるランク＋1。speed：職人の間×0.8。widen：盤を列か段1つ（交互）、7×6まで。
export const WORKSHOP = Object.freeze({
  arm: { name: '職人の腕', base: 30, ratio: 3 },
  speed: { name: '職人の速さ', base: 20, ratio: 2 },
  widen: { name: '盤を広げる', base: 50, ratio: 2 },
});

// 地域（判定表 第1回 B4。名前は仮）。地域1・2は工程3で合わせた。地域3〜6は予定表から出した仮の値（工程6・7で直す）。
// gap：敵の間の歩数。drain：1刻みに減る支度（地域ごとに約2倍）。bossAt：ボスまでの歩数。
// enemy：道の敵。i 体目は hp = hp + hpStep × i、atk = atk + floor(i / atkEvery)。hits は1秒に何回攻撃するか（群れ・多段）。
// drops：道の敵が順に落とす物（乱数なし。i 体目は drops[i % 長さ]）。価値は地域ごとに約2倍（判定表 第4回 C3）。
// unlocks：ボスを倒すと開く物（判定表 第4回 C7：地域1 打ち分けと工房、地域2 マージの職人と道場、地域3 打ち分けの職人、地域4 門下生、地域5 振り分け）。
export const REGIONS = Object.freeze([
  {
    id: 1, name: '草原', wall: '素の敵', gap: 12, drain: 1, bossAt: 800,
    enemy: { name: 'スライム', hp: 16, hpStep: 0.5, atk: 1, atkEvery: 30, hits: 1 },
    boss: { name: '大きなスライム', hp: 200, atk: 4, hits: 1 },
    drops: [{ kind: 'iron', rank: 1 }, { kind: 'fire', rank: 1 }],
    unlocks: ['region:2', 'exit:workshop', 'stage:forge'],
  },
  {
    id: 2, name: '坑道', wall: '群れ', gap: 30, drain: 1.4, bossAt: 1800,
    enemy: { name: '岩虫の群れ', hp: 30, hpStep: 1, atk: 3, atkEvery: 15, hits: 3 },
    boss: { name: '岩虫の女王', hp: 1400, atk: 4, hits: 4 },
    drops: [{ kind: 'iron', rank: 2 }, { kind: 'copper', rank: 1 }, { kind: 'stone', rank: 1 }, { kind: 'copper', rank: 2 }],
    unlocks: ['region:3', 'crafter:merge', 'stage:dojo', 'school:guard', 'school:sword'],
  },
  {
    id: 3, name: '古い森', wall: '硬い殻', gap: 30, drain: 2.8, bossAt: 2100,
    enemy: { name: '甲虫', hp: 120, hpStep: 4, atk: 12, atkEvery: 10, hits: 1 },
    boss: { name: '甲羅の古木', hp: 7200, atk: 30, hits: 1 },
    drops: [{ kind: 'copper', rank: 2 }, { kind: 'ice', rank: 2 }, { kind: 'wind', rank: 2 }, { kind: 'copper', rank: 3 }],
    unlocks: ['region:4', 'crafter:forge', 'school:magic', 'school:bow'],
  },
  {
    id: 4, name: '雪山', wall: '盾（多段）', gap: 30, drain: 5.6, bossAt: 2400,
    enemy: { name: '盾の兵', hp: 500, hpStep: 20, atk: 10, atkEvery: 10, hits: 2 },
    boss: { name: '氷の門番', hp: 34000, atk: 30, hits: 2 },
    drops: [{ kind: 'mithril', rank: 2 }, { kind: 'ice', rank: 3 }, { kind: 'thunder', rank: 2 }, { kind: 'mithril', rank: 3 }],
    unlocks: ['region:5', 'disciple', 'school:summon', 'school:stealth'],
  },
  {
    id: 5, name: '沼地', wall: '回復する敵', gap: 30, drain: 11, bossAt: 2700,
    enemy: { name: '沼の影', hp: 2000, hpStep: 70, atk: 40, atkEvery: 8, hits: 1 },
    boss: { name: '沼の主', hp: 150000, atk: 120, hits: 1 },
    drops: [{ kind: 'mithril', rank: 3 }, { kind: 'dragon', rank: 2 }, { kind: 'thunder', rank: 3 }, { kind: 'dragon', rank: 3 }],
    unlocks: ['region:6', 'split'],
  },
  {
    id: 6, name: '魔王の城', wall: '属性と全部', gap: 30, drain: 22, bossAt: 3000,
    enemy: { name: '魔王の兵', hp: 7000, hpStep: 250, atk: 70, atkEvery: 8, hits: 1 },
    boss: { name: '魔王', hp: 630000, atk: 250, hits: 1 },
    drops: [{ kind: 'dragon', rank: 3 }, { kind: 'star', rank: 3 }, { kind: 'fire', rank: 4 }, { kind: 'star', rank: 4 }],
    unlocks: ['ending'],
  },
]);

// 盤に出る物の種類（判定表 第1回 D2：地金の鉱石と属性の欠片）。mark と color は絵ができるまでの仮の見た目。
export const KINDS = Object.freeze({
  iron: { name: '鉄鉱', group: 'ore', mark: '鉄', color: '#9aa4ae' },
  copper: { name: '銅鉱', group: 'ore', mark: '銅', color: '#c9834b' },
  mithril: { name: '魔銀', group: 'ore', mark: '銀', color: '#b8d3e6' },
  dragon: { name: '竜の鱗', group: 'ore', mark: '鱗', color: '#6fbf8f' },
  star: { name: '星鉄', group: 'ore', mark: '星', color: '#e6d36b' },
  fire: { name: '炎の欠片', group: 'shard', mark: '炎', color: '#e2623f' },
  ice: { name: '氷の欠片', group: 'shard', mark: '氷', color: '#7fc8e8' },
  thunder: { name: '雷の欠片', group: 'shard', mark: '雷', color: '#e8c84a' },
  wind: { name: '風の欠片', group: 'shard', mark: '風', color: '#8fd18f' },
  stone: { name: '石の欠片', group: 'shard', mark: '石', color: '#a68d70' },
});
