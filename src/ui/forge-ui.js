// 段2 打ち分けと工房の画面。ルールは src/core の関数を呼ぶだけ。
import {
  isOpen, slotsOf, fuelPower, forgeCheck, forgeStart, forgeStrike, forgeFire, forgeFinish,
  equipItem, setForgeAuto, upgradeCheck, buyUpgrade, widenTo, mergeCrafterTicks, mergeCrafterRank,
} from '../core/game.js';
import { planOf, mainValue, heroStats, itemKey, baseOf, statOf } from '../core/gear.js';
import { preview, canStrike, canFire, score, cellQuality, strikeAmount } from '../core/forge.js';
import { GEAR, SLOTS, STRIKES, TEMPS, GEAR_KINDS, gearCost, bandOf } from '../data/forge.js';
import { KINDS, WORKSHOP, TICKS_PER_SEC } from '../data/balance.js';

const $ = (id) => document.getElementById(id);
const r1 = (x) => Math.round(x * 10) / 10;

export function gearName(kind, slot) {
  return GEAR_KINDS[kind][slot].name;
}

// 主の数値の言い方。
export function statText(stat, v) {
  if (stat === 'weapon') return `攻撃＋${r1(v)}`;
  if (stat === 'hp') return `HP＋${r1(v)}`;
  if (stat === 'guard') return `受けるダメージ−${r1(v)}`;
  if (stat === 'atk') return `攻撃＋${r1(v * 100)}%`;
  if (stat === 'regen') return `歩く間の回復＋${r1(v * 100)}%`;
  return String(r1(v));
}

