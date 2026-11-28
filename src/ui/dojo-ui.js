// 段3 道場の画面：流派（守り・剣・魔法・弓）のスキルツリーと巻物、技の並び。ルールは src/core/dojo.js などを呼ぶだけ。
import {
  levelOf, skillOf, isNodeOpen, nodeStats, scrollSpec, scrollCheck, startScroll, scrollOpen, scrollFlag, scrollTech, quitScroll, nodeOf, LEVEL_MAX, shapeKey,
  scrollPaint, scrollMark, schoolOpen, scrollPlace, scrollNote, scrollMirror, sudoLeft, beamLeft,
  scrollRoom, scrollLamp, lampLeft,
} from '../core/dojo.js';
import { roomsBoardHtml, lampsBoardHtml, ROOM_RULE_TEXT, LAMP_RULE_TEXT } from './dojo7d-view.js';
import { NONO_RULES } from '../core/nonogram.js';
import { ELEMENT_NAMES } from '../core/sudoku.js';
import { SLASH, BACK } from '../core/mirrors.js';
import { nonoBoardHtml } from './nono-view.js';
import { sudoBoardHtml, beamBoardHtml, SUDO_RULE_TEXT, BEAM_RULE_TEXT } from './magic-view.js';
import { SCHOOLS, ALL_TECHS } from '../data/schools.js';
import { numberAt, areaOf, RULES } from '../core/scroll.js';
import { TECHS, SKILL } from '../data/dojo.js';
import { CARDS, LINEUP, CARD_KINDS } from '../data/cards.js';
import { REGIONS } from '../data/balance.js';
import { availableCards, slotCount, lineupFor, setLineup, compareDummy, cardLevel, DUMMIES } from '../core/lineup.js';

const $ = (id) => document.getElementById(id);
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const KIND = { small: '小', tech: '技', card: '札', secret: '奥義', cross: '合流' };
const STAT = { hp: '最大HP ＋', atk: '攻撃 ＋', taken: '受けるダメージ −', regen: '歩く間の回復 ＋', speed: '攻撃の速さ ＋', bleed: '出血のダメージ ＋' };

