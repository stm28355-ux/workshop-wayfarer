// 工程8：絵（絵柄 A）と背景。どの素材・敵・装備・使い道・地域にも絵がある。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialArt, heroArt, enemyArt, gearArt, exitArt } from '../src/art/sprites.js';
import { sceneArt } from '../src/art/scenes.js';
import { KINDS, REGIONS } from '../src/data/balance.js';
import { GEAR_KINDS } from '../src/data/forge.js';

const isSvg = (s) => typeof s === 'string' && s.startsWith('<svg') && s.includes('<rect');

test('盤の素材は全部絵がある', () => {
  for (const k of Object.keys(KINDS)) assert.ok(isSvg(materialArt(k)), k);
});

test('勇者は立ち・歩き・打つの3つ、敵とボスは地域ごと', () => {
  for (const p of ['stand', 'walk', 'strike']) assert.ok(isSvg(heroArt(p)), p);
  for (const r of REGIONS) {
    assert.ok(isSvg(enemyArt(r.id, false)), `敵 ${r.id}`);
    assert.ok(isSvg(enemyArt(r.id, true)), `ボス ${r.id}`);
    assert.ok(isSvg(sceneArt(r.id)), `背景 ${r.id}`);
  }
});

test('装備は全部絵がある。使い道の建物4つ', () => {
  for (const [kind, def] of Object.entries(GEAR_KINDS)) for (const slot of ['weapon', 'armor', 'accessory']) if (def[slot]) assert.ok(isSvg(gearArt(kind, slot)), `${kind} ${slot}`);
  for (const x of ['prep', 'grow', 'forge', 'workshop']) assert.ok(isSvg(exitArt(x)), x);
});
