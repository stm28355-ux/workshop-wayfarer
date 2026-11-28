// 絵（判定表 第22回：絵柄 A＝16×16 のかっこいいドット絵。落ち着いた色・暗い縁・物に顔なし）。工程8。
// 盤の素材・勇者・敵とボス・装備・使い道の建物。絵は SVG の文字列で返し、同じ絵は覚えておく。
import { grid, toSvg } from './pixel.js';

const C = {
  ink: '#14161b',
  iron: '#6f7a86', ironL: '#9aa6b2', ironD: '#4b535d', glint: '#dfe8ef',
  copper: '#b8703a', copperL: '#d9955a', copperD: '#7e4a26', patina: '#5fa38a',
  mith: '#9fc4dc', mithL: '#d6ecf7', mithD: '#6b93ad',
  scale: '#4f9a68', scaleL: '#7cc58f', scaleD: '#2f6a45',
  star: '#3a3550', starL: '#5d567a', starGold: '#f2cf5a',
  fire: '#d9502f', fireL: '#f08a3a', fireY: '#ffd166', fireD: '#9e3220',
  ice: '#5fa8d3', iceL: '#a9dcf2', iceD: '#3b7aa3',
  thunder: '#d9b030', thunderL: '#f5e17a', thunderD: '#9a7a1c',
  wind: '#5fb07a', windL: '#a7dfb5', windD: '#3c7c52',
  stone: '#8a7559', stoneL: '#b09a7a', stoneD: '#5e4e3a',
  steel: '#b8c2cc', steelL: '#e6edf2', steelD: '#7d8792', hilt: '#6b4428', hiltL: '#94643c', gold: '#d6a94a',
  cape: '#2f5d9a', capeD: '#22457a', armor: '#8f9aa6', armorL: '#c3ccd5', visor: '#1b1f26',
  slime: '#3f8f5a', slimeL: '#69b77d', slimeD: '#2b6a41', eye: '#e9f56a', red: '#c8402e',
  grub: '#a08a6a', grubL: '#c4ad87', grubD: '#6f5d44',
  beetle: '#365f6e', beetleL: '#5a8b9b', bark: '#5a4330', barkL: '#7d6047', leaf: '#3d6b3a',
  shield: '#7d8792', shieldL: '#b8c2cc', crest: '#9a3b2e',
  frost: '#9fd6ee', frostL: '#e3f6ff', frostD: '#5e9fc0',
  shade: '#3b3550', shadeL: '#5f5880', bog: '#4f6a3a', bogL: '#7a9450', bogD: '#334827',
  dark: '#2a2433', darkL: '#463c55', horn: '#c9c0a8', lord: '#5a1f2c', lordL: '#8a3040', glowR: '#ff5d5d',
  roof: '#8a3b2c', roofL: '#b0533f', wall: '#7c7466', wallL: '#a39a89', door: '#4a2f1d', smoke: '#9aa0a8', window: '#ffb347',
  tent: '#6d5a3a', tentL: '#9a8155', bag: '#8a6a3c', bagL: '#b48d55', anvil: '#4b535d', anvilL: '#7d8792', dummy: '#9a7a4a',
  cloth: '#6a4c8a', clothL: '#9a7ab8', feather: '#d8e8d0',
};

