import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCut, groupBox } from '../src/game/cut';
import { areAdjacent, createGame, gameReducer, isDropCorrect, pieceCount, validateGameState } from '../src/game/engine';
import { arrangeTray, computePieceStats, decodeBase64, toneName } from '../src/game/stats';
import { boardSize, gridFor, presetTarget } from '../src/game/types';
import { applyGesture, clampView, computeLayout, fitView, hitSlot, initialView, slotRect, toBoard, toScreen } from '../src/features/game/layout';

const ASPECTS = [2400 / 1767, 1965 / 2400, 2400 / 1611, 1];

test('hazır seviyeler gerçek parça sayısına yakın ızgara üretir (±6%)', () => {
  for (const a of ASPECTS) {
    for (const n of [100, 300, 500, 750, 1000]) {
      const g = gridFor(n, a);
      const real = g.cols * g.rows;
      assert.ok(Math.abs(real - n) / n < 0.06, `${n} @ ${a.toFixed(2)} → ${real}`);
      // hücreler kareye yakın
      const size = boardSize(a);
      const ratio = size.w / g.cols / (size.h / g.rows);
      assert.ok(ratio > 0.8 && ratio < 1.25, `hücre oranı ${ratio}`);
    }
  }
  assert.equal(presetTarget('expert', true), 1000);
  assert.equal(presetTarget('expert', false), 750);
});

test('çocuk seviyesi yok: en az 100 parça', () => {
  const s = createGame({ puzzleId: 'x', target: 12, aspect: 1.3, seed: 1 });
  assert.ok(pieceCount(s) >= 96);
});

test('kesim deterministik; komşu kenarlar aynı eğriyi paylaşır', () => {
  const size = boardSize(1.4);
  const spec = { cols: 20, rows: 14, edgeStyle: 'irregular' as const, boardW: size.w, boardH: size.h };
  const a = generateCut(spec, 42);
  const b = generateCut(spec, 42);
  assert.deepEqual(a.pieces.map((p) => p.path), b.pieces.map((p) => p.path));
  assert.ok(a.seams.length > 1000);
  // 0. parçanın sağ kenarı = 1. parçanın sol kenarı (ters yönde): ortak koordinat kümeleri
  const nums = (d: string) => new Set((d.match(/-?\d+(\.\d+)?/g) ?? []).map(String));
  const p0 = nums(a.pieces[0].path);
  const p1 = nums(a.pieces[1].path);
  const shared = [...p0].filter((x) => p1.has(x)).length;
  assert.ok(shared >= 6, `ortak nokta ${shared}`);
});

test('gruplar: yalnızca komşular birleşir, grup birlikte yerleşir', () => {
  let s = createGame({ puzzleId: 'x', target: 100, aspect: 1, seed: 5 });
  const cols = s.cols;
  assert.ok(areAdjacent([0], [1], cols));
  assert.ok(areAdjacent([0], [cols], cols));
  assert.ok(!areAdjacent([cols - 1], [cols], cols)); // satır sonu ≠ sonraki satır başı
  assert.ok(!areAdjacent([0], [2], cols));
  s = gameReducer(s, { type: 'merge', from: 0, into: 2 }); // komşu değil → değişmez
  assert.equal(s.tray.length, pieceCount(s));
  s = gameReducer(s, { type: 'merge', from: 0, into: 1 });
  assert.equal(s.tray.length, pieceCount(s) - 1);
  s = gameReducer(s, { type: 'merge', from: cols, into: 0 });
  const group = s.tray.find((g) => g.includes(0))!;
  assert.deepEqual(group, [0, 1, cols]);
  s = gameReducer(s, { type: 'place', anchor: 0 });
  assert.equal(s.placedCount, 3);
  assert.ok(s.placed.startsWith('11'));
  assert.ok(validateGameState(JSON.parse(JSON.stringify(s))));
});

test('yanlış bırakma sessiz: yalnızca hamle sayılır', () => {
  let s = createGame({ puzzleId: 'x', target: 100, aspect: 1, seed: 5 });
  s = gameReducer(s, { type: 'miss' });
  assert.equal(s.moves, 1);
  assert.equal(s.placedCount, 0);
});

