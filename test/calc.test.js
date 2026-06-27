'use strict';

/*
 * 還元額計算ロジックのテスト（IMPLEMENTATION_SPEC §1・§2 準拠）。
 *
 * 本アプリは単一 HTML 構成（index.html に HTML/CSS/JS を同梱）のため、
 * ロジックを二重定義せず、index.html 内の @test マーカー区間を抽出して評価する。
 * これにより本体の実装とテスト対象が乖離しにくくなる。
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const INDEX_HTML = path.join(__dirname, '..', 'index.html');

// index.html の @test:start / @test:end 区間（純粋ロジック）を取り出して評価する
function loadCalc() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/\/\*\s*@test:start[\s\S]*?\*\/([\s\S]*?)\/\*\s*@test:end\s*\*\//);
  assert.ok(m, 'index.html に @test:start / @test:end マーカーが見つかりません');

  const context = {};
  vm.createContext(context);
  const src =
    '"use strict";\n' +
    m[1] +
    '\nglobalThis.__exports = { calcGrant, calcBreakdown, PER_TX_CAP, SERVICE_CAP, RATE_HIGH, RATE_LOW };';
  vm.runInContext(src, context, { filename: 'index.html#calc' });
  return context.__exports;
}

const calc = loadCalc();

test('定数がキャンペーン要項どおり（§1）', () => {
  assert.equal(calc.PER_TX_CAP, 1500, '1回上限');
  assert.equal(calc.SERVICE_CAP, 2500, 'サービス上限');
  assert.equal(calc.RATE_HIGH, 0.2, '中小・小規模店の還元率');
  assert.equal(calc.RATE_LOW, 0.1, '大手店の還元率');
});

// IMPLEMENTATION_SPEC §2「受け入れ用テストケース（必ず通すこと）」の表をそのまま検証する
const SPEC_CASES = [
  { amount: 10000, rate: 0.2, prior: 0, expected: 1500, note: '1回上限で丸め（理論2000→1500）' },
  { amount: 5000, rate: 0.2, prior: 0, expected: 1000, note: '上限未満そのまま' },
  { amount: 10000, rate: 0.1, prior: 0, expected: 1000, note: '10%店' },
  { amount: 5000, rate: 0.2, prior: 2000, expected: 500, note: 'サービス残枠で丸め（残500）' },
  { amount: 5000, rate: 0.2, prior: 2500, expected: 0, note: '上限到達済み' },
  { amount: 7500, rate: 0.2, prior: 0, expected: 1500, note: '20%店で1回上限ちょうど' },
  { amount: 15000, rate: 0.1, prior: 0, expected: 1500, note: '10%店で1回上限ちょうど' },
];

test('calcGrant が §2 の受け入れケースを全て満たす', async (t) => {
  for (const c of SPEC_CASES) {
    await t.test(`amount=${c.amount} rate=${c.rate} prior=${c.prior} → ${c.expected}（${c.note}）`, () => {
      assert.equal(calc.calcGrant(c.amount, c.rate, c.prior), c.expected);
    });
  }
});

test('端数は切り捨て（floor）', () => {
  // 999 × 0.20 = 199.8 → 199
  assert.equal(calc.calcGrant(999, 0.2, 0), 199);
  // 4999 × 0.10 = 499.9 → 499
  assert.equal(calc.calcGrant(4999, 0.1, 0), 499);
});

test('実付与額は負にならない（残枠が負でも 0）', () => {
  assert.equal(calc.calcGrant(5000, 0.2, 3000), 0);
});

test('累積すると残枠どおりに頭打ちになる', () => {
  // 残枠 = 2500 − 付与累計。同一サービスへの連続記録を再現する。
  let prior = 0;
  prior += calc.calcGrant(5000, 0.2, prior); // 残2500 → +1000
  assert.equal(prior, 1000);
  prior += calc.calcGrant(5000, 0.2, prior); // 残1500 → +1000
  assert.equal(prior, 2000);
  prior += calc.calcGrant(5000, 0.2, prior); // 残500 → +500
  assert.equal(prior, 2500);
  prior += calc.calcGrant(5000, 0.2, prior); // 上限到達 → +0
  assert.equal(prior, 2500);
});

test('calcBreakdown が丸め・上限到達のフラグを返す（§3.2 の明示用）', () => {
  const perTx = calc.calcBreakdown(10000, 0.2, 0);
  assert.equal(perTx.granted, 1500);
  assert.equal(perTx.perTxApplied, true, '1回上限による丸めを検知');

  const capped = calc.calcBreakdown(5000, 0.2, 2000);
  assert.equal(capped.granted, 500);
  assert.equal(capped.serviceCapped, true, 'サービス残枠による丸めを検知');
  assert.equal(capped.reachesCap, true, 'この記録で上限到達');

  const full = calc.calcBreakdown(5000, 0.2, 2500);
  assert.equal(full.granted, 0);
  assert.equal(full.alreadyFull, true, '既に上限到達済み');
});
