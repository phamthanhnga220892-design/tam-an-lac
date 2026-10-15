// Tiện ích giao diện dùng chung
import { lunarMonthName, lunarDayLabel } from './lunar.js';

export const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function dmy(d, withYear = false) {
  const s = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return withYear ? `${s}/${d.getFullYear()}` : s;
}

/** "Mùng 8 tháng 9 ÂL" / "15 tháng 6 nhuận ÂL" */
export function lunarText(l, opts = {}) {
  const day = lunarDayLabel(l.day);
  const month = opts.numeric ? `${l.month}${l.leap ? ' nhuận' : ''}` : lunarMonthName(l.month, l.leap);
  return `${day} tháng ${month}${opts.suffix === false ? '' : ' ÂL'}`;
}

export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

/** Bottom sheet. render(close) trả về HTML; onMount(root, close) gắn sự kiện. */
export function openSheet(html, onMount) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet__grip"></div>${html}</div>`;
  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  root.querySelector('.sheet-backdrop').addEventListener('click', close);
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(root.querySelector('.sheet'), close);
  root.querySelector('.sheet input, .sheet button:not([data-close])')?.focus({ preventScroll: true });
  return close;
}

// Tiếng chuông thiền tổng hợp bằng Web Audio (không cần file âm thanh)
let audioCtx;
export function ringBell() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 6);
    master.connect(ctx.destination);
    [[220, 1], [528, 0.5], [880, 0.25], [1320, 0.12]].forEach(([f, g]) => {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = Math.random() * 6 - 3;
      gn.gain.value = g;
      o.connect(gn).connect(master);
      o.start(now);
      o.stop(now + 6);
    });
  } catch {
    /* thiết bị không hỗ trợ âm thanh */
  }
}

export function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
