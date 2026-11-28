// 段3 道場の画面：守りのスキルツリーと巻物。ルールは src/core/dojo.js・scroll.js を呼ぶだけ。
import {
  levelOf, skillOf, isNodeOpen, nodeStats, scrollSpec, scrollCheck, startScroll, scrollOpen, scrollFlag, scrollTech, quitScroll, nodeOf, LEVEL_MAX,
} from '../core/dojo.js';
import { numberAt, areaOf, RULES } from '../core/scroll.js';
import { GUARD_TREE, TECHS, SKILL } from '../data/dojo.js';
import { CARDS, LINEUP } from '../data/cards.js';
import { REGIONS } from '../data/balance.js';
import { availableCards, slotCount, lineupFor, setLineup, compareDummy, cardLevel, DUMMIES } from '../core/lineup.js';

const $ = (id) => document.getElementById(id);
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const KIND = { small: '小', tech: '技', card: '札', secret: '奥義', cross: '合流' };
const STAT = { hp: '最大HP ＋', atk: '攻撃 ＋', taken: '受けるダメージ −', regen: '歩く間の回復 ＋', speed: '攻撃の速さ ＋' };

export function createDojoUI({ get, set, log }) {
  const ui = { node: 'kamae', mode: 'open', tech: null, glow: null, last: null, view: 'tree', region: null, pick: null, slot: null };
  let lastKey = '';
  const side = $('dojo-side');

  function nodeEffect(n) {
    if (n.stat) return Object.entries(n.stat).map(([k, v]) => `${STAT[k]}${pct(v)}／段`).join('・');
    if (n.tech) return `技「${TECHS[n.tech].name}」：${TECHS[n.tech].text}（戦いでの効きは工程5）`;
    if (n.text) return n.text + '（工程5）';
    return n.locked ?? '';
  }

  function specText(spec) {
    const rules = spec.rules.length ? spec.rules.map((r) => RULES[r].name).join('＋') : '変えなし';
    return `${spec.w}×${spec.h}・${rules}・罠${spec.count}`;
  }

  function handle(events) {
    for (const e of events ?? []) {
      if (e.type === 'scroll') {
        const n = nodeOf(e.node);
        ui.last = e;
        log(`${n.name}の巻物を解いた（熟練＋${e.gain}${e.mistakes ? `・ミス${e.mistakes}` : ''}）${e.to > e.from ? `　${e.to}/5 に上がった` : ''}`, 'good');
      } else if (e.type === 'miss') {
        log('罠を開けた（ミス）', 'bad');
      } else if (e.type === 'parry') {
        log('受け流した（ミスにならない）');
      }
    }
  }

  function act(i, flag) {
    const s = get();
    const sc = s.dojo?.scroll;
    if (!sc) return;
    if (ui.tech) {
      const r = scrollTech(s, ui.tech, i);
      ui.tech = null;
      if (r.ok) { set(r.state); handle(r.events); }
    } else if (sc.opened.includes(i)) {
      ui.glow = ui.glow === i ? null : i;
    } else if (flag || ui.mode === 'flag') {
      const r = scrollFlag(s, i);
      if (r.ok) set(r.state);
      ui.glow = null;
    } else {
      const r = scrollOpen(s, i);
      if (r.ok) { set(r.state); handle(r.events); }
      ui.glow = null;
    }
    lastKey = '';
    render();
  }

  // ───── 入力 ─────
  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dact]');
    if (!b || b.disabled) return;
    const s = get();
    const a = b.dataset.dact;
    if (a === 'node') { ui.node = b.dataset.node; ui.last = null; }
    else if (a === 'view') { ui.view = b.dataset.view; ui.pick = null; ui.slot = null; }
    else if (a === 'card' || a === 'slot' || a === 'unslot' || a === 'left' || a === 'right') lineAct(s, a, b);
    else if (a === 'start') {
      const r = startScroll(s, ui.node);
      if (r.ok) { set(r.state); ui.mode = 'open'; ui.tech = null; ui.glow = null; ui.last = null; } else log(r.reason);
    } else if (a === 'mode') { ui.mode = b.dataset.mode; ui.tech = null; }
    else if (a === 'tech') {
      const t = b.dataset.tech;
      if (t === 'ukenagashi') {
        const r = scrollTech(s, t);
        if (r.ok) { set(r.state); log('受け流しを構えた（次のミスを数えない）'); }
      } else ui.tech = ui.tech === t ? null : t;
    } else if (a === 'quit') {
      if (!confirm('この巻物をやめますか？（熟練は入らない）')) return;
      set(quitScroll(s).state);
    }
    lastKey = '';
    render();
  });
  side.addEventListener('change', (e) => {
    const b = e.target.closest('[data-dact="lregion"]');
    if (!b) return;
    ui.region = Number(b.value);
    ui.slot = null;
    lastKey = '';
    render();
  });
  let press = null;
  side.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-mcell]');
    if (!b || e.button === 2) return;
    const i = Number(b.dataset.mcell);
    press = { i, long: false, timer: setTimeout(() => { if (press) { press.long = true; act(i, true); } }, 450) };
  });
  side.addEventListener('pointerup', (e) => {
    if (!press) return;
    clearTimeout(press.timer);
    const b = e.target.closest('[data-mcell]');
    if (!press.long && b && Number(b.dataset.mcell) === press.i && e.button !== 2) act(press.i, false);
    press = null;
  });
  side.addEventListener('pointercancel', () => { if (press) { clearTimeout(press.timer); press = null; } });
  side.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-mcell]');
    if (!b) return;
    e.preventDefault();
    act(Number(b.dataset.mcell), true);
  });
  side.addEventListener('keydown', (e) => {
    const b = e.target.closest('[data-mcell]');
    if (!b) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(Number(b.dataset.mcell), false); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); act(Number(b.dataset.mcell), true); }
  });

  // ───── 描く ─────
  function render() {
    const s = get();
    const open = s.open.unlocks.includes('stage:dojo');
    $('dojo-locked').hidden = open;
    $('dojo-body').hidden = !open;
    if (!open) return;
    const key = JSON.stringify([s.dojo, ui]);
    if (key === lastKey) return;
    lastKey = key;
    $('dojo-body').innerHTML = s.dojo.scroll ? scrollHtml(s) : viewTabs() + (ui.view === 'line' ? lineHtml(s) : treeHtml(s));
  }

  function treeHtml(s) {
    const t = nodeStats(s);
    const parts = Object.entries(t).filter(([, v]) => v > 0).map(([k, v]) => `${STAT[k]}${pct(v)}`);
    let h = `<p class="small">守りの流派。巻物を解くと熟練が入り、熟練${SKILL.perLevel}で節が1段上がる（解くと${3}、ミス1回につき −1）。<br>小さい節の強さ：${parts.length ? parts.join('・') : 'まだない'}</p>`;
    if (ui.last) {
      const n = nodeOf(ui.last.node);
      h += `<p class="result">${n.name}：熟練＋${ui.last.gain}${ui.last.to > ui.last.from ? `、${ui.last.to}/5 に上がった` : ''}</p>`;
    }
    const branches = ['根', '受け', '返し', '息吹', '奥'];
    h += '<div class="tree">';
    for (const br of branches) {
      h += `<div class="branch"><span class="branch-name">${br}</span><div class="branch-nodes">`;
      for (const n of GUARD_TREE.filter((x) => x.branch === br)) {
        const lv = levelOf(s, n.id);
        const op = isNodeOpen(s, n.id);
        const pips = '●'.repeat(lv) + '○'.repeat(LEVEL_MAX - lv);
        const cls = ['node', `k-${n.kind}`];
        if (!op) cls.push('closed');
        if (ui.node === n.id) cls.push('sel');
        h += `<button type="button" class="${cls.join(' ')}" data-dact="node" data-node="${n.id}" aria-pressed="${ui.node === n.id}">` +
          `<span class="node-name">${n.name}<small>${KIND[n.kind]}</small></span><span class="pips">${pips}</span></button>`;
      }
      h += '</div></div>';
    }
    h += '</div>';
    // 選んだ節
    const n = nodeOf(ui.node);
    const lv = levelOf(s, n.id);
    const sk = skillOf(s, n.id);
    h += `<div class="node-detail"><p><b>${n.name}</b>（${KIND[n.kind]}）　${lv}/5　熟練 ${sk}${lv < LEVEL_MAX ? `（次の段まであと ${(lv + 1) * SKILL.perLevel - sk}）` : ''}</p>`;
    h += `<p class="small">${nodeEffect(n)}</p>`;
    const c = scrollCheck(s, n.id);
    if (c.ok) {
      const spec = scrollSpec(n, lv);
      h += `<button type="button" class="go" data-dact="start">巻物を開く<small class="quiet"> ${specText(spec)}</small></button>`;
    } else {
      h += `<p class="quiet small">${c.reason}</p>`;
    }
    h += '</div>';
    return h;
  }

  function scrollHtml(s) {
    const sc = s.dojo.scroll;
    const p = sc.puzzle;
    const n = nodeOf(sc.node);
    let h = `<p class="sess-title"><b>${n.name}の巻物</b>（${sc.level}/5 → ${sc.level + 1}/5）</p>`;
    h += `<p class="small scroll-rule">${p.rules.length ? p.rules.map((r) => `<b>${RULES[r].name}</b>：${RULES[r].text}`).join('<br>') : '変えなし：数字はまわり8マスの罠の数'}</p>`;
    h += `<div class="dojo-bar"><span class="num">罠 ${p.count}　印 ${sc.flags.length + sc.sure.length}　ミス ${sc.mistakes}${sc.guard ? '　受け流し構え' : ''}</span>` +
      `<span class="mode"><button type="button" data-dact="mode" data-mode="open" aria-pressed="${ui.mode === 'open' && !ui.tech}">開ける</button>` +
      `<button type="button" data-dact="mode" data-mode="flag" aria-pressed="${ui.mode === 'flag' && !ui.tech}">印を付ける</button></span></div>`;
    // 修行中の技
    const techs = Object.entries(sc.techs);
    if (techs.length) {
      h += '<div class="strikes">' + techs.map(([t, left]) => `<button type="button" class="opt${ui.tech === t ? ' sel' : ''}" data-dact="tech" data-tech="${t}" ${left > 0 ? '' : 'disabled'}>` +
        `${TECHS[t].name}<small>あと${left}回</small></button>`).join('') + '</div>';
      if (ui.tech) h += `<p class="small temp-note">${TECHS[ui.tech].text}。使うマスを押す（もう一度技を押すとやめる）</p>`;
    }
    const area = ui.glow !== null ? new Set(areaOf(p.w, p.h, p.rules, ui.glow)) : null;
    const hintAt = new Map(sc.hints.map((x) => [x.at, x]));
    h += `<div class="mine-board" style="--w:${p.w}">`;
    for (let i = 0; i < p.w * p.h; i++) {
      const opened = sc.opened.includes(i);
      const cls = ['mc'];
      if (opened) cls.push('open');
      if (p.shown.includes(i)) cls.push('given');
      if (sc.wrong.includes(i)) cls.push('wrong');
      if (sc.flags.includes(i)) cls.push('flag');
      if (sc.sure.includes(i)) cls.push('sure');
      if (area?.has(i)) cls.push('glow');
      if (ui.glow === i) cls.push('glow-src');
      const num = opened ? numberAt(p, i) : null;
      const hint = hintAt.get(i);
      const hintText = hint ? (hint.tech === 'tategamae' ? `<i class="hint">盾${hint.value}</i>` : `<i class="hint">行${hint.row}列${hint.col}</i>`) : '';
      const text = opened ? (num === 0 ? '' : num) : sc.wrong.includes(i) ? '✖' : sc.sure.includes(i) ? '◆' : sc.flags.includes(i) ? '◇' : '';
      const label = opened ? `数字${num}` : sc.sure.includes(i) ? '罠（確か）' : sc.flags.includes(i) ? '印' : 'まだ';
      h += `<button type="button" class="${cls.join(' ')}" data-mcell="${i}" aria-label="${label}"><span class="n${num ?? ''}">${text}</span>${hintText}</button>`;
    }
    h += '</div>';
    h += '<p class="small quiet">右クリック・長押しで印。数字を押すと数えるマスが光る。◆は技で分かった罠、◇は自分の印。</p>';
    h += '<button type="button" class="mini wide" data-dact="quit">やめる（熟練は入らない）</button>';
    return h;
  }


  // ───── 技の並び（判定表 第9回 D3） ─────
  function viewTabs() {
    return '<div class="view-tabs">' + [['tree', 'ツリー'], ['line', '技の並び']].map(([v, n]) =>
      `<button type="button" data-dact="view" data-view="${v}" aria-pressed="${ui.view === v}">${n}</button>`).join('') + '</div>';
  }

  function editRegion(s) {
    return ui.region && s.open.regions.includes(ui.region) ? ui.region : s.nextRegion;
  }

  function lineAct(s, a, b) {
    const r = editRegion(s);
    const list = lineupFor(s, r).slice();
    const max = slotCount(s);
    const save = (l) => set(setLineup(s, r, l).state);
    if (a === 'card') {
      const id = b.dataset.card;
      if (ui.slot !== null) {
        list[Math.min(ui.slot, list.length)] = id;
        save(list.slice(0, max));
        ui.slot = null;
      } else if (list.length < max && ui.pick === id) {
        save([...list, id]); // 同じ札をもう一度押すと後ろに足す
      } else {
        ui.pick = ui.pick === id ? null : id;
      }
    } else if (a === 'slot') {
      const i = Number(b.dataset.slot);
      if (ui.pick) {
        list[Math.min(i, list.length)] = ui.pick;
        save(list.slice(0, max));
        ui.pick = null;
      } else {
        ui.slot = ui.slot === i ? null : i;
      }
    } else if (ui.slot !== null && ui.slot < list.length) {
      const i = ui.slot;
      if (a === 'unslot') { list.splice(i, 1); ui.slot = null; }
      if (a === 'left' && i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; ui.slot = i - 1; }
      if (a === 'right' && i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; ui.slot = i + 1; }
      save(list);
    }
  }

  function lineHtml(s) {
    const r = editRegion(s);
    const own = s.lineup?.byRegion?.[r];
    const list = lineupFor(s, r);
    const max = slotCount(s);
    const cards = availableCards(s);
    let h = '<p class="small">戦いでは普通の攻撃の合間に、並べた札を左から順に使う。最後の札の後は積み直し（その間も普通の攻撃）。修飾は次の技に掛かる。</p>';
    h += `<p class="small">並びを決める地域：<select data-dact="lregion" class="lregion">${s.open.regions.map((id) => `<option value="${id}"${id === r ? ' selected' : ''}>${id} ${REGIONS[id - 1].name}</option>`).join('')}</select>` +
      `${own ? '' : '<span class="quiet">（この地域の並びはまだない。一つ前の地域の並びを使う）</span>'}</p>`;
    // 枠
    h += '<div class="slots">';
    for (let i = 0; i < max; i++) {
      const id = list[i];
      const sel = ui.slot === i ? ' sel' : '';
      h += `<button type="button" class="slot${sel}${id ? ' k-' + CARDS[id].type : ''}" data-dact="slot" data-slot="${i}">${id ? CARDS[id].name : '　'}<small>${i + 1}</small></button>`;
    }
    h += `</div><p class="small quiet">枠 ${list.length}/${max}（技・札の節が ${LINEUP.slotLevel}/5 になるたびに ＋1、最大${LINEUP.maxSlots}）</p>`;
    if (ui.slot !== null && ui.slot < list.length) {
      h += '<div class="strikes"><button type="button" class="mini wide" data-dact="left">← 前へ</button><button type="button" class="mini wide" data-dact="unslot">外す</button><button type="button" class="mini wide" data-dact="right">後ろへ →</button></div>';
    }
    // 持っている札
    h += '<h3>持っている札</h3>';
    if (!cards.length) h += '<p class="quiet small">まだない。道場が開くと強斬り、守りの節を 1/5 にするとその札が使える。</p>';
    h += '<div class="hand">' + cards.map((id) => {
      const c = CARDS[id];
      const lv = cardLevel(s, id);
      const kind = { tech: '技', mod: '修飾', cond: '条件' }[c.type];
      const lvText = c.node ? `・${lv}/5 効き＋${Math.round((lv - 1) * 10)}%` : '';
      return `<button type="button" class="opt card k-${c.type}${ui.pick === id ? ' sel' : ''}" data-dact="card" data-card="${id}">${c.name}<small>${kind}・${c.swings}振り${lvText}</small><small>${c.text}</small></button>`;
    }).join('') + '</div>';
    h += '<p class="small quiet">札を押してから枠を押す（枠を先に押してもよい）。同じ札を2回押すと後ろに足す。枠を押すと外す・前後へ動かせる。</p>';
    // 木人
    h += '<h3>木人で試す（30秒）</h3><table class="dummy"><thead><tr><th>木人</th><th>毎秒のダメージ</th><th>受けたダメージ</th></tr></thead><tbody>';
    let cycle = null;
    let timeline = [];
    const used = list.filter((id) => cards.includes(id)).slice(0, max);
    for (const [t, d] of Object.entries(DUMMIES)) {
      const res = compareDummy(s, used, t);
      if (t === 'plain') { cycle = res.cycleSec; timeline = res.timeline; }
      const taken = res.plainTaken > 0 ? `並びなしの ×${(res.takenPerSec / res.plainTaken).toFixed(2)}` : '―';
      h += `<tr><td title="${d.text}">${d.name}<small class="quiet"> ${d.text}</small></td><td class="num">${Math.round(res.dps)}（並びなしの ×${(res.ratio ?? 0).toFixed(2)}）</td><td class="num">${taken}</td></tr>`;
    }
    h += '</tbody></table><p class="small quiet">相手の強さは今の勇者に合わせてある。比べるのは並びが空（普通の攻撃だけ）のとき。</p>';
    // 使われる順の帯
    if (timeline.length) {
      h += '<h3>使われる順（1周）</h3><div class="timeline">' + timeline.filter((e) => e.type === 'card').map((e) => {
        const c = CARDS[e.id];
        const tag = e.skip ? '（条件が合わず次を飛ばす）' : e.mods ? `（修飾×${e.mods}）` : '';
        return `<span class="tl k-${c.type}${e.skip ? ' skip' : ''}">${c.name}<small>${tag}</small></span>`;
      }).join('<span class="arrow">→</span>') + `<span class="arrow">→</span><span class="tl recast">積み直し<small>1周 ${cycle ? cycle.toFixed(1) : '―'}秒</small></span></div>`;
    }
    return h;
  }

  return { render };
}