// ───── 盤の素材 ─────
const ore = (b, l, d, extra) => (g) => {
  g.ellipse(8, 9, 6, 4.5, b).ellipse(6, 7, 3, 2, l).tint(2, 11, 14, 14, d);
  if (extra) extra(g);
  return g.outline(C.ink);
};
const shard = (b, l, y, d, extra) => (g) => {
  g.poly([[8, 1], [12, 7], [9, 15], [5, 9]], b).poly([[8, 1], [12, 7], [9, 8]], l).line(8, 3, 8, 11, y).tint(5, 11, 12, 15, d);
  if (extra) extra(g);
  return g.outline(C.ink);
};
const MATERIAL = {
  iron: ore(C.iron, C.ironL, C.ironD, (g) => g.px1(5, 6, C.glint).px1(10, 8, C.glint).px1(11, 7, C.glint)),
  copper: ore(C.copper, C.copperL, C.copperD, (g) => g.px1(10, 8, C.patina).px1(11, 9, C.patina).px1(5, 11, C.patina).px1(6, 6, C.glint)),
  mithril: ore(C.mith, C.mithL, C.mithD, (g) => g.px1(5, 6, '#ffffff').px1(10, 7, '#ffffff').line(9, 9, 11, 9, C.mithL).px1(13, 4, C.mithL).px1(13, 2, C.mithL).px1(12, 3, C.mithL).px1(14, 3, C.mithL)),
  dragon: (g) => g.ellipse(8, 9, 6, 5, C.scale).ellipse(8, 6, 4, 2, C.scaleL)
    .line(3, 9, 13, 9, C.scaleD).line(4, 12, 12, 12, C.scaleD).px1(8, 9, C.scaleL).px1(5, 11, C.scaleL).px1(11, 11, C.scaleL).outline(C.ink),
  star: ore(C.star, C.starL, '#26213a', (g) => g.px1(6, 7, C.starGold).px1(10, 9, C.starGold).px1(9, 8, C.starGold).px1(11, 10, C.starGold).px1(10, 10, C.starGold).px1(7, 11, C.starL)),
  fire: shard(C.fire, C.fireL, C.fireY, C.fireD),
  ice: shard(C.ice, C.iceL, '#eaf8ff', C.iceD),
  thunder: shard(C.thunder, C.thunderL, '#fff6c2', C.thunderD, (g) => g.line(7, 5, 9, 7, C.thunderD).line(9, 7, 7, 9, C.thunderD).line(7, 9, 9, 11, C.thunderD)),
  wind: shard(C.wind, C.windL, '#e2f7e8', C.windD, (g) => g.px1(7, 6, C.windD).px1(8, 5, C.windD).px1(9, 6, C.windD).px1(8, 7, C.windL)),
  stone: (g) => g.poly([[3, 12], [4, 6], [8, 3], [13, 5], [14, 11], [9, 14]], C.stone).poly([[4, 6], [8, 3], [10, 7], [6, 9]], C.stoneL)
    .tint(3, 12, 14, 14, C.stoneD).px1(11, 9, C.stoneD).px1(7, 11, C.stoneL).outline(C.ink),
};

// ───── 勇者（立ち・歩き・打つ） ─────
function heroBase(g, legs) {
  g.rect(4, 8, 11, 14, C.cape).rect(4, 13, 11, 14, C.capeD)
    .rect(5, 7, 10, 12, C.armor).rect(6, 7, 9, 8, C.armorL)
    .ellipse(7.5, 4, 3, 3, C.armor).rect(5, 1, 10, 2, C.armorL).rect(5, 4, 10, 4, C.visor);
  if (legs === 0) g.rect(5, 13, 6, 15, C.armorL).rect(9, 13, 10, 15, C.armorL);
  else g.rect(4, 13, 5, 15, C.armorL).rect(10, 13, 11, 14, C.armorL);
  return g;
}
const HERO = {
  stand: (g) => heroBase(g, 0).line(12, 2, 12, 10, C.steelL).rect(11, 10, 13, 10, C.gold).px1(12, 11, C.hilt).outline(C.ink),
  walk: (g) => heroBase(g, 1).line(12, 3, 12, 11, C.steelL).rect(11, 11, 13, 11, C.gold).px1(12, 12, C.hilt).outline(C.ink),
  strike: (g) => heroBase(g, 0).line(10, 8, 15, 3, C.steelL).line(10, 9, 15, 4, C.steel).rect(9, 9, 10, 10, C.gold).outline(C.ink),
};