export function createForgeUI({ get, set, log }) {
  // 画面だけの選び途中（保存しない）
  const ui = { kind: null, slot: null, tier: 1, fuel: {}, strike: 'tap', aim: null, result: null };
  let lastKey = '';

  function stockOf(s, kind) {
    return s.stock.forge[kind] ?? 0;
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const s = get();
    const act = b.dataset.act;
    if (act === 'kind') {
      ui.kind = b.dataset.kind;
      const slots = slotsOf(ui.kind);
      ui.slot = slots.length === 1 ? slots[0] : slots.includes(ui.slot) ? ui.slot : null;
      ui.result = null;
    } else if (act === 'slot') {
      ui.slot = b.dataset.slot;
    } else if (act === 'tier') {
      ui.tier = Number(b.dataset.tier);
    } else if (act === 'fuel') {
      const k = b.dataset.kind;
      const v = (ui.fuel[k] ?? 0) + Number(b.dataset.d);
      ui.fuel[k] = Math.max(0, v);
    } else if (act === 'fuel-best') {
      const best = s.forge.best[b.dataset.key];
      if (best) ui.fuel = { ...best.fuel };
    } else if (act === 'start') {
      const r = forgeStart(s, { kind: ui.kind, slot: ui.slot, tier: ui.tier, fuel: ui.fuel });
      if (r.ok) { set(r.state); ui.aim = null; ui.result = null; } else log(r.reason);
    } else if (act === 'strike') {
      ui.strike = b.dataset.strike;
    } else if (act === 'hit') {
      const cell = Number(b.dataset.cell);
      // タッチは1回目で伸びを見せ、同じマスの2回目で叩く（判定表 第3回 F3：叩く前に伸びが見える）
      if (e.pointerType === 'touch' || b.dataset.touch === '1') {
        if (ui.aim !== cell) { ui.aim = cell; lastKey = ''; render(); return; }
      }
      const r = forgeStrike(s, ui.strike, cell);
      if (r.ok) { set(r.state); after(r.done); }
    } else if (act === 'fire') {
      const r = forgeFire(s);
      if (r.ok) { set(r.state); after(r.done); }
    } else if (act === 'finish') {
      const r = forgeFinish(s);
      if (r.ok) { set(r.state); after(r.done); }
    } else if (act === 'equip') {
      const r = equipItem(s, b.dataset.slot, b.dataset.key);
      if (r.ok) set(r.state);
    } else if (act === 'auto') {
      set(setForgeAuto(s, !s.forge.auto).state);
    } else if (act === 'upgrade') {
      const r = buyUpgrade(s, b.dataset.what);
      if (r.ok) log(`工房で${WORKSHOP[b.dataset.what].name}を上げた`, 'good'); else log(r.reason);
      if (r.ok) set(r.state);
    }
    lastKey = '';
    lastShop = '';
    render(); // 押したらすぐ描き直す（次のコマを待たない）
  }

  function after(done) {
    ui.aim = null;
    if (!done) return;
    ui.result = done;
    log(craftText(done), done.crit ? 'good' : '');
  }

  // タッチかどうかを pointerdown で覚えておく
  let touch = false;
  const side = $('forge-side');
  side.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch'; });
  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="hit"]');
    if (b) b.dataset.touch = touch ? '1' : '0';
    onClick(e);
  });
  side.addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-act="hit"]');
    if (!b || touch) return;
    const cell = Number(b.dataset.cell);
    if (ui.aim !== cell) { ui.aim = cell; lastKey = ''; render(); }
  });
  side.addEventListener('pointerleave', () => { if (!touch && ui.aim !== null) { ui.aim = null; lastKey = ''; render(); } });
  // キーボードで盤のマスに来たら伸びを見せる
  side.addEventListener('focusin', (e) => {
    const b = e.target.closest('[data-act="hit"]');
    if (b && ui.aim !== Number(b.dataset.cell)) { ui.aim = Number(b.dataset.cell); lastKey = ''; render(); }
  });
  $('workshop').addEventListener('click', onClick);

  function render() {
    const s = get();
    const open = isOpen(s, 'stage:forge');
    $('forge-locked').hidden = open;
    $('forge-body').hidden = !open;
    renderWorkshop(s);
    if (!open) return;
    const key = JSON.stringify([s.stock.forge, s.gear, s.forge.session, s.forge.best, s.forge.auto, s.hero.level, ui, isOpen(s, 'crafter:forge')]);
    if (key === lastKey) return;
    lastKey = key;
    $('forge-body').dataset.busy = s.forge.session ? '1' : '0';
    renderStock(s);
    $('forge-main').innerHTML = s.forge.session ? sessionHtml(s) : setupHtml(s);
    $('gear').innerHTML = gearHtml(s);
  }

  // 素材ごとにたまった価値（判定表 第4回 A2：分かりやすく）
  function renderStock(s) {
    const kinds = Object.keys(KINDS).filter((k) => stockOf(s, k) > 0 || GEAR_KINDS[k]);
    $('stock').innerHTML = kinds.map((k) => {
      const v = stockOf(s, k);
      const can = GEAR_KINDS[k] && !s.forge.session;
      const sel = ui.kind === k && !s.forge.session ? ' sel' : '';
      return `<button type="button" class="chip${sel}" data-act="kind" data-kind="${k}" ${can ? '' : 'disabled'} style="--c:${KINDS[k].color}">` +
        `<b>${KINDS[k].mark}</b> ${KINDS[k].name}<span class="num">${v}</span></button>`;
    }).join('');
  }

  function setupHtml(s) {
    let h = '';
    if (ui.result) h += `<p class="result${ui.result.crit ? ' crit' : ''}">${craftText(ui.result)}</p>`;
    if (!ui.kind) return h + '<p class="quiet">素材を選ぶ（装備作りの出口に入れた物）。</p>';
    const slots = slotsOf(ui.kind);
    h += '<div class="step"><span class="step-name">作る物</span>' + slots.map((sl) => {
      const it = s.gear.items[itemKey(ui.kind, sl)];
      const sub = it ? `格${it.tier}` : 'まだない';
      return `<button type="button" class="opt${ui.slot === sl ? ' sel' : ''}" data-act="slot" data-slot="${sl}">${gearName(ui.kind, sl)}<small>${SLOTS[sl].name}・${sub}</small></button>`;
    }).join('') + '</div>';
    if (!ui.slot) return h;
    const stat = statOf(ui.kind, ui.slot);
    h += '<div class="step"><span class="step-name">格</span>';
    for (let t = 1; t <= GEAR.tierMax; t++) {
      const p = planOf(s.gear.items, ui.kind, ui.slot, t);
      const what = p.mode === 'new' ? '初めて打つ' : p.mode === 'up' ? '格上げ（加算は引き継ぐ）' : p.mode === 'add' ? `加算 あと${p.left}回` : '加算は使い切った';
      const gain = p.mode === 'add' ? `＋${r1(baseOf(stat, t) * GEAR.addRate)}×出来` : `基本 ${r1(baseOf(stat, t))}×出来`;
      h += `<button type="button" class="opt${ui.tier === t ? ' sel' : ''}" data-act="tier" data-tier="${t}" ${p.mode === 'full' ? 'disabled' : ''}>` +
        `格${t}<small>${what}</small><small class="num">${KINDS[ui.kind].name} ${gearCost(t)}・${gain}</small></button>`;
    }
    h += `<span class="quiet small">格${GEAR.tierMax + 1}からは次の工程</span></div>`;
    // 燃料
    const band = bandOf(ui.tier);
    const pow = fuelPower(ui.fuel);
    const shards = Object.keys(KINDS).filter((k) => KINDS[k].group === 'shard' && (stockOf(s, k) > 0 || ui.fuel[k]));
    h += '<div class="step fuel"><span class="step-name">燃料</span>';
    if (shards.length === 0) h += '<span class="quiet">欠片を装備作りの出口に入れる</span>';
    for (const k of shards) {
      const room = stockOf(s, k) - (k === ui.kind ? gearCost(ui.tier) : 0);
      h += `<span class="fuel-row"><span>${KINDS[k].name}</span>` +
        `<button type="button" class="mini" data-act="fuel" data-kind="${k}" data-d="-1" ${ui.fuel[k] ? '' : 'disabled'} aria-label="${KINDS[k].name}を1減らす">−</button>` +
        `<b class="num">${ui.fuel[k] ?? 0}</b>` +
        `<button type="button" class="mini" data-act="fuel" data-kind="${k}" data-d="1" ${(ui.fuel[k] ?? 0) < room && pow.conc < band.cap ? '' : 'disabled'} aria-label="${KINDS[k].name}を1増やす">＋</button>` +
        `<span class="quiet small num">／${Math.max(0, room)}</span></span>`;
    }
    const bestKey = `${ui.kind}:${ui.slot}:${band.id}`;
    const best = s.forge.best[bestKey];
    h += `<p class="num">集中力 <b>${pow.conc}</b>／${band.cap}　火を足す <b>${pow.fire}</b>回</p>`;
    if (best) h += `<p class="small">一番の出来 ${best.sum}/${best.max}${best.crit ? '（会心）' : ''}　<button type="button" class="mini wide" data-act="fuel-best" data-key="${bestKey}">その時の燃料にする</button></p>`;
    h += '</div>';
    const c = forgeCheck(s, { kind: ui.kind, slot: ui.slot, tier: ui.tier, fuel: ui.fuel });
    h += `<button type="button" class="go" data-act="start" ${c.ok ? '' : 'disabled'}>打ち始める</button>`;
    if (!c.ok) h += `<p class="quiet small">${c.reason}</p>`;
    return h;
  }

  function sessionHtml(s) {
    const se = s.forge.session;
    const sc = score(se);
    const plan = planOf(s.gear.items, se.kind, se.slot, se.tier);
    const mode = plan.mode === 'new' ? '初めて' : plan.mode === 'up' ? '格上げ' : '加算';
    let h = `<p class="sess-title"><b>${gearName(se.kind, se.slot)} 格${se.tier}</b>（${mode}）</p>`;
    // 温度：段ごとに叩ける回数を丸で見せる（●＝叩いた、○＝残り）。判定表 第5回 Q3
    h += '<div class="temps">' + TEMPS.map((t, i) => {
      const cls = i === se.temp ? 'now' : i < se.temp ? 'past' : '';
      const used = i < se.temp ? se.perLevel : i === se.temp ? se.perLevel - se.left : 0;
      const pips = '●'.repeat(used) + '○'.repeat(se.perLevel - used);
      return `<span class="temp t${i} ${cls}">${t.name} ×${t.mult}<small class="pips">${pips}</small></span>`;
    }).join('') + `<span class="temp t3${se.temp > 2 ? ' now' : ''}">冷えた</span></div>`;
    const tempNote = se.temp > 2
      ? '冷えて叩けない。火を足すと暗赤に戻る'
      : `あと${se.left}回叩くと${se.temp < 2 ? `${TEMPS[se.temp + 1].name}に下がる` : '冷えて叩けなくなる'}。火を足すといつでも1段熱くなり、その段を最初から叩ける`;
    h += `<p class="small temp-note">${tempNote}</p>`;
    const bests = se.values.filter((v, i) => cellQuality(v, se.targets[i]).q === 2).length;
    h += `<p class="num">集中力 <b>${se.conc}</b>　火 <b>${se.fire}</b>回　◎ <b>${bests}</b>/${se.values.length}マス（全部◎で会心＝基本の${Math.round(GEAR.crit * 100)}%）<br>今の出来 ${sc.sum}/${sc.max}・基本の${Math.round(sc.ratio * 100)}%</p>`;
    // 叩き方
    h += '<div class="strikes">' + Object.entries(STRIKES).map(([id, st]) => {
      const ok = canStrike(se, id);
      return `<button type="button" class="opt${ui.strike === id ? ' sel' : ''}" data-act="strike" data-strike="${id}" ${ok ? '' : 'disabled'}>` +
        `${st.name}<small>${st.shape === 'one' ? '1マス' : '縦2マス'} ＋${strikeAmount(se, id)}・集中${st.cost}</small></button>`;
    }).join('') + `<button type="button" class="opt" data-act="fire" ${canFire(se) ? '' : 'disabled'}>火を足す<small>1段熱くして段を最初から</small></button></div>`;
    // 盤（叩く前の伸びを見せる）
    const pv = ui.aim !== null && canStrike(se, ui.strike) ? preview(se, ui.strike, ui.aim) : [];
    const gain = new Map(pv.map((p) => [p.index, p.amount]));
    h += `<div class="anvil" style="--w:${se.w}">` + se.values.map((v, i) => {
      const c = se.targets[i];
      const q = cellQuality(v, c);
      const g = gain.get(i);
      const mark = q.crack ? 'ひび' : q.q === 2 ? '◎' : q.q === 1 ? '○' : '';
      let next = '';
      if (g) {
        const nq = cellQuality(v + g, c);
        next = `<span class="gain${nq.crack ? ' bad' : nq.q === 2 ? ' good' : ''}">＋${g}→${v + g}</span>`;
      }
      return `<button type="button" class="anv${g ? ' aim' : ''}${q.crack ? ' crack' : q.q === 2 ? ' best' : q.q === 1 ? ' ok' : ''}" data-act="hit" data-cell="${i}" aria-label="マス${i + 1}：今${v}、目標${c}（${c - 1}〜${c + 1}）">` +
        `<b class="num">${v}</b><small class="num">目標 ${c}（${c - 1}〜${c + 1}）</small><span class="mark">${mark}</span>${next}</button>`;
    }).join('') + '</div>';
    h += '<button type="button" class="go" data-act="finish">仕上げる</button>';
    return h;
  }

  function gearHtml(s) {
    const st = heroStats(s);
    const items = Object.entries(s.gear.items);
    let h = '<h3>装備</h3>';
    h += `<p class="num small">攻撃 ${r1(st.atk)}（${r1(st.attackTicks / TICKS_PER_SEC)}秒に1回）　HP ${Math.round(st.maxHp)}${st.guard ? `　受けるダメージ−${r1(st.guard)}` : ''}</p>`;
    if (items.length === 0) return h + '<p class="quiet small">まだ何も打っていない。</p>';
    h += '<p class="quiet small">下の数値はレベルの倍率がかかる前（上の合計はかかった後）。</p>';
    for (const slot of ['weapon', 'armor']) {
      const mine = items.filter(([, it]) => it.slot === slot);
      if (mine.length === 0) continue;
      h += `<div class="gear-row"><span class="step-name">${SLOTS[slot].name}</span>` + mine.map(([k, it]) => {
        const on = s.gear.equip[slot] === k;
        return `<button type="button" class="opt${on ? ' sel' : ''}" data-act="equip" data-slot="${slot}" data-key="${k}" aria-pressed="${on}">${itemLine(it)}</button>`;
      }).join('') + '</div>';
    }
    const acc = items.filter(([, it]) => it.slot === 'accessory');
    if (acc.length) h += '<div class="gear-row"><span class="step-name">アクセサリー（全部効く）</span>' + acc.map(([, it]) => `<span class="opt static">${itemLine(it)}</span>`).join('') + '</div>';
    if (isOpen(s, 'crafter:forge')) {
      h += `<p class="small">打ち分けの職人：<button type="button" class="mini wide" data-act="auto" aria-pressed="${s.forge.auto}">${s.forge.auto ? '打っている（止める）' : '止めている（打たせる）'}</button>` +
        `<br><span class="quiet">装備中の武器・防具とアクセサリーを、手で出した一番の手順で順に打つ（10秒に1回）。</span></p>`;
    }
    return h;
  }

  function itemLine(it) {
    const stat = statOf(it.kind, it.slot);
    const adds = Object.entries(it.adds).map(([t, n]) => `格${t} ${n}/${GEAR.addCap}`).join('・');
    return `${gearName(it.kind, it.slot)} 格${it.tier}<small>${statText(stat, mainValue(it))}${adds ? `・加算 ${adds}` : ''}</small>`;
  }

  let lastShop = '';
  function renderWorkshop(s) {
    const open = s.open.exits.includes('workshop');
    $('workshop').hidden = !open;
    if (!open) return;
    const rows = ['widen', 'arm', 'speed'].map((w) => {
      const c = upgradeCheck(s, w);
      let what = '';
      if (w === 'widen') { const to = widenTo(s.board); what = to ? `${s.board.w}×${s.board.h} → ${to.w}×${to.h}` : '一番広い'; }
      if (w === 'arm') what = `ランク${mergeCrafterRank(s)}まで → ${mergeCrafterRank(s) + 1}まで`;
      if (w === 'speed') { const now = mergeCrafterTicks(s); what = `${r1(now / TICKS_PER_SEC)}秒 → ${r1(Math.max(1, Math.round(now * 0.8)) / TICKS_PER_SEC)}秒`; }
      return [w, c.ok, c.cost ?? '', what, c.ok ? '' : c.reason];
    });
    const crafter = isOpen(s, 'crafter:merge') ? `マージの職人：${r1(mergeCrafterTicks(s) / TICKS_PER_SEC)}秒に1回、ランク${mergeCrafterRank(s)}までを合わせる` : 'マージの職人は地域2のボスで来る';
    const key = JSON.stringify([s.stock.workshop, rows, crafter]);
    if (key === lastShop) return;
    lastShop = key;
    $('workshop').innerHTML = `<h3>工房 <span class="num quiet">たまった ${s.stock.workshop}</span></h3>` +
      rows.map(([w, ok, cost, what, why]) => `<button type="button" class="opt shop" data-act="upgrade" data-what="${w}" ${ok ? '' : 'disabled'} title="${why}">` +
        `${WORKSHOP[w].name}<small class="num">${what}</small><small class="num">${cost ? `費用 ${cost}` : why}</small></button>`).join('') +
      `<p class="quiet small">${crafter}</p>`;
  }

  return { render, ui };
}

export function craftText(d) {
  const name = gearName(d.kind, d.slot);
  const mode = d.mode === 'new' ? '' : d.mode === 'up' ? '格上げ・' : '加算・';
  const who = d.auto ? '職人が' : '';
  return `${who}${name} 格${d.tier}を打った（${mode}出来 ${d.sum}/${d.max}・基本の${Math.round(d.ratio * 100)}%）${d.crit ? ' 会心！' : ''}`;
}
