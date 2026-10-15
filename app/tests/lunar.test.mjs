// Chạy: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solarToLunar, lunarToSolar, leapMonthOfYear, canChiYear } from '../js/lunar.js';
import { fastingDaysOfMonth, isFastingDay } from '../js/fasting.js';
import { eventsOn } from '../js/events.js';

// Mùng 1 Tết theo lịch Vạn Niên Việt Nam
const TET = {
  2025: [29, 1], 2026: [17, 2], 2027: [6, 2], 2028: [26, 1], 2029: [13, 2], 2030: [2, 2],
  2031: [23, 1], 2032: [11, 2], 2033: [31, 1], 2034: [19, 2], 2035: [8, 2],
};

test('Mùng 1 Tết 2025–2035', () => {
  for (const [y, [d, m]] of Object.entries(TET)) {
    const l = solarToLunar(d, m, +y);
    assert.deepEqual([l.day, l.month, l.year, l.leap], [1, 1, +y, false], `Tết ${y}`);
    assert.deepEqual(lunarToSolar(1, 1, +y), { day: d, month: m, year: +y });
  }
});

test('Tháng nhuận 2025–2035', () => {
  const expected = { 2025: 6, 2026: 0, 2027: 0, 2028: 5, 2029: 0, 2030: 0, 2031: 3, 2032: 0, 2033: 11, 2034: 0, 2035: 0 };
  for (const [y, m] of Object.entries(expected)) assert.equal(leapMonthOfYear(+y), m, `năm ${y}`);
  // 25/7/2025 là mùng 1 tháng 6 nhuận Ất Tỵ
  const l = solarToLunar(25, 7, 2025);
  assert.deepEqual([l.day, l.month, l.leap], [1, 6, true]);
});

test('Các ngày âm đã biết', () => {
  const cases = [
    [[12, 5, 2025], [15, 4, 2025]], // Phật Đản 2025
    [[6, 9, 2025], [15, 7, 2025]], // Vu Lan 2025
    [[10, 10, 2026], [1, 9, 2026]],
    [[15, 10, 2026], [6, 9, 2026]],
    [[1, 1, 2025], [2, 12, 2024]],
  ];
  for (const [[d, m, y], [ld, lm, ly]] of cases) {
    const l = solarToLunar(d, m, y);
    assert.deepEqual([l.day, l.month, l.year], [ld, lm, ly], `${d}/${m}/${y}`);
  }
});

test('Độ dài tháng âm là 29 hoặc 30 và nối tiếp nhau', () => {
  let d = new Date(2025, 0, 1);
  const end = new Date(2036, 0, 1);
  let prev = null;
  while (d < end) {
    const l = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
    assert.ok(l.monthLength === 29 || l.monthLength === 30);
    assert.ok(l.day >= 1 && l.day <= l.monthLength);
    if (prev) {
      if (l.day === 1) assert.equal(prev.day, prev.monthLength, `${d.toDateString()}`);
      else assert.equal(l.day, prev.day + 1);
    }
    prev = l;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
});

test('BR1/BR2: Thập Trai tháng đủ và tháng thiếu đều 10 ngày', () => {
  assert.deepEqual(fastingDaysOfMonth(30), [1, 8, 14, 15, 18, 23, 24, 28, 29, 30]);
  assert.deepEqual(fastingDaysOfMonth(29), [1, 8, 14, 15, 18, 23, 24, 27, 28, 29]);
  assert.equal(isFastingDay({ day: 27, monthLength: 29 }), true);
  assert.equal(isFastingDay({ day: 27, monthLength: 30 }), false);
});

test('BR5/BR6: sự kiện ngày 30 dời về 29, không áp dụng tháng nhuận', () => {
  const ev = [{ id: 'a', enabled: true, repeat: 'yearly', day: 30, month: 7, remindInLeap: false }];
  assert.equal(eventsOn({ day: 29, month: 7, leap: false, monthLength: 29 }, ev).length, 1);
  assert.equal(eventsOn({ day: 29, month: 7, leap: false, monthLength: 30 }, ev).length, 0);
  const ev2 = [{ id: 'b', enabled: true, repeat: 'yearly', day: 15, month: 6, remindInLeap: false }];
  assert.equal(eventsOn({ day: 15, month: 6, leap: true, monthLength: 30 }, ev2).length, 0);
  ev2[0].remindInLeap = true;
  assert.equal(eventsOn({ day: 15, month: 6, leap: true, monthLength: 30 }, ev2).length, 1);
});

test('Can chi năm', () => {
  assert.equal(canChiYear(2025), 'Ất Tỵ');
  assert.equal(canChiYear(2026), 'Bính Ngọ');
});