test('tüm gruplar yerleşince tamamlanır', () => {
  let s = createGame({ puzzleId: 'x', target: 100, aspect: 1.5, seed: 9 });
  for (const g of [...s.tray]) s = gameReducer(s, { type: 'place', anchor: g[0] });
  assert.equal(s.status, 'complete');
  assert.equal(s.placedCount, pieceCount(s));
});

test('bırakma toleransı uzaklaştırılmışken parmağa göre genişler ama komşu hücreye taşmaz', () => {
  const cell = { w: 40, h: 40 };
  const t = { cx: 100, cy: 100 };
  assert.ok(isDropCorrect(t, 112, 100, cell, 2)); // yakın planda 0.36*40=14.4
  assert.ok(!isDropCorrect(t, 120, 100, cell, 2));
  assert.ok(isDropCorrect(t, 120, 100, cell, 0.3)); // uzakta: 12px/0.3=40 → üst sınır 0.62*40=24.8
  assert.ok(!isDropCorrect(t, 140, 100, cell, 0.3)); // komşu hücre merkezi kabul edilmez
});

test('bozuk kayıt reddedilir', () => {
  assert.equal(validateGameState(null), null);
  assert.equal(validateGameState({ version: 1 }), null);
  const s = createGame({ puzzleId: 'x', target: 300, aspect: 1, seed: 1 });
  const bad = { ...s, tray: [...s.tray, [0]] }; // yinelenen parça
  assert.equal(validateGameState(JSON.parse(JSON.stringify(bad))), null);
});

test('istatistikler: palet tonu, desen ve filtreler', () => {
  // 4x2 küçük görsel: sol yarı kırmızı düz, sağ yarı mavi-beyaz damalı
  const w = 4, h = 2;
  const bytes: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bytes.push(...(x < 2 ? [200, 30, 30] : (x + y) % 2 ? [20, 40, 200] : [240, 240, 240]));
  const rgb = Buffer.from(bytes).toString('base64');
  assert.deepEqual([...decodeBase64(rgb)], bytes);
  const stats = computePieceStats({ w, h, rgb }, 2, 1, ['#C81E1E', '#1428C8']);
  assert.equal(stats[0].tone, 0);
  assert.ok(stats[1].detail > stats[0].detail);
  const tray = [[0], [1]];
  assert.deepEqual(arrangeTray(tray, stats, () => false, { kind: 'tone', tone: 0 }, 'shuffled', false), [[0]]);
  assert.deepEqual(arrangeTray(tray, stats, () => false, { kind: 'pattern', busy: true }, 'shuffled', false), [[1]]);
  assert.deepEqual(arrangeTray([[1], [0, 1]], stats, () => false, { kind: 'groups' }, 'shuffled', false), [[0, 1]]);
  assert.equal(toneName('#C81E1E', 'tr'), 'kırmızı');
});

test('yerleşim: küçük telefondan yatay ekrana sığar, slotlar ≥ 48px', () => {
  for (const [w, h] of [[320, 548], [360, 616], [390, 790], [430, 870], [800, 360]]) {
    for (const sub of [false, true]) {
      const L = computeLayout(w, h, sub);
      assert.ok(L.board.h >= 150, `tahta çok küçük ${w}x${h}`);
      assert.ok(L.tray.y + L.tray.h <= L.toolbar.y + 0.5);
      assert.ok(L.slot >= 50, `slot ${L.slot} @ ${w}x${h}`);
      assert.ok(L.pageSize >= 5, `sayfa ${L.pageSize} @ ${w}x${h}`);
      const last = slotRect(L, L.pageSize - 1);
      assert.ok(last.y + last.h <= L.pager.y + 0.5 && last.x + last.w <= L.tray.x + L.tray.w + 0.5);
      assert.equal(hitSlot(L, last.x + 2, last.y + 2), L.pageSize - 1);
    }
  }
});

