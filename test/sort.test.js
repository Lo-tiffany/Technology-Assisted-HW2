import test from 'node:test';
import assert from 'node:assert/strict';
import { sortEvents } from '../src/core/sort.js';
import { ev } from './helpers.js';

const ids = (list) => list.map((e) => e.id);

test('依時間由新到舊(預設)', () => {
  const events = [ev('a', 4, 100), ev('b', 4, 300), ev('c', 4, 200)];
  assert.deepEqual(ids(sortEvents(events)), ['b', 'c', 'a']);
});

test('依規模由小到大', () => {
  const events = [ev('a', 5), ev('b', 3), ev('c', 4)];
  assert.deepEqual(ids(sortEvents(events, 'magnitude', 'asc')), ['b', 'c', 'a']);
});

test('null 不論升降冪都排最後', () => {
  const events = [ev('n', null), ev('a', 5), ev('b', 3)];
  assert.deepEqual(ids(sortEvents(events, 'magnitude', 'asc')), ['b', 'a', 'n']);
  assert.deepEqual(ids(sortEvents(events, 'magnitude', 'desc')), ['a', 'b', 'n']);
});

test('相同值維持原本順序(穩定排序)', () => {
  const events = [ev('a', 5), ev('b', 5), ev('c', 5)];
  assert.deepEqual(ids(sortEvents(events, 'magnitude')), ['a', 'b', 'c']);
});

test('不會修改輸入陣列;空陣列可排序', () => {
  const events = [ev('a', 5), ev('b', 3)];
  sortEvents(events, 'magnitude', 'asc');
  assert.deepEqual(ids(events), ['a', 'b']);
  assert.deepEqual(sortEvents([]), []);
});

test('無效的排序欄位或方向會丟出錯誤', () => {
  assert.throws(() => sortEvents([], 'color'), /sortBy/);
  assert.throws(() => sortEvents([], 'time', 'up'), /order/);
});
