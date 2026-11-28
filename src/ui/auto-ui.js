// 工程6の画面：振り分け（出口の下）・門下生（道場の上）・帳簿（上のボタンで開く）。判定表 第11回。
// ルールは src/core の関数を呼ぶだけ。
import { isOpen, region, setSplit, nudgeSplit } from '../core/game.js';
import { levelOf, nodeOf, discipleTicks, setDiscipleBranch, shapeName, DISCIPLE_BRANCHES } from '../core/dojo.js';
import { heroStats } from '../core/gear.js';
import { activeCards, slotCount, compareDummy } from '../core/lineup.js';
import { PLAN, planOfRegion } from '../core/plan.js';
import { TICKS_PER_SEC, SPLIT, EXITS } from '../data/balance.js';

const $ = (id) => document.getElementById(id);
const EXIT_NAMES = { prep: '支度', grow: '育てる', forge: '装備作り', workshop: '工房' };
// 門下生の枝の呼び名。all 以外は枝の名前そのまま（流派を足しても undefined にならないように）
const BRANCH_NAMES = { all: '全部' };
// 帳簿の木人：地域の壁に合わせる
const DUMMY_OF = { 1: 'plain', 2: 'swarm', 3: 'shell', 4: 'plain', 5: 'regen', 6: 'plain' };
const DUMMY_NAME = { plain: '素', swarm: '群れ', shell: '殻', regen: '回復' };

