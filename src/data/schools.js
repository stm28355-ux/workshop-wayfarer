// 道場の流派（判定表 第13回 A3）。流派ごとに木と巻物の種類が違う。開くのは school:<id> の鍵（地域のボス）。
import { GUARD_TREE, TECHS } from './dojo.js';
import { SWORD_TREE, SWORD_TECHS } from './sword.js';

export const SCHOOLS = Object.freeze({
  guard: { name: '守り', puzzle: 'mines', tree: GUARD_TREE, branches: ['根', '受け', '返し', '息吹', '奥'], techs: TECHS },
  sword: { name: '剣', puzzle: 'nono', tree: SWORD_TREE, branches: ['根', '速さ', '重さ', '刃', '奥'], techs: SWORD_TECHS },
});

export const ALL_NODES = Object.freeze([...GUARD_TREE, ...SWORD_TREE]);
export const ALL_TECHS = Object.freeze({ ...TECHS, ...SWORD_TECHS });
