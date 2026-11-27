// localStorage への保存。形が変わったら SAVE_VERSION を上げる（古い保存は読まずに始めからにする）。
// 試すとき（?test=…）は本番と別の場所に保存する。
import { APP_VERSION } from '../version.js';
import { STATE_VERSION } from '../core/game.js';

const BASE = 'workshop-wayfarer:save';
const SAVE_VERSION = 2;

function keyOf(slot) {
  return slot ? `${BASE}:${slot}` : BASE;
}

export function load(slot) {
  try {
    const raw = localStorage.getItem(keyOf(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== SAVE_VERSION || !data.state || data.state.version !== STATE_VERSION) return null;
    return { state: data.state, meta: data.meta ?? {} };
  } catch {
    return null;
  }
}

export function save(state, meta, slot) {
  try {
    localStorage.setItem(keyOf(slot), JSON.stringify({ v: SAVE_VERSION, app: APP_VERSION, state, meta }));
  } catch {
    // 保存できなくても遊べる
  }
}

export function clear(slot) {
  try {
    localStorage.removeItem(keyOf(slot));
  } catch {
    // 何もしない
  }
}