function clock(ticks) {
  const t = Math.floor(ticks / TICKS_PER_SEC);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}時間${String(m).padStart(2, '0')}分` : `${m}分${String(s).padStart(2, '0')}秒`;
}
const minText = (min) => (min >= 60 ? `${Math.floor(min / 60)}時間${String(min % 60).padStart(2, '0')}分` : `${min}分`);

export function createAutoUI({ get, set, log }) {
  // ───── 振り分け ─────
  let lastSplit = '';
  function renderSplit(s) {
    const el = $('split');
    const open = isOpen(s, 'split');
    el.hidden = !open;
    if (!open) return;
    const sp = s.split;
    const rows = EXITS.map((x) => [x, sp.ratio[x], s.open.exits.includes(x), sp.fed[x]]);
    const key = JSON.stringify([rows, sp.on, sp.minRank]);
    if (key === lastSplit) return;
    lastSplit = key;
    const total = EXITS.reduce((a, x) => a + sp.fed[x], 0);
    el.innerHTML = `<h3>振り分け <button type="button" class="mini" data-sact="on" aria-pressed="${sp.on}">${sp.on ? '動いている（止める）' : '止めている（動かす）'}</button></h3>` +
      `<p class="small quiet">ランク${sp.minRank}以上の物を${SPLIT.everyTicks / TICKS_PER_SEC}秒に1個、割合に一番足りない出口へ。` +
      ` <span class="nowrap">出すランク <button type="button" class="mini" data-sact="rank" data-dir="-1" aria-label="出すランクを下げる">−</button> <b class="num">${sp.minRank}</b> <button type="button" class="mini" data-sact="rank" data-dir="1" aria-label="出すランクを上げる">＋</button></span></p>` +
      '<div class="split-rows">' +
      rows.map(([x, r, op, fed]) => `<div class="split-row${op ? '' : ' locked'}"><span>${EXIT_NAMES[x]}</span>` +
        `<button type="button" class="mini" data-sact="nudge" data-exit="${x}" data-dir="-1" aria-label="${EXIT_NAMES[x]}を10%減らす" ${r <= 0 ? 'disabled' : ''}>−</button>` +
        `<b class="num">${r * 10}%</b>` +
        `<button type="button" class="mini" data-sact="nudge" data-exit="${x}" data-dir="1" aria-label="${EXIT_NAMES[x]}を10%増やす" ${r >= 10 ? 'disabled' : ''}>＋</button>` +
        `<small class="num quiet">${total ? `入れた ${Math.round((fed / total) * 100)}%` : ''}</small></div>`).join('') +
      '</div>';
  }
  $('split').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sact]');
    if (!b) return;
    const s = get();
    let r;
    if (b.dataset.sact === 'on') r = setSplit(s, { on: !s.split.on });
    if (b.dataset.sact === 'rank') r = setSplit(s, { minRank: s.split.minRank + Number(b.dataset.dir) });
    if (b.dataset.sact === 'nudge') r = nudgeSplit(s, b.dataset.exit, Number(b.dataset.dir));
    if (r?.ok) set(r.state);
    else if (r?.reason) log(r.reason);
    lastSplit = '';
    renderSplit(get());
  });

  // ───── 門下生 ─────
  let lastDisciple = '';
  function renderDisciple(s) {
    const el = $('disciple');
    const open = isOpen(s, 'disciple');
    el.hidden = !open;
    if (!open) return;
    const w = s.dojo.disciple ?? { branch: 'all', node: null, cd: 0 };
    const sec = Math.ceil(w.cd / TICKS_PER_SEC);
    const doing = w.node
      ? `<b>${nodeOf(w.node).name}</b>（${levelOf(s, w.node)}/5）の巻物を解いている　あと <span class="num">${sec}</span>秒`
      : '解ける節がない（人が一度解いた形の巻物だけ解ける）';
    const shapes = (s.dojo.shapes ?? []).map(shapeName);
    const key = JSON.stringify([doing, w.branch, shapes, discipleTicks(s), s.stats.discipleScrolls]);
    if (key === lastDisciple) return;
    lastDisciple = key;
    el.innerHTML = `<p><b>門下生</b>：${doing}</p>` +
      `<p class="small">${Math.round(discipleTicks(s) / TICKS_PER_SEC)}秒に1枚・熟練2。解いた ${s.stats.discipleScrolls ?? 0}枚。どの枝から：` +
      DISCIPLE_BRANCHES.map((b) => `<button type="button" class="mini" data-wact="branch" data-branch="${b}" aria-pressed="${w.branch === b}">${BRANCH_NAMES[b] ?? b}</button>`).join(' ') + '</p>' +
      `<p class="small quiet">解ける形：${shapes.length ? shapes.join('・') : 'まだない'}</p>`;
  }
  $('disciple').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wact="branch"]');
    if (!b) return;
    const r = setDiscipleBranch(get(), b.dataset.branch);
    if (r.ok) set(r.state);
    lastDisciple = '';
    renderDisciple(get());
  });

  // ───── 帳簿 ─────
  const dlg = $('ledger');
  let dummyCache = { key: '', html: '' };
  function techRow(s) {
    const id = s.run.region;
    const cards = activeCards(s, id);
    const type = DUMMY_OF[id] ?? 'plain';
    const key = JSON.stringify([cards, s.hero.level, s.gear, s.dojo.nodes, type]);
    if (dummyCache.key === key) return dummyCache.html;
    const plain = compareDummy(s, cards, 'plain', 20).ratio;
    const wall = type === 'plain' ? plain : compareDummy(s, cards, type, 20).ratio;
    const html = `並びなしとの比　素 ×${(plain ?? 1).toFixed(2)}${type !== 'plain' ? `・${DUMMY_NAME[type]} ×${(wall ?? 1).toFixed(2)}` : ''}`;
    dummyCache = { key, html };
    return html;
  }
  function gearTier(s, slot) {
    const k = s.gear.equip[slot];
    return k ? s.gear.items[k].tier : 0;
  }
  function ledgerHtml(s) {
    const st = s.stats;
    const now = s.run.region;
    let h = `<p>遊んだ時間 <b class="num">${clock(s.tick)}</b>　今は地域${now}「${region(now).name}」</p>`;
    // 予定表と今（C2）
    h += '<h3>予定表と比べる</h3><table class="ledger-table"><thead><tr><th>地域</th><th>ボス（目標）</th><th>レベル（目安）</th><th>武器の格</th><th>防具の格</th><th>枠</th></tr></thead><tbody>';
    for (const id of s.open.regions) {
      const p = planOfRegion(id);
      if (!p) continue;
      const fb = st.firstBoss?.[id];
      const isNow = !fb;
      const time = fb ? clock(fb.tick) : 'まだ';
      const lv = fb ? fb.level : s.hero.level;
      const late = fb ? fb.tick > p.min * 60 * TICKS_PER_SEC : s.tick > p.min * 60 * TICKS_PER_SEC;
      const cell = (v, t) => (t === undefined ? `${v}` : `${v}<small>（${t}）</small>`);
      // 倒したときの値（古い保存で残っていなければ ―）か、今の値。（ ）は予定表の目安
      const at = (k, nowV) => (isNow ? nowV : fb[k] ?? '―');
      h += `<tr${isNow ? ' class="now"' : ''}><td>${id}</td><td class="num${late ? ' late' : ''}">${cell(time, minText(p.min))}</td><td class="num">${cell(isNow ? `今 ${lv}` : lv, p.level)}</td>` +
        `<td class="num">${cell(at('weapon', gearTier(s, 'weapon')), p.weapon)}</td><td class="num">${cell(at('armor', gearTier(s, 'armor')), p.armor)}</td>` +
        `<td class="num">${cell(at('slots', slotCount(s)), p.slots)}</td></tr>`;
      if (isNow) break;
    }
    h += '</tbody></table>';
    const p = planOfRegion(now);
    if (isOpen(s, 'stage:dojo')) h += `<p class="small">技の並び（木人20秒）：${techRow(s)}${p?.tech ? `　目安 素 ×${p.tech}` : ''}</p>`;
    const hs = heroStats(s);
    h += `<p class="small quiet">勇者：攻撃 ${Math.round(hs.atk)}・HP ${Math.round(hs.maxHp)}${hs.guard ? `・盾 ${Math.round(hs.guard * 10) / 10}` : ''}　魔王までの目安 ${minText(PLAN[PLAN.length - 1].min)}</p>`;
    // 地域ごと
    h += '<h3>地域ごと</h3><table class="ledger-table"><thead><tr><th>地域</th><th>出発</th><th>支度切れ</th><th>倒れた</th><th>ボスを倒した</th></tr></thead><tbody>';
    for (const id of s.open.regions) {
      const r = st.byRegion?.[id];
      if (!r) continue;
      h += `<tr><td>${id} ${region(id).name}</td><td class="num">${r.departs}</td><td class="num">${r.prep}</td><td class="num">${r.down}</td><td class="num">${r.boss}</td></tr>`;
    }
    h += '</tbody></table>';
    // 出口ごと
    const fed = st.fed;
    if (fed) {
      const past = fed.past ?? [];
      h += `<h3>出口に入れた価値</h3><table class="ledger-table"><thead><tr><th>出口</th><th>手</th><th>振り分け</th><th>あふれ</th><th>${past.length ? `直近${past.length}分の毎分` : '毎分（1分たつと出る）'}</th></tr></thead><tbody>`;
      for (const x of EXITS) {
        if (!s.open.exits.includes(x)) continue;
        const per = past.length ? Math.round(past.reduce((a, m) => a + (m[x] ?? 0), 0) / past.length) : '―';
        h += `<tr><td>${EXIT_NAMES[x]}</td><td class="num">${fed.hand[x]}</td><td class="num">${fed.split[x]}</td><td class="num">${x === 'prep' ? fed.overflow?.prep ?? 0 : '―'}</td><td class="num">${per}</td></tr>`;
      }
      h += '</tbody></table>';
    }
    // 手と職人
    const rows = [];
    if (isOpen(s, 'stage:forge')) rows.push(['打った', `手 ${(st.crafted ?? 0) - (st.autoCrafted ?? 0)}回（会心 ${st.crits ?? 0}）・職人 ${st.autoCrafted ?? 0}回`]);
    if (isOpen(s, 'stage:dojo')) rows.push(['解いた巻物', `手 ${st.scrolls ?? 0}枚・門下生 ${st.discipleScrolls ?? 0}枚`]);
    rows.push(['合わせた', `手 ${st.merges}回・職人 ${st.crafterMerges}回`]);
    rows.push(['拾った', `${st.picked}個（あふれ ${st.overflow}個）`]);
    h += '<h3>手と職人</h3><dl class="ledger-dl">' + rows.map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('') + '</dl>';
    return h;
  }
  let lastLedger = '';
  let ledgerAt = 0;
  function renderLedger(s, force = false) {
    if (!dlg.open) return;
    const t = performance.now();
    if (!force && t < ledgerAt) return;
    ledgerAt = t + 1000;
    const html = ledgerHtml(s);
    if (html === lastLedger) return;
    lastLedger = html;
    $('ledger-body').innerHTML = html;
  }
  $('btn-ledger').addEventListener('click', () => {
    dlg.showModal();
    renderLedger(get(), true);
  });

  function render() {
    const s = get();
    renderSplit(s);
    renderDisciple(s);
    renderLedger(s);
  }

  // 門下生のできごと
  function handle(events) {
    for (const e of events) {
      if (e.type === 'disciple') {
        const n = nodeOf(e.node);
        log(`門下生が${n.name}の巻物を解いた（熟練＋${e.gain}）${e.to > e.from ? `　${e.to}/5 に上がった` : ''}`, e.to > e.from ? 'good' : '');
      }
    }
  }

  return { render, handle };
}
