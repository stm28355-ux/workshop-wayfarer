// 段2 打ち分け（装備作り）の数値（判定表 第3回・第4回。全部仮で、遊んでから直す）。

// 格 n を打つのに使う素材の価値：GEAR.cost × 3^(n−1)。基本の数値は格ごとに2倍。
// 同じ種類で格が同じか下を打つと「打った格の基本 × addRate × 出来」を足す（格ごとに addCap 回まで）。
// 格が上を打つと、それまでの加算を全部引き継いで格が上の物になる。
export const GEAR = Object.freeze({
  cost: 30,
  costRatio: 3,
  baseRatio: 2,
  addRate: 0.25,
  addCap: 4,
  // 出来：出来の合計 ÷ 満点 で基本の minQ〜1、会心（全部◎）は crit。
  minQ: 0.5,
  crit: 1.2,
  // 今の工程で打てる格の上限（格3からの9マスの盤は後の工程で足す）。
  tierMax: 2,
});

export function gearCost(tier) {
  return GEAR.cost * GEAR.costRatio ** (tier - 1);
}

// 部類。鉱石からは武器と防具、欠片からはアクセサリー（判定表 第4回 A1）。
export const SLOTS = Object.freeze({
  weapon: { name: '武器', group: 'ore' },
  armor: { name: '防具', group: 'ore' },
  accessory: { name: 'アクセサリー', group: 'shard' },
});

// 叩き方（判定表 第3回 C）。amount は赤熱のときの伸び。灼熱は2倍、暗赤は半分（切り捨て）。
// shape：one＝1マス、vertical＝縦2マス（下の段を押したら上と2マス）。
export const STRIKES = Object.freeze({
  tap: { name: 'たたく', shape: 'one', amount: 2, cost: 1 },
  heavy: { name: '強打', shape: 'one', amount: 4, cost: 2 },
  vertical: { name: '縦打ち', shape: 'vertical', amount: 2, cost: 2 },
});
export const TEMPS = Object.freeze([
  { name: '灼熱', mult: 2 },
  { name: '赤熱', mult: 1 },
  { name: '暗赤', mult: 0.5 },
]);
// 炎の欠片は入れた価値 FIRE_PER ごとに「火を足す」を1回使える（集中力は減らない）。
export const FIRE_PER = 3;

// 盤の大きさ（判定表 第4回 B2：格2つごとに広がる）。今は格1〜2の6マスだけ。
export const BANDS = Object.freeze([{ id: 1, tiers: [1, 2], w: 2, h: 3, cap: 16 }]);

export function bandOf(tier) {
  return BANDS.find((b) => b.tiers.includes(tier)) ?? null;
}

// 素材ごとの装備。perLevel は1段の温度で叩ける回数（鉄は3回、銅は冷めにくく4回）。
// targets は盤ごとの各マスの目標の真ん中（帯は ±1）。左上から読む順。tools/forge-solve.mjs で会心に届くかを確かめた：
// 鉄と炎・石は「集中力14＋火1回か、集中力16」で会心（炎の腕輪は12＋火1回）。銅は冷めにくく、火は要らないが集中力16が要る。
// weapon：atk＝攻撃の倍率（鉄の剣を1）、ticks＝攻撃の間（刻み）、recast＝積み直しの秒（技の並びから効く）。
// armor：stat＝'hp'（鎧：HP が伸びる）か 'guard'（盾：1回に受けるダメージを引く）。
// accessory：stat＝'atk'（攻撃 +%）か 'regen'（歩く間の回復 +%）。
export const GEAR_KINDS = Object.freeze({
  iron: {
    perLevel: 3,
    weapon: { name: '鉄の剣', atk: 1.0, ticks: 10, recast: 3, targets: { 1: [7, 9, 8, 6, 5, 4] } },
    armor: { name: '鉄の鎧', stat: 'hp', targets: { 1: [6, 9, 8, 7, 5, 4] } },
  },
  copper: {
    perLevel: 4,
    weapon: { name: '銅の槌', atk: 1.5, ticks: 14, recast: 4, targets: { 1: [9, 7, 8, 10, 5, 5] } },
    armor: { name: '銅の盾', stat: 'guard', targets: { 1: [8, 9, 9, 8, 6, 5] } },
  },
  fire: {
    perLevel: 3,
    accessory: { name: '炎の腕輪', stat: 'atk', targets: { 1: [5, 7, 6, 4, 3, 5] } },
  },
  stone: {
    perLevel: 3,
    accessory: { name: '石の護符', stat: 'regen', targets: { 1: [6, 7, 7, 6, 5, 5] } },
  },
});

// 格1の基本の数値（出来100%のとき）。格ごとに baseRatio 倍。
// weapon：攻撃に足す数（さらに武器の atk 倍率を掛ける）。hp：最大 HP に足す数。guard：1回に受けるダメージから引く数。
// atk・regen：割合（0.05＝5%）。
export const GEAR_BASE = Object.freeze({ weapon: 6, hp: 30, guard: 2, atk: 0.05, regen: 0.1 });

// 打ち分けの職人（地域3のボスで来る）。手で出した一番の手順を、この間隔で1回繰り返す。
export const FORGE_CRAFTER = Object.freeze({ everyTicks: 100 });
