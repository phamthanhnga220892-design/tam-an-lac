// Lưu trữ cục bộ (R8) — toàn bộ dữ liệu nằm trong localStorage của thiết bị.
import { PRESET_EVENTS } from './events.js';

const KEY = 'thaptrai.v1';

function defaults() {
  return {
    version: 1,
    settings: {
      mode: 'thapTrai',
      reminders: [
        { id: 'r1', daysBefore: 1, time: '20:00', enabled: true },
        { id: 'r2', daysBefore: 0, time: '06:00', enabled: true },
      ],
      bannerDismissedAt: 0,
    },
    events: PRESET_EVENTS.map((e) => ({ ...e })),
    log: {}, // { 'YYYY-MM-DD': true } — ngày đã ăn chay
    notified: {}, // { 'reminderId|YYYY-MM-DD': timestamp } — tránh nhắc trùng
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return migrate(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

function migrate(s) {
  const d = defaults();
  const out = { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
  // Bổ sung các ngày gợi ý mới (nếu có) mà dữ liệu cũ chưa có
  const ids = new Set(out.events.map((e) => e.id));
  for (const p of PRESET_EVENTS) if (!ids.has(p.id)) out.events.push({ ...p });
  return out;
}

export function getState() {
  return state;
}

export function update(fn) {
  fn(state);
  persist();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn — bỏ qua */
  }
  listeners.forEach((l) => l(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function exportJSON() {
  return JSON.stringify({ app: 'thap-trai', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed && parsed.data ? parsed.data : parsed;
  if (!data || !Array.isArray(data.events) || !data.settings) throw new Error('File không đúng định dạng');
  state = migrate(data);
  persist();
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
