// 道場の流派（判定表 第13回 A3）。流派ごとに木と巻物の種類が違う。開くのは school:<id> の鍵（地域のボス）。
import { GUARD_TREE, TECHS } from './dojo.js';
import { SWORD_TREE, SWORD_TECHS } from './sword.js';
import { MAGIC_TREE, MAGIC_TECHS } from './magic.js';
import { BOW_TREE, BOW_TECHS } from './bow.js';
import { SUMMON_TREE, SUMMON_TECHS } from './summon.js';
import { STEALTH_TREE, STEALTH_TECHS } from './stealth.js';

export const SCHOOLS = Object.freeze({
  guard: { name: '守り', puzzle: 'mines', tree: GUARD_TREE, branches: ['根', '受け', '返し', '息吹', '奥'], techs: TECHS },
  sword: { name: '剣', puzzle: 'nono', tree: SWORD_TREE, branches: ['根', '速さ', '重さ', '刃', '奥'], techs: SWORD_TECHS },
  magic: { name: '魔法', puzzle: 'sudo', tree: MAGIC_TREE, branches: ['根', '炎', '水氷', '雷', '奥'], techs: MAGIC_TECHS },
  bow: { name: '弓', puzzle: 'beam', tree: BOW_TREE, branches: ['根', '速射', '狙い', '風', '奥'], techs: BOW_TECHS },
  summon: { name: '召喚', puzzle: 'rooms', tree: SUMMON_TREE, branches: ['根', '獣', '精霊', '守護', '奥'], techs: SUMMON_TECHS },
  stealth: { name: '隠密', puzzle: 'lamps', tree: STEALTH_TREE, branches: ['根', '毒', '影', '煙', '奥'], techs: STEALTH_TECHS },
});

export const ALL_NODES = Object.freeze([...GUARD_TREE, ...SWORD_TREE, ...MAGIC_TREE, ...BOW_TREE, ...SUMMON_TREE, ...STEALTH_TREE]);
export const ALL_TECHS = Object.freeze({ ...TECHS, ...SWORD_TECHS, ...MAGIC_TECHS, ...BOW_TECHS, ...SUMMON_TECHS, ...STEALTH_TECHS });
