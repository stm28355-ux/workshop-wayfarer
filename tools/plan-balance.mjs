// バランスの予定を計算する道具（ゲームには出ない）。判定表 第4回 D の予定表はこの計算。
// node tools/plan-balance.mjs [C=30] [sk=1.6] [lv=1.08] …
// 勇者の強さの予定（レベル×装備×技）を先に決め、そこから敵の強さ（ボスの HP・道の敵）を出す。
// 格の基本は2倍ずつ・地金は3倍ずつ。加算は格ごとに4回まで。レベルは掛け算。落とし物の価値は地域ごとに2倍。
// 配り方は 地域1：育てる55%、地域2から：育てる25%・装備30%（武器55%・防具45%）。出来は80%。
// 工程ごとに、ボットと人の記録をこの表と並べてずれを見る。
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
// 地域ごとの分（判定表 第11回 D1：歩く速さ2倍に合わせて、累計 15・40・75分…魔王まで約4時間半）
const T = (args.T ?? '15,25,35,46,57,86').split(',').map(Number);
const PICK = 22, VG = Number(args.vg ?? 2);
const C = Number(args.C ?? 30), A = 6, H = 30, ADD = 0.25, CAP = Number(args.cap ?? 4), Q = 0.8;
const BA = Number(args.ba ?? 10), BH = Number(args.bh ?? 60), P1 = Number(args.p1 ?? 26);
const BG = Number(args.bg ?? 2);
const LV = Number(args.lv ?? 1.08), SK = Number(args.sk ?? 1.6);
const BOSS_SEC = [10, 20, 30, 40, 50, 75], ROAD_SEC = [0.5, 1, 1.5, 2, 2, 2.5];
const xpToNext = (L) => Math.ceil(10 * 1.6 ** (L - 1));
const base = (n, b) => (n <= 0 ? 0 : b * BG ** (n - 1));
const cost = (n) => C * 3 ** (n - 1);
let L = 1, xp = 0;
const mk = () => ({ n: 0, adds: {}, wallet: 0, crafts: 0 });
const gear = { w: mk(), a: mk() };
const power = (g, b) => base(g.n, b) * Q + Object.entries(g.adds).reduce((s, [k, c]) => s + c * ADD * base(+k, b) * Q, 0);
const rows = []; let clock = 0;
for (let r = 1; r <= 6; r++) {
  const inc = (r === 1 ? P1 : PICK) * VG ** (r - 1) * (r === 1 ? 1 : 1.15);
  const share = r === 1 ? { grow: 0.55, forge: 0 } : { grow: 0.25, forge: 0.3 };
  for (let m = 0; m < T[r - 1]; m++) {
    xp += inc * share.grow;
    while (xp >= xpToNext(L)) { xp -= xpToNext(L); L++; }
    for (const [k, part] of [['w', 0.55], ['a', 0.45]]) {
      const g = gear[k]; g.wallet += inc * share.forge * part;
      while (true) {
        if (g.wallet >= cost(g.n + 1)) { g.wallet -= cost(g.n + 1); g.n++; g.crafts++; continue; }
        // 加算の残りがある一番上の格を打つ
        let did = false;
        for (let t = g.n; t >= 1; t--) {
          if ((g.adds[t] ?? 0) < CAP && g.wallet >= cost(t)) { g.wallet -= cost(t); g.adds[t] = (g.adds[t] ?? 0) + 1; g.crafts++; did = true; break; }
          if ((g.adds[t] ?? 0) < CAP) break; // 上の格の加算が残っているうちは下を打たない
        }
        if (!did) break;
      }
    }
  }
  clock += T[r - 1];
  const m = LV ** (L - 1), wAtk = power(gear.w, A), aHp = power(gear.a, H), skill = SK ** (r - 1);
  const dps = (BA + wAtk) * m * skill, hp = (BH + aHp) * m;
  rows.push({ 地域: r, 累計分: clock, 毎分: Math.round(inc), Lv: L, Lv倍: +m.toFixed(2), 武器格: gear.w.n, 武器: Math.round(wAtk), 打数: gear.w.crafts, 防具格: gear.a.n, HP: Math.round(hp), 技: +skill.toFixed(2), 毎秒: Math.round(dps),
    ボスHP: Math.round(dps * BOSS_SEC[r - 1]), 道HP: Math.round(dps * ROAD_SEC[r - 1]), 道の攻撃: Math.round(0.08 * hp / Math.max(ROAD_SEC[r - 1], 0.5)) });
}
console.table(rows);
for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], b = rows[i];
  console.log(`地域${a.地域}→${b.地域}：強さ×${(b.毎秒 / a.毎秒).toFixed(2)}（レベル×${(b.Lv倍 / a.Lv倍).toFixed(2)}・装備×${((BA + b.武器) / (BA + a.武器)).toFixed(2)}・技×${SK}）`); }