// ───── 敵とボス（地域ごと。ボスは大きく見せる） ─────
const ENEMY = {
  1: (g) => g.ellipse(8, 10, 6, 4.5, C.slime).ellipse(8, 7, 4, 3, C.slime).ellipse(6, 7, 2, 1.5, C.slimeL).tint(2, 13, 14, 15, C.slimeD)
    .rect(5, 9, 6, 9, C.eye).rect(9, 9, 10, 9, C.eye).outline(C.ink),
  2: (g) => g.ellipse(4, 12, 3, 2, C.grub).ellipse(11, 12, 3, 2, C.grub).ellipse(8, 7, 3.5, 2.5, C.grub)
    .px1(3, 11, C.grubL).px1(10, 11, C.grubL).px1(7, 6, C.grubL).line(1, 13, 7, 13, C.grubD).line(8, 13, 14, 13, C.grubD)
    .px1(5, 12, C.red).px1(12, 12, C.red).px1(9, 7, C.red).outline(C.ink),
  3: (g) => g.ellipse(8, 9, 6, 5, C.beetle).ellipse(6, 7, 3, 2, C.beetleL).line(8, 4, 8, 14, C.ink)
    .line(2, 13, 1, 15, C.ink).line(14, 13, 15, 15, C.ink).line(5, 4, 4, 1, C.ink).line(11, 4, 12, 1, C.ink).outline(C.ink),
  4: (g) => g.ellipse(7, 4, 2.5, 2.5, C.armor).rect(5, 4, 9, 4, C.visor).rect(5, 7, 9, 13, C.armor).rect(5, 14, 6, 15, C.armorL).rect(8, 14, 9, 15, C.armorL)
    .rect(9, 5, 14, 13, C.shield).rect(10, 6, 13, 12, C.shieldL).rect(11, 7, 12, 11, C.crest).outline(C.ink),
  5: (g) => g.ellipse(8, 8, 5, 6, C.shade).ellipse(7, 6, 3, 3, C.shadeL).poly([[3, 12], [5, 15], [8, 12], [11, 15], [13, 12]], C.shade)
    .rect(5, 7, 6, 7, C.eye).rect(9, 7, 10, 7, C.eye).outline(C.ink),
  6: (g) => g.ellipse(8, 4, 3, 3, C.dark).px1(5, 1, C.horn).px1(11, 1, C.horn).rect(6, 4, 10, 4, C.glowR)
    .rect(4, 7, 12, 13, C.dark).rect(5, 8, 11, 9, C.darkL).rect(5, 14, 6, 15, C.dark).rect(10, 14, 11, 15, C.dark)
    .line(13, 3, 13, 12, C.steelD).rect(12, 11, 14, 11, C.lordL).outline(C.ink),
};
const BOSS = {
  1: (g) => g.ellipse(8, 10, 7, 5, C.slime).ellipse(8, 6, 5, 4, C.slime).ellipse(5, 6, 2, 1.5, C.slimeL).tint(1, 13, 15, 15, C.slimeD)
    .rect(4, 9, 6, 9, C.eye).rect(10, 9, 12, 9, C.eye).rect(6, 1, 10, 2, C.gold).px1(6, 0, C.gold).px1(8, 0, C.gold).px1(10, 0, C.gold).outline(C.ink),
  2: (g) => g.ellipse(8, 10, 7, 4.5, C.grub).ellipse(8, 6, 4.5, 3.5, C.grubL).line(1, 12, 15, 12, C.grubD).line(2, 9, 14, 9, C.grubD)
    .px1(4, 4, C.grubD).px1(12, 4, C.grubD).px1(3, 3, C.ink).px1(13, 3, C.ink).rect(6, 6, 6, 6, C.red).rect(10, 6, 10, 6, C.red).outline(C.ink),
  3: (g) => g.rect(6, 6, 10, 15, C.bark).rect(7, 6, 8, 15, C.barkL).ellipse(8, 5, 6, 4, C.leaf).ellipse(5, 4, 2, 1.5, '#5a8f54')
    .ellipse(8, 11, 5, 3, C.beetle).ellipse(7, 10, 3, 1.5, C.beetleL).rect(6, 7, 6, 7, C.eye).rect(9, 7, 9, 7, C.eye).outline(C.ink),
  4: (g) => g.rect(3, 5, 12, 13, C.frost).rect(4, 6, 11, 7, C.frostL).ellipse(7.5, 3, 3, 2.5, C.frost).rect(6, 3, 9, 3, C.frostD)
    .rect(1, 6, 2, 11, C.frostD).rect(13, 6, 14, 11, C.frostD).rect(4, 14, 6, 15, C.frostD).rect(9, 14, 11, 15, C.frostD).px1(7, 9, C.frostL).outline(C.ink),
  5: (g) => g.ellipse(8, 10, 7, 5, C.bog).ellipse(8, 7, 5, 3, C.bogL).ellipse(4, 5, 2, 2, C.bog).ellipse(12, 5, 2, 2, C.bog)
    .rect(4, 5, 4, 5, C.eye).rect(12, 5, 12, 5, C.eye).line(3, 11, 13, 11, C.bogD).tint(1, 13, 15, 15, C.bogD).outline(C.ink),
  6: (g) => g.poly([[2, 15], [4, 7], [8, 5], [12, 7], [14, 15]], C.lord).poly([[4, 7], [8, 5], [8, 15], [5, 15]], C.lordL)
    .ellipse(8, 4, 2.5, 2.5, C.dark).line(5, 3, 4, 0, C.horn).line(11, 3, 12, 0, C.horn).rect(7, 4, 7, 4, C.glowR).rect(9, 4, 9, 4, C.glowR)
    .rect(6, 8, 10, 12, C.dark).px1(8, 10, C.glowR).outline(C.ink),
};

