// localStorage への保存。形が変わったら SAVE_VERSION を上げる（古い保存は読まずに始めからにする）。
import { APP_VERSION } from '../version.js';

const KEY = 'workshop-wayfarer:save';
const SAVE_VERSION = 1;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== SAVE_VERSION || !data.state || data.state.version !== 1) return null;
    return { state: data.state, meta: data.meta ?? {} };
  } catch {
    return null;
  }
}

export function save(state, meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, app: APP_VERSION, state, meta }));
  } catch {
    // 保存できなくても遊べる
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}
