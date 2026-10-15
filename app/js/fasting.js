// Quy tắc ngày chay dạng cấu hình (BR1, BR2, BR4) — không hard-code trong UI.
import { solarToLunar, jdToDate, jdFromDate } from './lunar.js';

export const FASTING_MODES = {
  thapTrai: {
    name: 'Thập Trai',
    full: [1, 8, 14, 15, 18, 23, 24, 28, 29, 30],
    // Tháng thiếu: 28, 29, 30 → 27, 28, 29
    short: [1, 8, 14, 15, 18, 23, 24, 27, 28, 29],
  },
  lucTrai: {
    name: 'Lục Trai',
    full: [8, 14, 15, 23, 29, 30],
    short: [8, 14, 15, 23, 28, 29],
  },
  nhiTrai: {
    name: 'Nhị Trai',
    full: [1, 15],
    short: [1, 15],
  },
};

export function fastingDaysOfMonth(monthLength, mode = 'thapTrai') {
  const m = FASTING_MODES[mode] || FASTING_MODES.thapTrai;
  return monthLength >= 30 ? m.full : m.short;
}

export function isFastingDay(lunar, mode = 'thapTrai') {
  return fastingDaysOfMonth(lunar.monthLength, mode).includes(lunar.day);
}

/** Danh sách ngày chay (dương lịch) của tháng âm chứa ngày dương cho trước */
export function fastingDatesOfLunarMonth(date, mode = 'thapTrai') {
  const l = solarToLunar(date.getDate(), date.getMonth() + 1, date.getFullYear());
  return fastingDaysOfMonth(l.monthLength, mode).map((d) => {
    const s = jdToDate(l.monthStartJd + d - 1);
    return { lunarDay: d, date: new Date(s.year, s.month - 1, s.day) };
  });
}

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

export function daysBetween(a, b) {
  return jdFromDate(b.getDate(), b.getMonth() + 1, b.getFullYear()) - jdFromDate(a.getDate(), a.getMonth() + 1, a.getFullYear());
}

export function lunarOf(date) {
  return solarToLunar(date.getDate(), date.getMonth() + 1, date.getFullYear());
}