export function createDojoUI({ get, set, log }) {
  const ui = { node: 'kamae', school: 'guard', mode: 'open', tech: null, glow: null, last: null, view: 'tree', region: null, pick: null, slot: null };
  const firstOf = (school) => SCHOOLS[school].tree[0].id;
  let lastKey = '';
  const side = $('dojo-side');

  function nodeEffect(n) {
    if (n.stat) return Object.entries(n.stat).map(([k, v]) => `${STAT[k]}${pct(v)}／段`).join('・');
    const card = CARDS[n.id];
    if (n.tech) return `巻物の技「${ALL_TECHS[n.tech].name}」：${ALL_TECHS[n.tech].text}${card ? `<br>戦いの札：${card.text}` : ''}`;
    if (card) return `${CARD_KINDS[card.type]}の札：${card.text}`;
    if (n.text) return n.text;
    return n.locked ?? '';
  }

  function specText(spec) {
    const table = spec.kind === 'sudo' ? SUDO_RULE_TEXT : spec.kind === 'beam' ? BEAM_RULE_TEXT : spec.kind === 'rooms' ? ROOM_RULE_TEXT : spec.kind === 'lamps' ? LAMP_RULE_TEXT : spec.kind === 'nono' ? NONO_RULES : RULES;
    const rules = spec.rules.length ? spec.rules.map((r) => table[r].name).join('＋') : '変えなし';
    if (spec.kind === 'sudo') return `属性の数独 ${spec.n}×${spec.n}・${rules}`;
    if (spec.kind === 'beam') return `鏡 ${spec.w}×${spec.h}・${rules}`;
    if (spec.kind === 'rooms') return `部屋分け ${spec.w}×${spec.h}・${rules}`;
    if (spec.kind === 'lamps') return `灯り ${spec.w}×${spec.h}・${rules}`;
    return spec.kind === 'nono' ? `ピクロス ${spec.w}×${spec.h}・${rules}` : `${spec.w}×${spec.h}・${rules}・罠${spec.count}`;
  }

  function handle(events) {
    for (const e of events ?? []) {
      if (e.type === 'scroll') {
        const n = nodeOf(e.node);
        ui.last = e;
        log(`${n.name}の巻物を解いた（熟練＋${e.gain}${e.mistakes ? `・ミス${e.mistakes}` : ''}）${e.to > e.from ? `　${e.to}/5 に上がった` : ''}`, 'good');
      } else if (e.type === 'miss') {
        const k = get().dojo?.scroll?.kind ?? ui.lastKind;
        const MISS = { nono: '塗り間違い（ミス）', sudo: '置き間違い（ミス）', beam: '鏡の置き間違い（ミス）', rooms: '部屋の切り間違い（ミス）。正しい部屋を置いた', lamps: '灯りの置き間違い（ミス）' };
        log(MISS[k] ?? '罠を開けた（ミス）', 'bad');
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
    else if (a === 'school') { ui.school = b.dataset.school; ui.node = firstOf(ui.school); ui.last = null; }
    else if (a === 'view') { ui.view = b.dataset.view; ui.pick = null; ui.slot = null; }
    else if (a === 'card' || a === 'slot' || a === 'unslot' || a === 'left' || a === 'right') lineAct(s, a, b);
    else if (a === 'start') {
      const r = startScroll(s, ui.node);
      if (r.ok) {
        set(r.state);
        const k = r.state.dojo.scroll.kind;
        ui.lastKind = k;
        ui.mode = k === 'nono' ? 'paint1' : k === 'sudo' ? 'place' : k === 'beam' ? 'slash' : k === 'lamps' ? 'lamp' : k === 'rooms' ? 'cut' : 'open';
        ui.elem = 0;
        ui.tech = null; ui.glow = null; ui.last = null; ui.quitAsk = false;
      } else log(r.reason);
    } else if (a === 'mode') { ui.mode = b.dataset.mode; ui.tech = null; }
    else if (a === 'elem') { ui.elem = Number(b.dataset.elem); ui.tech = null; }
    else if (a === 'tech') {
      const t = b.dataset.tech;
      if (t === 'ukenagashi') {
        const r = scrollTech(s, t);
        if (r.ok) { set(r.state); log('受け流しを構えた（次のミスを数えない）'); }
      } else ui.tech = ui.tech === t ? null : t;
    } else if (a === 'quit') {
      // 確認は窓を出さず、ボタンの所で済ませる（判定表 第15回の一言）
      ui.quitAsk = true;
    } else if (a === 'quit-yes') {
      ui.quitAsk = false;
      set(quitScroll(s).state);
    } else if (a === 'quit-no') {
      ui.quitAsk = false;
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

  // ───── 魔法と弓の巻物の手（判定表 第18回 B3・C3）─────
  // 魔法：属性を選んでからマスを押す（置く／候補の印）。弓：置く物（／・＼・×）を選んでからマスを押す。右クリックは×。
  function placeAct(i, asX) {
    const s = get();
    const sc = s.dojo?.scroll;
    if (!sc) return;
    let r;
    if (ui.tech) {
      r = scrollTech(s, ui.tech, i);
      ui.tech = null;
    } else if (sc.kind === 'sudo') {
      r = ui.mode === 'note' || asX ? scrollNote(s, i, ui.elem ?? 0) : scrollPlace(s, i, ui.elem ?? 0);
    } else if (sc.kind === 'beam') {
      if (asX || ui.mode === 'x') r = scrollMark(s, i);
      else r = scrollMirror(s, i, ui.mode === 'back' ? BACK : SLASH);
    } else if (sc.kind === 'lamps') {
      if (asX || ui.mode === 'x') r = scrollMark(s, i);
      else r = scrollLamp(s, i);
    }
    if (r?.ok) { set(r.state); handle(r.events); }
    lastKey = '';
    render();
  }
  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scell], [data-bcell], [data-lcell]');
    if (!b || b.disabled) return;
    placeAct(Number(b.dataset.scell ?? b.dataset.bcell ?? b.dataset.lcell), false);
  });
  side.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-bcell], [data-scell], [data-lcell]');
    if (!b) return;
    e.preventDefault();
    placeAct(Number(b.dataset.bcell ?? b.dataset.scell ?? b.dataset.lcell), true);
  });
  // 召喚：押したまま動かして長方形を切る（1マスなら押すだけ）
  side.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-rcell]');
    if (!b || e.button > 0) return;
    e.preventDefault();
    const i = Number(b.dataset.rcell);
    if (ui.tech) { placeAct(i, false); return; }
    ui.drag = { a: i, b: i };
    lastKey = '';
    render();
  });
  window.addEventListener('pointermove', (e) => {
    if (!ui.drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('#dojo-side [data-rcell]');
    if (!el) return;
    const i = Number(el.dataset.rcell);
    if (i !== ui.drag.b) { ui.drag.b = i; lastKey = ''; render(); }
  });
  window.addEventListener('pointerup', () => {
    if (!ui.drag) return;
    const { a, b } = ui.drag;
    ui.drag = null;
    const r = scrollRoom(get(), a, b);
    if (r.ok) { set(r.state); handle(r.events); } else if (r.reason) ui.roomNote = r.reason;
    lastKey = '';
    render();
  });
  // マウスホイールで押したときの中身を切り替える（判定表 第19回の一言）。盤の上だけ
  side.addEventListener('wheel', (e) => {
    const board = e.target.closest('.sudo-wrap, .beam-wrap, .nono, .mine-board, .lamps');
    const sc = get().dojo?.scroll;
    if (!board || !sc) return;
    e.preventDefault();
    const step = e.deltaY > 0 ? 1 : -1;
    const cycle = (list, cur) => list[(list.indexOf(cur) + step + list.length) % list.length];
    if (sc.kind === 'sudo') {
      ui.elem = ((ui.elem ?? 0) + step + sc.puzzle.n) % sc.puzzle.n;
    } else if (sc.kind === 'beam') {
      ui.mode = cycle(['slash', 'back', 'x'], ui.mode);
    } else if (sc.kind === 'lamps') {
      ui.mode = cycle(['lamp', 'x'], ui.mode);
    } else if (sc.kind === 'rooms') {
      return;
    } else if (sc.kind === 'nono') {
      ui.mode = cycle(sc.puzzle.colors === 2 ? ['paint1', 'paint2', 'x'] : ['paint1', 'x'], ui.mode);
    } else {
      ui.mode = cycle(['open', 'flag'], ui.mode);
    }
    ui.tech = null;
    lastKey = '';
    render();
  }, { passive: false });

  // ───── 並びのドラッグ・ドロップ（判定表 第10回 Q2：マージの盤と同じように） ─────
  // 持っている札 → 枠：その枠に置く（空きの先なら後ろに足す）。枠 → 枠：入れ替える。枠 → 枠の外：外す。
  let ldrag = null;
  let ghostEl = null;
  let skipClick = false;
  const slotUnder = (x, y) => document.elementFromPoint(x, y)?.closest('#dojo-side [data-dact="slot"]') ?? null;
  side.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const b = e.target.closest('[data-dact="card"], [data-dact="slot"]');
    if (!b || !b.closest('#dojo-body')) return;
    const s = get();
    if (b.dataset.dact === 'slot') {
      const i = Number(b.dataset.slot);
      const id = lineupFor(s, editRegion(s))[i];
      if (!id) return;
      ldrag = { from: 'slot', index: i, id, x: e.clientX, y: e.clientY, moved: false };
    } else {
      ldrag = { from: 'card', id: b.dataset.card, x: e.clientX, y: e.clientY, moved: false };
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (!ldrag) return;
    if (!ldrag.moved && Math.hypot(e.clientX - ldrag.x, e.clientY - ldrag.y) > 6) {
      ldrag.moved = true;
      ghostEl = document.createElement('div');
      ghostEl.className = 'card-ghost';
      ghostEl.textContent = CARDS[ldrag.id].name;
      document.body.appendChild(ghostEl);
    }
    if (ldrag.moved) {
      ghostEl.style.transform = `translate(${e.clientX - 36}px, ${e.clientY - 20}px)`;
      for (const el of side.querySelectorAll('.slot.hover')) el.classList.remove('hover');
      slotUnder(e.clientX, e.clientY)?.classList.add('hover');
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (!ldrag) return;
    const d = ldrag;
    ldrag = null;
    ghostEl?.remove();
    ghostEl = null;
    if (!d.moved) return;
    skipClick = true; // ドラッグの後のクリックは扱わない
    const s = get();
    const r = editRegion(s);
    const list = lineupFor(s, r).slice();
    const max = slotCount(s);
    const target = slotUnder(e.clientX, e.clientY);
    const to = target ? Math.min(Number(target.dataset.slot), list.length) : null;
    if (d.from === 'card') {
      if (to === null) return;
      if (to === list.length && list.length >= max) return;
      list[to] = d.id;
    } else if (to === null) {
      list.splice(d.index, 1); // 枠の外へ落とすと外す
    } else if (to === list.length) {
      list.splice(d.index, 1);
      list.push(d.id);
    } else {
      [list[d.index], list[to]] = [list[to], list[d.index]];
    }
    set(setLineup(s, r, list.slice(0, max)).state);
    ui.pick = null;
    ui.slot = null;
    lastKey = '';
    render();
  });
  side.addEventListener('click', (e) => {
    if (skipClick) { skipClick = false; e.stopImmediatePropagation(); }
  }, true);

  // ───── 剣の巻物の手：塗る・×、押したまま動かすと続ける（判定表 第14回） ─────
  let stroke = null; // { kind: 'paint'|'x', color, on, done: Set }
  function nonoApply(i) {
    if (!stroke || stroke.done.has(i)) return;
    stroke.done.add(i);
    const s = get();
    if (!s.dojo?.scroll || s.dojo.scroll.kind !== 'nono') return;
    if (stroke.kind === 'paint') {
      const r = scrollPaint(s, i, stroke.color);
      if (r.ok) { set(r.state); handle(r.events); }
    } else {
      const r = scrollMark(s, i, stroke.on);
      if (r.ok) set(r.state);
    }
  }
  function nonoBegin(i, asX) {
    const s = get();
    const sc = s.dojo?.scroll;
    if (!sc || sc.kind !== 'nono') return;
    if (ui.tech) {
      const r = scrollTech(s, ui.tech, i);
      ui.tech = null;
      if (r.ok) { set(r.state); handle(r.events); }
      lastKey = '';
      render();
      return;
    }
    if (asX || ui.mode === 'x') stroke = { kind: 'x', on: !sc.xs.includes(i), done: new Set() };
    else stroke = { kind: 'paint', color: ui.mode === 'paint2' ? 2 : 1, done: new Set() };
    nonoApply(i);
    lastKey = '';
    render();
  }
  let nlong = null;
  side.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-ncell]');
    if (!b) return;
    e.preventDefault();
    const i = Number(b.dataset.ncell);
    if (e.button === 2) { nonoBegin(i, true); return; }
    if (e.pointerType === 'touch') {
      nlong = { i, timer: setTimeout(() => { nlong = null; nonoBegin(i, true); }, 450) };
      return;
    }
    nonoBegin(i, false);
  });
  window.addEventListener('pointermove', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('#dojo-side [data-ncell]');
    if (nlong) {
      if (el && Number(el.dataset.ncell) !== nlong.i) { clearTimeout(nlong.timer); const i = nlong.i; nlong = null; nonoBegin(i, false); }
      else return;
    }
    if (!stroke || !el) return;
    nonoApply(Number(el.dataset.ncell));
    lastKey = '';
    render();
  });
  window.addEventListener('pointerup', () => {
    if (nlong) { clearTimeout(nlong.timer); const i = nlong.i; nlong = null; nonoBegin(i, false); }
    if (stroke) { stroke = null; lastKey = ''; render(); }
  });
  side.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-ncell]')) e.preventDefault(); });

  // ───── 描く ─────
  function render() {
    const s = get();
    const open = s.open.unlocks.includes('stage:dojo');
    $('dojo-locked').hidden = open;
    $('dojo-body').hidden = !open;
    if (!open) return;
    // 門下生の残り秒は別の欄で描く（ここに入れると毎刻み描き直してしまう）
    const key = JSON.stringify([{ ...s.dojo, disciple: null }, ui, s.dojo.disciple?.node ?? null]);
    if (key === lastKey) return;
    lastKey = key;
    $('dojo-body').innerHTML = s.dojo.scroll ? scrollHtml(s) : viewTabs() + (ui.view === 'line' ? lineHtml(s) : treeHtml(s));
  }

  function schoolTabs(s) {
    const open = Object.keys(SCHOOLS).filter((k) => schoolOpen(s, k));
    if (open.length < 2) return '';
    return '<div class="view-tabs school-tabs">' + open.map((k) =>
      `<button type="button" data-dact="school" data-school="${k}" aria-pressed="${ui.school === k}">${SCHOOLS[k].name}</button>`).join('') + '</div>';
  }

  function treeHtml(s) {
    if (!schoolOpen(s, ui.school)) { ui.school = 'guard'; ui.node = firstOf('guard'); }
    const school = SCHOOLS[ui.school];
    if (nodeOf(ui.node)?.school !== ui.school) ui.node = firstOf(ui.school);
    const t = nodeStats(s);
    const parts = Object.entries(t).filter(([, v]) => v > 0).map(([k, v]) => `${STAT[k]}${pct(v)}`);
    const WHAT = { guard: '守りの流派（巻物は罠の推理）', sword: '剣の流派（巻物はピクロス）', magic: '魔法の流派（巻物は属性の数独）', bow: '弓の流派（巻物は鏡で光を通す）', summon: '召喚の流派（巻物は部屋分け）', stealth: '隠密の流派（巻物は灯りを置く）' };
    const what = WHAT[ui.school];
    let h = schoolTabs(s) + `<p class="small">${what}。巻物を解くと熟練が入り、熟練${SKILL.perLevel}で節が1段上がる（解くと${3}、ミス1回につき −1）。<br>小さい節の強さ（流派の合計）：${parts.length ? parts.join('・') : 'まだない'}</p>`;
    if (ui.last) {
      const n = nodeOf(ui.last.node);
      h += `<p class="result">${n.name}：熟練＋${ui.last.gain}${ui.last.to > ui.last.from ? `、${ui.last.to}/5 に上がった` : ''}</p>`;
    }
    h += '<div class="tree">';
    for (const br of school.branches) {
      h += `<div class="branch"><span class="branch-name">${br}</span><div class="branch-nodes">`;
      for (const n of school.tree.filter((x) => x.branch === br)) {
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
      if (s.open.unlocks.includes('disciple')) {
        const known = (s.dojo.shapes ?? []).includes(shapeKey(spec));
        h += `<p class="small quiet">${known ? '門下生はこの形を解ける' : 'この形は門下生がまだ解けない（あなたが一度解くと解ける）'}</p>`;
      }
    } else {
      h += `<p class="quiet small">${c.reason}</p>`;
    }
    h += '</div>';
    return h;
  }

  // やめるボタン。押すとその場で「やめる／続ける」を聞く。
  function quitHtml() {
    if (!ui.quitAsk) return '<button type="button" class="mini wide" data-dact="quit">やめる（熟練は入らない）</button>';
    return '<p class="small quit-ask">この巻物をやめますか？（熟練は入らない）　' +
      '<button type="button" class="mini wide" data-dact="quit-yes">やめる</button> <button type="button" class="mini wide" data-dact="quit-no">続ける</button></p>';
  }

  // 剣の巻物（ピクロス）
  function nonoScrollHtml(s) {
    const sc = s.dojo.scroll;
    const p = sc.puzzle;
    const n = nodeOf(sc.node);
    const need = p.solution.filter((v) => v).length;
    let h = `<p class="sess-title"><b>${n.name}の巻物</b>（${sc.level}/5 → ${sc.level + 1}/5）</p>`;
    h += `<p class="small scroll-rule">${p.rules.length ? p.rules.map((r) => `<b>${NONO_RULES[r].name}</b>：${NONO_RULES[r].text}`).join('<br>') : '変えなし：数字は続けて塗るマスの長さ'}</p>`;
    const modes = [['paint1', p.colors === 2 ? '赤で塗る' : '塗る'], ...(p.colors === 2 ? [['paint2', '青で塗る']] : []), ['x', '×']];
    if (ui.mode === 'paint2' && p.colors !== 2) ui.mode = 'paint1';
    if (!['paint1', 'paint2', 'x'].includes(ui.mode)) ui.mode = 'paint1';
    h += `<div class="dojo-bar"><span class="num">塗る ${Object.keys(sc.paint).length}/${need}　ミス ${sc.mistakes}</span>` +
      `<span class="mode">${modes.map(([m, t]) => `<button type="button" data-dact="mode" data-mode="${m}" aria-pressed="${ui.mode === m && !ui.tech}">${t}</button>`).join('')}</span></div>`;
    const techs = Object.entries(sc.techs);
    if (techs.length) {
      h += '<div class="strikes">' + techs.map(([t, left]) => `<button type="button" class="opt${ui.tech === t ? ' sel' : ''}" data-dact="tech" data-tech="${t}" ${left > 0 ? '' : 'disabled'}>` +
        `${ALL_TECHS[t].name}<small>あと${left}回</small></button>`).join('') + '</div>';
      if (ui.tech) h += `<p class="small temp-note">${ALL_TECHS[ui.tech].text}。使うマスを押す（もう一度技を押すとやめる）</p>`;
    }
    h += nonoBoardHtml(sc);
    h += '<p class="small quiet">押したまま動かすと続けて塗る・×。右クリック・長押しで×。×のマスは塗れない（先に×を外す）。濃い×は技で分かった「塗らない」マス。小さい数字は出血の刃（まわり8マスの塗る数）。</p>';
    h += quitHtml();
    return h;
  }

  function techBar(sc) {
    const techs = Object.entries(sc.techs);
    if (!techs.length) return '';
    let h = '<div class="strikes">' + techs.map(([t, left]) => `<button type="button" class="opt${ui.tech === t ? ' sel' : ''}" data-dact="tech" data-tech="${t}" ${left > 0 ? '' : 'disabled'}>` +
      `${ALL_TECHS[t].name}<small>あと${left}回</small></button>`).join('') + '</div>';
    if (ui.tech) h += `<p class="small temp-note">${ALL_TECHS[ui.tech].text}。使うマスを押す（もう一度技を押すとやめる）</p>`;
    return h;
  }

  // 魔法の巻物（属性の数独）
  function sudoScrollHtml(s) {
    const sc = s.dojo.scroll;
    const p = sc.puzzle;
    const n = nodeOf(sc.node);
    let h = `<p class="sess-title"><b>${n.name}の巻物</b>（${sc.level}/5 → ${sc.level + 1}/5）</p>`;
    const base = `<b>属性の数独</b>：各行・各列・太線の囲みに ${ELEMENT_NAMES.slice(0, p.n).join('・')} が1つずつ`;
    h += `<p class="small scroll-rule">${base}${p.rules.map((r) => `<br><b>${SUDO_RULE_TEXT[r].name}</b>：${SUDO_RULE_TEXT[r].text}${r === 'react' && p.n === 6 ? '・火と風・水と土' : ''}`).join('')}</p>`;
    if (!['place', 'note'].includes(ui.mode)) ui.mode = 'place';
    if (!(ui.elem < p.n)) ui.elem = 0;
    h += `<div class="dojo-bar"><span class="num">あと ${sudoLeft(sc)}マス　ミス ${sc.mistakes}</span>` +
      `<span class="mode"><button type="button" data-dact="mode" data-mode="place" aria-pressed="${ui.mode === 'place' && !ui.tech}">置く</button>` +
      `<button type="button" data-dact="mode" data-mode="note" aria-pressed="${ui.mode === 'note' && !ui.tech}">候補の印</button></span></div>`;
    h += '<div class="elems">' + ELEMENT_NAMES.slice(0, p.n).map((name, e) =>
      `<button type="button" class="elem e${e}" data-dact="elem" data-elem="${e}" aria-pressed="${ui.elem === e}">${name}</button>`).join('') + '</div>';
    if (p.rules.includes('cycle')) {
      const chip = (e) => `<span class="chip e${e}">${ELEMENT_NAMES[e]}</span>`;
      h += `<div class="cycle-chips small">巡りの順：${[0, 1, 2, 3, 0].map(chip).join('<span class="arr">→</span>')}　（線の ● の端から矢印の向きに）</div>`;
    }
    h += techBar(sc);
    h += sudoBoardHtml(sc);
    h += '<p class="small quiet">属性を選んでからマスを押す。右クリックか「候補の印」で小さいメモ（ミスにならない。もう一度で消える）。盤の上でマウスホイールを回すと属性が変わる。</p>';
    h += quitHtml();
    return h;
  }

  // 弓の巻物（鏡で光を通す）
  function beamScrollHtml(s) {
    const sc = s.dojo.scroll;
    const p = sc.puzzle;
    const n = nodeOf(sc.node);
    let h = `<p class="sess-title"><b>${n.name}の巻物</b>（${sc.level}/5 → ${sc.level + 1}/5）</p>`;
    const base = '<b>鏡</b>：空いたマスに鏡（╱か╲）を置いて、弓の光を全部の的（◎）へ届ける。的には1本ずつ。置いた鏡には全部光が当たる。盤の外の数字はその行・列の鏡の数。岩は光を止める';
    h += `<p class="small scroll-rule">${base}${p.rules.map((r) => `<br><b>${BEAM_RULE_TEXT[r].name}</b>：${BEAM_RULE_TEXT[r].text}`).join('')}</p>`;
    if (!['slash', 'back', 'x'].includes(ui.mode)) ui.mode = 'slash';
    h += `<div class="dojo-bar"><span class="num">鏡 あと ${beamLeft(sc)}　ミス ${sc.mistakes}</span>` +
      `<span class="mode">${[['slash', '╱を置く'], ['back', '╲を置く'], ['x', '×']].map(([m, t]) => `<button type="button" data-dact="mode" data-mode="${m}" aria-pressed="${ui.mode === m && !ui.tech}">${t}</button>`).join('')}</span></div>`;
    h += techBar(sc);
    h += beamBoardHtml(sc);
    h += '<p class="small quiet">こつ：数が0の行と列には鏡がない。弓から光をたどり、曲がれる所（その行と列に鏡が残っている所）を探す。数は置いた鏡と合うと緑、超えると赤。</p>';
    h += '<p class="small quiet">光は今置いてある鏡でその場で線で通る。届いた的は ◉。右クリックで×（自分の印）。濃い×は分かった空き。「まわり◯」は狙い撃ち（選んだマスのまわり8マスの鏡の数。選んだマスは数えない）。盤の上でマウスホイールを回すと ╱・╲・× が変わる。</p>';
    h += quitHtml();
    return h;
  }

  // 召喚の巻物（部屋分け）
  function roomsScrollHtml(s) {
    const sc = s.dojo.scroll;
    const p = sc.puzzle;
    const n = nodeOf(sc.node);
    let h = `<p class="sess-title"><b>${n.name}の巻物</b>（${sc.level}/5 → ${sc.level + 1}/5）</p>`;
    const base = '<b>部屋分け</b>：盤を長方形の部屋に分ける。どの部屋にも数字がちょうど1つで、部屋のマスの数がその数字';
    h += `<p class="small scroll-rule">${base}${p.rules.map((r) => `<br><b>${ROOM_RULE_TEXT[r].name}</b>：${ROOM_RULE_TEXT[r].text}`).join('')}</p>`;
    h += `<div class="dojo-bar"><span class="num">部屋 ${sc.placed.length}/${p.rooms.length}　ミス ${sc.mistakes}</span></div>`;
    h += techBar(sc);
    h += roomsBoardHtml(sc, ui.drag);
    if (ui.roomNote) { h += `<p class="small temp-note">${ui.roomNote}</p>`; ui.roomNote = null; }
    h += '<p class="small quiet">押したまま動かして長方形を切る（1マスの部屋は押すだけ）。数字がちょうど1つ入った長方形だけ切れる。違う部屋を切るとミスで、正しい部屋が置かれる。小さい数字は岩の守り手（そのマスの部屋の大きさ）。</p>';
    h += quitHtml();
    return h;
  }

  // 隠密の巻物（灯りを置く）
  function lampsScrollHtml(s) {
    const sc = s.dojo.scroll;
    const p = sc.puzzle;
    const n = nodeOf(sc.node);
    let h = `<p class="sess-title"><b>${n.name}の巻物</b>（${sc.level}/5 → ${sc.level + 1}/5）</p>`;
    const base = '<b>灯り</b>：白いマスに灯りを置いて、白いマスを全部照らす。灯りは縦横に壁か端まで照らす。灯りどうしは照らし合わない。壁の数字は上下左右に接する灯りの数';
    h += `<p class="small scroll-rule">${base}${p.rules.map((r) => `<br><b>${LAMP_RULE_TEXT[r].name}</b>：${LAMP_RULE_TEXT[r].text}`).join('')}</p>`;
    if (!['lamp', 'x'].includes(ui.mode)) ui.mode = 'lamp';
    h += `<div class="dojo-bar"><span class="num">灯り あと ${lampLeft(sc)}　ミス ${sc.mistakes}</span>` +
      `<span class="mode">${[['lamp', '灯りを置く'], ['x', '×']].map(([m, t]) => `<button type="button" data-dact="mode" data-mode="${m}" aria-pressed="${ui.mode === m && !ui.tech}">${t}</button>`).join('')}</span></div>`;
    h += techBar(sc);
    h += lampsBoardHtml(sc);
    h += '<p class="small quiet">照らされたマスは明るくなる（×のマスも、照らされていれば明るい）。右クリックで×（自分の印）。濃い×は分かった「置かない」。盤の上でマウスホイールを回すと 灯り・× が変わる。「まわり◯」は影縫い（選んだマスのまわり8マスの灯りの数。選んだマスは数えない）。</p>';
    h += quitHtml();
    return h;
  }

  function scrollHtml(s) {
    const sc = s.dojo.scroll;
    if (sc.kind === 'nono') return nonoScrollHtml(s);
    if (sc.kind === 'sudo') return sudoScrollHtml(s);
    if (sc.kind === 'beam') return beamScrollHtml(s);
    if (sc.kind === 'rooms') return roomsScrollHtml(s);
    if (sc.kind === 'lamps') return lampsScrollHtml(s);
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
    h += quitHtml();
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
      const kind = CARD_KINDS[c.type];
      const lvText = c.node ? `・${lv}/5 効き＋${Math.round((lv - 1) * 10)}%` : '';
      return `<button type="button" class="opt card k-${c.type}${ui.pick === id ? ' sel' : ''}" data-dact="card" data-card="${id}">${c.name}<small>${kind}・${c.swings}振り${lvText}</small><small>${c.text}</small></button>`;
    }).join('') + '</div>';
    h += '<p class="small quiet">札を枠へドラッグして置く（枠どうしは入れ替え、枠の外へ落とすと外す）。押してから枠を押してもよい。同じ札を2回押すと後ろに足す。</p>';
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
        const tag = (e.together ? '（同時）' : '') + (e.skip ? '（条件が合わず次を飛ばす）' : e.mods ? `（修飾×${e.mods}）` : '');
        return `<span class="tl k-${c.type}${e.skip ? ' skip' : ''}">${c.name}<small>${tag}</small></span>`;
      }).join('<span class="arrow">→</span>') + `<span class="arrow">→</span><span class="tl recast">積み直し<small>1周 ${cycle ? cycle.toFixed(1) : '―'}秒</small></span></div>`;
    }
    return h;
  }

  return { render };
}