// ───── 装備 ─────
const GEAR_ART = {
  'iron:weapon': (g) => g.line(4, 11, 13, 2, C.steelL).line(4, 12, 13, 3, C.steel).line(5, 12, 14, 3, C.steelD).line(2, 10, 6, 14, C.gold).line(2, 13, 4, 11, C.hilt).outline(C.ink),
  'iron:armor': (g) => g.rect(4, 3, 11, 13, C.armor).rect(5, 4, 10, 6, C.armorL).rect(2, 3, 3, 7, C.armor).rect(12, 3, 13, 7, C.armor).clear(7, 2, 8, 4).line(7, 8, 7, 12, C.steelD).outline(C.ink),
  'copper:weapon': (g) => g.rect(3, 2, 12, 6, C.copper).rect(3, 2, 12, 3, C.copperL).line(8, 7, 8, 14, C.hilt).px1(8, 15, C.hiltL).outline(C.ink),
  'copper:armor': (g) => g.ellipse(8, 8, 6, 6.5, C.copper).ellipse(8, 8, 4, 4.5, C.copperL).ellipse(8, 8, 1.5, 1.5, C.copperD).px1(5, 4, C.patina).outline(C.ink),
  'mithril:weapon': (g) => g.line(4, 14, 11, 4, C.hilt).line(5, 14, 12, 4, C.hiltL).ellipse(12, 3, 2, 2, C.mith).px1(12, 2, '#ffffff').outline(C.ink),
  'mithril:armor': (g) => g.poly([[5, 2], [11, 2], [13, 15], [3, 15]], C.cloth).poly([[5, 2], [8, 2], [8, 15], [3, 15]], C.clothL).line(5, 6, 11, 6, C.mith).outline(C.ink),
  'dragon:weapon': (g) => g.line(2, 12, 9, 3, C.scaleL).line(7, 12, 14, 3, C.scaleL).line(2, 13, 9, 4, C.scale).line(7, 13, 14, 4, C.scale).rect(1, 12, 3, 14, C.hilt).rect(6, 12, 8, 14, C.hilt).outline(C.ink),
  'dragon:armor': (g) => g.rect(4, 3, 11, 13, C.scale).line(4, 6, 11, 6, C.scaleD).line(4, 9, 11, 9, C.scaleD).line(4, 12, 11, 12, C.scaleD).px1(6, 5, C.scaleL).px1(9, 8, C.scaleL).clear(7, 2, 8, 3).outline(C.ink),
  'star:weapon': (g) => g.poly([[3, 13], [12, 2], [14, 4], [5, 15]], C.star).line(4, 13, 12, 3, C.starL).px1(9, 7, C.starGold).px1(7, 9, C.starGold).line(1, 11, 5, 15, C.gold).outline(C.ink),
  'star:armor': (g) => g.poly([[3, 2], [13, 2], [13, 9], [8, 15], [3, 9]], C.star).poly([[5, 4], [11, 4], [11, 8], [8, 12], [5, 8]], C.starL).px1(8, 7, C.starGold).px1(7, 6, C.starGold).px1(9, 8, C.starGold).outline(C.ink),
  'fire:accessory': (g) => g.ellipse(8, 9, 5, 4, C.gold).ellipse(8, 9, 3, 2, null).clear(6, 8, 10, 10).ellipse(8, 5, 2, 2, C.fire).px1(8, 4, C.fireY).outline(C.ink),
  'stone:accessory': (g) => g.line(4, 2, 8, 7, C.hilt).line(12, 2, 8, 7, C.hilt).poly([[8, 7], [12, 10], [8, 15], [4, 10]], C.stone).px1(7, 9, C.stoneL).outline(C.ink),
  'ice:accessory': (g) => g.line(3, 2, 8, 9, C.steelD).line(13, 2, 8, 9, C.steelD).poly([[8, 8], [11, 11], [8, 15], [5, 11]], C.ice).px1(7, 10, C.iceL).outline(C.ink),
  'wind:accessory': (g) => g.line(4, 14, 12, 2, C.hilt).ellipse(9, 7, 3, 5, C.wind).ellipse(8, 6, 1.5, 3.5, C.feather).line(5, 12, 11, 3, C.windD).outline(C.ink),
  'thunder:accessory': (g) => g.ellipse(8, 3, 2, 2, C.gold).clear(8, 3, 8, 3).poly([[9, 5], [6, 10], [8, 10], [6, 15], [11, 8], [9, 8], [11, 5]], C.thunder).px1(8, 8, C.thunderL).outline(C.ink),
};

