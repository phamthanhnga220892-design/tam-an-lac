// R4 — Lịch tháng dương, kèm ngày âm, ngày chay và ngày Phật pháp
import { getState, update } from '../store.js';
import { canChiDay, canChiMonth, canChiYear, tietKhi, lunarMonthName } from '../lunar.js';
import { toKey, addDays, daysBetween } from '../fasting.js';
import { dayInfo } from '../notify.js';
import { esc, dmy, WEEKDAYS, lunarText, openSheet, toast } from '../ui.js';
import { openEventForm } from './events.js';

let viewY = null;
let viewM = null; // 0..11

window.addEventListener('go-today', () => {
  viewY = null;
});

export function renderCalendar(root) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (viewY === null) {
    viewY = today.getFullYear();
    viewM = today.getMonth();
  }
  const state = getState();
  const first = new Date(viewY, viewM, 1);
  const lead = (first.getDay() + 6) % 7; // Thứ Hai đầu tuần
  const start = addDays(first, -lead);
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);

  const cells = [];
  const fastList = [];
  const eventList = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const info = dayInfo(d, state);
    const inMonth = d.getMonth() === viewM;
    if (inMonth && info.fasting) fastList.push(info);
    if (inMonth && info.events.length) eventList.push(info);
    cells.push(cellHTML(info, inMonth, today, state));
  }
  const lFirst = dayInfo(first, state).lunar;
  const lLast = dayInfo(new Date(viewY, viewM, daysInMonth), state).lunar;
  const lunarRange =
    lFirst.month === lLast.month && lFirst.leap === lLast.leap
      ? `Tháng ${lunarMonthName(lFirst.month, lFirst.leap)}`
      : `Tháng ${lunarMonthName(lFirst.month, lFirst.leap)} – ${lunarMonthName(lLast.month, lLast.leap)}`;
  const doneCount = fastList.filter((f) => state.log[toKey(f.date)]).length;

  root.innerHTML = `
    <section class="card">
      <div class="cal-head">
        <button class="icon-btn" id="prev" aria-label="Tháng trước"><span class="ms">chevron_left</span></button>
        <div class="cal-head__title">
          <span class="h-md">Tháng ${viewM + 1}, ${viewY}</span>
          <span class="small muted">${lunarRange} • ${canChiYear(lLast.year)}</span>
        </div>
        <button class="icon-btn" id="next" aria-label="Tháng sau"><span class="ms">chevron_right</span></button>
      </div>
      <div class="cal-grid" id="grid">
        ${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d, i) => `<div class="cal-dow ${i === 6 ? 'sun' : ''}">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
      <div class="legend">
        <span><i class="mark mark--fast"></i>Ngày chay</span>
        <span><i class="mark mark--event"></i>Ngày Phật pháp</span>
        <span><span class="ms fill" style="font-size:12px;color:var(--gold)">check_circle</span>Đã ăn chay</span>
      </div>
      ${viewY !== today.getFullYear() || viewM !== today.getMonth() ? '<button class="btn btn--glass btn--sm" id="go-today"><span class="ms" style="font-size:16px">today</span>Về tháng hiện tại</button>' : ''}
    </section>

    <section class="card">
      <div class="card__head">
        <div class="card__title"><span class="ms fill">filter_vintage</span><h3>Ngày chay tháng ${viewM + 1}</h3></div>
        <span class="chip chip--primary">${doneCount}/${fastList.length}</span>
      </div>
      <div class="list">
        ${fastList.map((f) => rowHTML(f, today, state)).join('') || '<div class="empty">Không có ngày chay</div>'}
      </div>
    </section>

    ${
      eventList.length
        ? `<section class="card">
      <div class="card__head"><div class="card__title"><span class="ms">celebration</span><h3>Ngày Phật pháp</h3></div></div>
      <div class="list">
        ${eventList
          .map(
            (f) => `<button class="row" data-day="${toKey(f.date)}">
          <div class="row__date"><b>${f.date.getDate()}</b><span>${WEEKDAYS[f.date.getDay()].replace('Thứ ', 'T.')}</span></div>
          <div class="row__body"><b>${f.events.map((e) => esc(e.name)).join(' • ')}</b><span>${esc(lunarText(f.lunar, { numeric: true }))}${f.thapTrai ? ' • trùng ngày chay' : ''}</span></div>
          <span class="ms faint">chevron_right</span>
        </button>`,
          )
          .join('')}
      </div>
    </section>`
        : ''
    }
  `;

  const go = (delta) => {
    viewM += delta;
    if (viewM < 0) {
      viewM = 11;
      viewY--;
    } else if (viewM > 11) {
      viewM = 0;
      viewY++;
    }
    renderCalendar(root);
  };
  root.querySelector('#prev').addEventListener('click', () => go(-1));
  root.querySelector('#next').addEventListener('click', () => go(1));
  root.querySelector('#go-today')?.addEventListener('click', () => {
    viewY = today.getFullYear();
    viewM = today.getMonth();
    renderCalendar(root);
  });
  root.querySelectorAll('[data-day]').forEach((c) =>
    c.addEventListener('click', () => openDay(c.dataset.day, () => renderCalendar(root))),
  );

  // Vuốt trái/phải để đổi tháng
  const grid = root.querySelector('#grid');
  let sx = 0, sy = 0;
  grid.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });
}

function cellHTML(info, inMonth, today, state) {
  const d = info.date;
  const l = info.lunar;
  const k = toKey(d);
  const cls = ['cell'];
  if (!inMonth) cls.push('out');
  if (d.getDay() === 0) cls.push('sun');
  if (info.fasting) cls.push('fast');
  if (daysBetween(today, d) === 0) cls.push('today');
  const lunarLabel = l.day === 1 ? `1/${l.month}${l.leap ? 'N' : ''}` : String(l.day);
  const marks = `${info.fasting ? '<i class="mark mark--fast"></i>' : ''}${info.events.length ? '<i class="mark mark--event"></i>' : ''}`;
  const aria = `${d.getDate()}/${d.getMonth() + 1}, ${lunarText(l, { numeric: true })}${info.fasting ? ', ngày chay' : ''}${info.events.length ? ', ' + info.events.map((e) => e.name).join(', ') : ''}`;
  return `<button class="${cls.join(' ')}" data-day="${k}" aria-label="${esc(aria)}">
    <span class="cell__marks">${marks}</span>
    <span class="cell__solar">${d.getDate()}</span>
    <span class="cell__lunar ${l.day === 1 ? 'first' : ''}">${lunarLabel}</span>
    ${state.log[k] ? '<span class="ms cell__done">check_circle</span>' : ''}
  </button>`;
}

function rowHTML(f, today, state) {
  const k = toKey(f.date);
  const done = !!state.log[k];
  const diff = daysBetween(today, f.date);
  const sub = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : diff > 0 ? `Còn ${diff} ngày` : done ? 'Đã ăn chay' : 'Đã qua';
  return `<button class="row" data-day="${k}">
    <div class="row__date"><b>${f.date.getDate()}</b><span>${WEEKDAYS[f.date.getDay()].replace('Thứ ', 'T.')}</span></div>
    <div class="row__body"><b>${esc(lunarText(f.lunar, { numeric: true }))}</b><span>${sub}${f.events.length ? ' • ' + f.events.map((e) => esc(e.name)).join(', ') : ''}</span></div>
    <span class="ms ${done ? 'fill' : 'faint'}" style="${done ? 'color:var(--gold)' : ''}">${done ? 'check_circle' : 'chevron_right'}</span>
  </button>`;
}

export function openDay(key, onChange) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const state = getState();
  const info = dayInfo(date, state);
  const l = info.lunar;
  const now = new Date();
  const diff = daysBetween(new Date(now.getFullYear(), now.getMonth(), now.getDate()), date);
  const done = !!state.log[key];

  openSheet(
    `
    <div class="sheet__head">
      <div>
        <p class="overline">${WEEKDAYS[date.getDay()]}, ${dmy(date, true)}</p>
        <h2 class="h-display">${esc(lunarText(l, { suffix: false }))}</h2>
      </div>
      <button class="icon-btn" data-close aria-label="Đóng"><span class="ms">close</span></button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${info.fasting ? '<span class="chip chip--gold"><span class="ms fill" style="font-size:14px">local_florist</span>Ngày chay</span>' : '<span class="chip">Ngày thường</span>'}
      <span class="chip">Tháng ${l.monthLength === 30 ? 'đủ (30 ngày)' : 'thiếu (29 ngày)'}</span>
      ${l.leap ? '<span class="chip chip--lotus">Tháng nhuận</span>' : ''}
    </div>
    <dl class="kv">
      <dt>Năm</dt><dd>${canChiYear(l.year)}</dd>
      <dt>Tháng</dt><dd>${canChiMonth(l.month, l.year)}</dd>
      <dt>Ngày</dt><dd>${canChiDay(l.jd)}</dd>
      <dt>Tiết khí</dt><dd>${tietKhi(l.jd)}</dd>
    </dl>
    ${
      info.events.length
        ? info.events.map((e) => `<div class="event-line"><span class="ms fill">local_florist</span><div><b>${esc(e.name)}</b><span class="small muted">${e.repeat === 'yearly' ? 'Hằng năm' : 'Một lần'}${e.fasting ? ' • có ăn chay' : ''}</span></div></div>`).join('')
        : ''
    }
    <div class="sheet__actions">
      ${info.fasting && diff <= 0 ? `<button class="btn ${done ? 'btn--done' : 'btn--primary'}" id="sh-done"><span class="ms">${done ? 'task_alt' : 'check_circle'}</span>${done ? 'Đã ăn chay' : 'Đánh dấu đã ăn chay'}</button>` : ''}
      <button class="btn btn--glass" id="sh-add"><span class="ms">add</span>Thêm sự kiện</button>
    </div>
  `,
    (sheet, close) => {
      sheet.querySelector('#sh-done')?.addEventListener('click', () => {
        update((s) => {
          if (s.log[key]) delete s.log[key];
          else s.log[key] = true;
        });
        toast(done ? 'Đã bỏ đánh dấu' : 'Đã ghi nhận ngày chay 🌿');
        close();
        onChange?.();
      });
      sheet.querySelector('#sh-add').addEventListener('click', () => {
        close();
        openEventForm({ day: l.day, month: l.month, leap: l.leap, year: l.year }, onChange);
      });
    },
  );
}
