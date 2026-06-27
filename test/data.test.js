'use strict';

/*
 * データ初期化ヘルパー（freshData）のテスト。
 *
 * calc.test.js と同様、単一 HTML 構成を保つため index.html 内の
 * @test:data:start / @test:data:end 区間を抽出して評価する。
 * freshData は ID 採番関数 genId に依存するため、テスト側で決定的な
 * スタブを注入し、戻り値の構造的な不変条件のみを検証する
 * （DOM / localStorage を伴う clearAllData・init は対象外。ブラウザで確認する）。
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const INDEX_HTML = path.join(__dirname, '..', 'index.html');

// index.html の @test:data 区間（freshData）を取り出し、genId を注入して評価する
function loadDataHelpers() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/\/\*\s*@test:data:start[\s\S]*?\*\/([\s\S]*?)\/\*\s*@test:data:end\s*\*\//);
  assert.ok(m, 'index.html に @test:data:start / @test:data:end マーカーが見つかりません');

  // genId は Date.now/Math.random 由来で非決定的なため、テストでは連番スタブを注入する
  let seq = 0;
  const context = { genId: (prefix) => `${prefix}_test_${++seq}` };
  vm.createContext(context);
  const src = '"use strict";\n' + m[1] + '\nglobalThis.__exports = { freshData };';
  vm.runInContext(src, context, { filename: 'index.html#data' });
  return context.__exports;
}

const { freshData } = loadDataHelpers();

test('freshData は初期化後の最小状態（ユーザー1名・記録なし）を返す', () => {
  const d = freshData();
  assert.equal(d.version, 1, 'version は 1');
  // d は VM コンテキスト（別レルム）生成のため、deepStrictEqual ではなく
  // レルムを跨いでも安全な Array.isArray / length で検証する
  assert.ok(Array.isArray(d.payments), 'payments は配列');
  assert.equal(d.payments.length, 0, '記録は空');
  assert.equal(d.users.length, 1, 'ユーザーは1名（init() の再シードガード users.length > 0 を満たす）');
  assert.equal(typeof d.users[0].name, 'string');
  assert.ok(d.users[0].name.length > 0, '既定ユーザー名が非空');
  assert.equal(d.activeUserId, d.users[0].id, 'activeUserId が唯一のユーザーを指す');
});

test('freshData は呼び出しごとに独立したオブジェクトを返す', () => {
  const a = freshData();
  const b = freshData();
  assert.notEqual(a.users, b.users, 'users 配列が共有されていない');
  assert.notEqual(a.payments, b.payments, 'payments 配列が共有されていない');
  // clearAllData は戻り値を DATA に代入後に commit/push で変更するため、可変な独立インスタンスである必要がある
  a.payments.push({ id: 'x' });
  assert.equal(b.payments.length, 0, '別インスタンスの payments に影響しない');
});