test('yakınlaştırma matematiği: odak noktası sabit kalır', () => {
  const v = fitView(360, 300, 1000, 750);
  const f = { x: 120, y: 80 };
  const before = toBoard(v, f.x, f.y);
  const v2 = applyGesture(v, 3, f, f);
  const after = toBoard(v2, f.x, f.y);
  assert.ok(Math.abs(before.x - after.x) < 1e-6 && Math.abs(before.y - after.y) < 1e-6);
  const sc = toScreen(v2, after.x, after.y);
  assert.ok(Math.abs(sc.x - f.x) < 1e-6);
  // sınırlar
  const far = clampView({ s: 100, x0: 99999, y0: -99999 }, 360, 300, 1000, 750, 40);
  assert.ok(far.s <= 120 / 40 + 1e-9);
  assert.ok(far.x0 <= 1000);
  // büyük yapbozda başlangıç: sol üst ve okunabilir hücre
  const iv = initialView(360, 300, 1000, 750, 1000 / 26, 494);
  assert.ok(iv.s * (1000 / 26) >= 30);
  assert.ok(iv.x0 < 0);
  const box = groupBox(generateCut({ cols: 4, rows: 3, edgeStyle: 'classic', boardW: 1000, boardH: 750 }, 1), [0, 1]);
  assert.equal(box.minCol, 0);
  assert.equal(box.maxCol, 1);
});

// ---- Masa düzeni
import { arrangeTable } from '../src/game/engine';
import { boardSize as bs } from '../src/game/types';

test('masa: tüm tek parçalar tahtanın dışına ve üst üste binmeden dizilir', () => {
  const g = createGame({ puzzleId: 'x', target: 300, aspect: 1.4, seed: 5 });
  const table = arrangeTable(g, 0.55, 9);
  const { w, h } = bs(g.aspect);
  const cw = w / g.cols, ch = h / g.rows;
  assert.equal(Object.keys(table).length, g.cols * g.rows);
  const pts: [number, number][] = [];
  for (const [k, [dx, dy]] of Object.entries(table)) {
    const id = Number(k);
    const x = ((id % g.cols) + 0.5) * cw + dx;
    const y = (Math.floor(id / g.cols) + 0.5) * ch + dy;
    assert.ok(x < 0 || x > w || y < 0 || y > h, 'parça tahtanın dışında olmalı');
    pts.push([x, y]);
  }
  // Yuvalar en az ~1.4 hücre aralıklı (titreşim dahil)
  let minD = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) minD = Math.min(minD, Math.max(Math.abs(pts[i][0] - pts[j][0]) / cw, Math.abs(pts[i][1] - pts[j][1]) / ch));
  assert.ok(minD > 1.4, `min aralık ${minD}`);
});

test('masa: taşı, birleştir, yerleştir', () => {
  let g = createGame({ puzzleId: 'x', target: 100, aspect: 1, seed: 3 });
  g = gameReducer(g, { type: 'tableArrange', aspect: 0.6, seed: 1 });
  g = gameReducer(g, { type: 'tableMove', anchor: 0, dx: 50, dy: 60 });
  assert.deepEqual(g.table!['0'], [50, 60]);
  assert.deepEqual(g.tray[g.tray.length - 1], [0]);
  g = gameReducer(g, { type: 'tableJoin', from: 1, into: 0 });
  assert.deepEqual(g.table!['0'], [50, 60]);
  assert.equal(g.table!['1'], undefined);
  assert.ok(g.tray.some((t) => t.length === 2 && t[0] === 0 && t[1] === 1));
  // komşu olmayanlar birleşmez
  const before = g.tray.length;
  g = gameReducer(g, { type: 'tableJoin', from: 50, into: 0 });
  assert.equal(g.tray.length, before);
  g = gameReducer(g, { type: 'place', anchor: 0 });
  assert.equal(g.placedCount, 2);
  assert.equal(g.table!['0'], undefined);
  assert.ok(validateGameState(JSON.parse(JSON.stringify(g))));
});
