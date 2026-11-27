import { APP_VERSION } from '../version.js';
import { RANK_MAX, rankValue, mergeGain } from '../core/rank.js';

const rows = document.getElementById('rank-rows');
for (let r = 1; r <= RANK_MAX; r++) {
  const tr = document.createElement('tr');
  const rank = document.createElement('td');
  rank.textContent = String(r);
  const value = document.createElement('td');
  value.textContent = rankValue(r).toLocaleString('ja-JP');
  tr.append(rank, value);
  rows.append(tr);
}

document.getElementById('gain3').textContent = String(mergeGain(3));
document.getElementById('gain5').textContent = String(mergeGain(5));
document.getElementById('version').textContent = APP_VERSION;
