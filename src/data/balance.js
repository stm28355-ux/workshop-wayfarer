// 冒険とマージの盤の数値（仮）。工程2で遊んでもらってから直す。
// 時間は「刻み」で数える。1刻み＝0.1秒。歩く速さは1刻みに1歩。

export const TICKS_PER_SEC = 10;

// 勇者。レベルで攻撃と最大HPが伸びる。攻撃は1秒に1回。歩いている間は少しずつ回復する。
export const HERO = Object.freeze({
  baseAtk: 5,
  atkPerLevel: 2,
  baseHp: 30,
  hpPerLevel: 10,
  regenPerSec: 2, // 歩いている間だけ
});

// 経験：レベル L から L+1 に要る量は xpBase × xpGrowth^(L−1)（切り上げ）。
export const XP = Object.freeze({ base: 10, growth: 1.6 });

// 支度ゲージ（単位は刻み）。出発するときは base から。
// 支度の出口に入れた物は、価値1あたり perValue 刻み伸びる。
export const PREP = Object.freeze({ base: 900, perValue: 50 });

// マージの盤（判定表 第1回 D1：5×4 から 7×6 まで）。
export const BOARD = Object.freeze({ w: 5, h: 4, maxW: 7, maxH: 6 });

// 出口。workshop（工房）は地域1のボスの後に開く（判定表 第1回 D6）。
export const EXITS = Object.freeze(['prep', 'grow', 'forge', 'workshop']);

// 地域（判定表 第1回 B4。名前は仮）。
// gap：敵の間の歩数。drain：1刻みに減る支度。bossAt：ボスまでの歩数。
// enemy：道の敵の強さ。i 体目は hp = hp + hpStep × i、atk = atk + floor(i / atkEvery)。
// drops：道の敵が順に落とす物（乱数なし。i 体目は drops[i % 長さ]）。
// unlocks：ボスを倒すと開く物（判定表 第1回 C5・E2）。
export const REGIONS = Object.freeze([
  {
    id: 1, name: '草原', wall: '素の敵', gap: 12, drain: 1, bossAt: 800,
    enemy: { hp: 8, hpStep: 0.5, atk: 1, atkEvery: 25 },
    boss: { name: '大きなスライム', hp: 200, atk: 3 },
    drops: [{ kind: 'iron', rank: 1 }, { kind: 'fire', rank: 1 }],
    unlocks: ['region:2', 'exit:workshop', 'crafter:merge', 'stage:forge'],
  },
  {
    id: 2, name: '坑道', wall: '群れ', gap: 30, drain: 1.5, bossAt: 1800,
    enemy: { hp: 40, hpStep: 2, atk: 3, atkEvery: 12 },
    boss: { name: '岩虫の群れ', hp: 900, atk: 8 },
    drops: [{ kind: 'iron', rank: 2 }, { kind: 'copper', rank: 1 }, { kind: 'stone', rank: 1 }],
    unlocks: ['region:3', 'crafter:forge', 'stage:dojo', 'school:guard', 'school:sword'],
  },
  {
    id: 3, name: '古い森', wall: '硬い殻', gap: 30, drain: 2, bossAt: 2100,
    enemy: { hp: 120, hpStep: 4, atk: 8, atkEvery: 10 },
    boss: { name: '甲羅の古木', hp: 3000, atk: 20 },
    drops: [{ kind: 'copper', rank: 2 }, { kind: 'ice', rank: 1 }, { kind: 'wind', rank: 1 }],
    unlocks: ['region:4', 'disciple', 'school:magic', 'school:bow'],
  },
  {
    id: 4, name: '雪山', wall: '盾（多段）', gap: 30, drain: 2.5, bossAt: 2400,
    enemy: { hp: 350, hpStep: 8, atk: 20, atkEvery: 10 },
    boss: { name: '氷の門番', hp: 9000, atk: 50 },
    drops: [{ kind: 'mithril', rank: 1 }, { kind: 'ice', rank: 2 }, { kind: 'thunder', rank: 1 }],
    unlocks: ['region:5', 'split', 'school:summon', 'school:stealth'],
  },
  {
    id: 5, name: '沼地', wall: '回復する敵', gap: 30, drain: 3, bossAt: 2700,
    enemy: { hp: 1000, hpStep: 20, atk: 50, atkEvery: 8 },
    boss: { name: '沼の主', hp: 27000, atk: 120 },
    drops: [{ kind: 'mithril', rank: 2 }, { kind: 'dragon', rank: 1 }, { kind: 'thunder', rank: 2 }],
    unlocks: ['region:6'],
  },
  {
    id: 6, name: '魔王の城', wall: '属性と全部', gap: 30, drain: 3.5, bossAt: 3000,
    enemy: { hp: 3000, hpStep: 50, atk: 120, atkEvery: 8 },
    boss: { name: '魔王', hp: 90000, atk: 300 },
    drops: [{ kind: 'dragon', rank: 2 }, { kind: 'star', rank: 1 }, { kind: 'fire', rank: 3 }],
    unlocks: ['ending'],
  },
]);

// 盤に出る物の種類（判定表 第1回 D2：地金の鉱石と属性の欠片）。
export const KINDS = Object.freeze({
  iron: { name: '鉄鉱', group: 'ore' },
  copper: { name: '銅鉱', group: 'ore' },
  mithril: { name: '魔銀', group: 'ore' },
  dragon: { name: '竜の鱗', group: 'ore' },
  star: { name: '星鉄', group: 'ore' },
  fire: { name: '炎の欠片', group: 'shard' },
  ice: { name: '氷の欠片', group: 'shard' },
  thunder: { name: '雷の欠片', group: 'shard' },
  wind: { name: '風の欠片', group: 'shard' },
  stone: { name: '石の欠片', group: 'shard' },
});