// ───── 使い道の建物 ─────
const EXIT_ART = {
  prep: (g) => g.poly([[1, 14], [8, 3], [15, 14]], C.tent).poly([[1, 14], [8, 3], [8, 14]], C.tentL).rect(7, 9, 9, 14, C.door).rect(12, 11, 14, 14, C.bag).px1(13, 11, C.bagL).outline(C.ink),
  grow: (g) => g.rect(7, 4, 8, 14, C.dummy).rect(3, 6, 12, 7, C.dummy).ellipse(7.5, 3, 2.5, 2.5, C.bagL).rect(5, 8, 10, 11, C.bag).line(2, 15, 13, 15, C.hilt).outline(C.ink),
  forge: (g) => g.rect(2, 8, 13, 10, C.anvilL).rect(4, 11, 11, 12, C.anvil).rect(6, 13, 9, 15, C.anvil).px1(1, 8, C.anvilL).rect(12, 3, 14, 4, C.hilt).line(13, 5, 10, 7, C.hilt).px1(5, 6, C.fireY).px1(7, 5, C.fireL).outline(C.ink),
  workshop: (g) => g.rect(2, 7, 13, 14, C.wall).rect(3, 8, 12, 8, C.wallL).poly([[1, 8], [8, 2], [15, 8]], C.roof).poly([[1, 8], [8, 2], [8, 8]], C.roofL)
    .rect(11, 1, 12, 5, C.wallL).rect(6, 10, 9, 14, C.door).rect(3, 10, 4, 11, C.window).rect(11, 10, 12, 11, C.window).outline(C.ink),
};

const cache = new Map();
function draw(key, fn, size, cls) {
  const k = `${key}|${size}|${cls}`;
  if (!cache.has(k)) cache.set(k, toSvg(fn(grid(16)), size, cls));
  return cache.get(k);
}

export function materialArt(kind, size = 32) {
  return MATERIAL[kind] ? draw(`m:${kind}`, MATERIAL[kind], size, 'px') : '';
}
export function heroArt(pose = 'stand', size = 48) {
  return draw(`h:${pose}`, HERO[pose] ?? HERO.stand, size, `px hero-${pose}`);
}
export function enemyArt(regionId, boss = false, size = 48) {
  const set = boss ? BOSS : ENEMY;
  const fn = set[regionId] ?? set[1];
  return draw(`${boss ? 'b' : 'e'}:${regionId}`, fn, size, 'px');
}
export function gearArt(kind, slot, size = 24) {
  const fn = GEAR_ART[`${kind}:${slot}`];
  return fn ? draw(`g:${kind}:${slot}`, fn, size, 'px') : '';
}
export function exitArt(exit, size = 36) {
  return EXIT_ART[exit] ? draw(`x:${exit}`, EXIT_ART[exit], size, 'px') : '';
}
export const ART_KEYS = Object.freeze({
  materials: Object.keys(MATERIAL), enemies: Object.keys(ENEMY), bosses: Object.keys(BOSS), gear: Object.keys(GEAR_ART), exits: Object.keys(EXIT_ART),
});
