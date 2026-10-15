// R7 — Ngày Phật pháp tùy chỉnh
import { getState, update, uid } from '../store.js';
import { lunarMonthName, leapMonthOfYear } from '../lunar.js';
import { addDays, daysBetween, lunarOf } from '../fasting.js';
import { eventsOn } from '../events.js';
import { esc, dmy, WEEKDAYS, openSheet, toast } from '../ui.js';

/** Lần diễn ra kế tiếp của từng sự kiện (trong ~13 tháng tới) */
function nextOccurrences(events) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const found = new Map();
  const pending = events.filter((e) => e.enabled);
  for (let i = 0; i < 400 && found.size < pending.length; i++) {
    const d = addDays(today, i);
    for (const e of eventsOn(lunarOf(d), pending)) if (!found.has(e.id)) found.set(e.id, d);
  }
  return found;
}

function lunarLabel(e) {
  const day = e.day <= 10 ? `Mùng ${e.day}` : e.day === 15 ? 'Rằm' : `${e.day}`;
  const base = `${day} tháng ${lunarMonthName(e.month, e.leap)}`;
  return e.repeat === 'once' ? `${base} năm ${e.year}` : `${base} • hằng năm`;
}

export function renderEvents(root) {
  const state = getState();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const occ = nextOccurrences(state.events);
  const custom = state.events.filter((e) => !e.preset);
  const presets = state.events.filter((e) => e.preset);
  const upcoming = state.events
    .filter((e) => occ.has(e.id))
    .sort((a, b) => occ.get(a.id) - occ.get(b.id))
    .slice(0, 4);

  const occText = (e) => {
    const d = occ.get(e.id);
    if (!d) return e.enabled ? 'Không diễn ra trong năm tới' : 'Đang tắt';
    const n = daysBetween(today, d);
    return `${WEEKDAYS[d.getDay()]}, ${dmy(d, true)} • ${n === 0 ? 'hôm nay' : n === 1 ? 'ngày mai' : `còn ${n} ngày`}`;
  };

  root.innerHTML = `
    <section class="card card--hero">
      <div class="card__orb"></div>
      <div class="card__head"><div class="card__title"><span class="ms fill">event_upcoming</span><h3>Sắp tới</h3></div></div>
      <div class="list">
        ${
          upcoming
            .map((e) => {
              const d = occ.get(e.id);
              return `<div class="row">
            <div class="row__date"><b>${d.getDate()}</b><span>Th ${d.getMonth() + 1}</span></div>
            <div class="row__body"><b>${esc(e.name)}</b><span>${esc(lunarLabel(e))}</span></div>
            <span class="chip ${daysBetween(today, d) <= 3 ? 'chip--gold' : ''}">${daysBetween(today, d) === 0 ? 'Hôm nay' : `${daysBetween(today, d)} ngày`}</span>
          </div>`;
            })
            .join('') || '<div class="empty">Chưa bật ngày nào</div>'
        }
      </div>
    </section>

    <div class="section-label"><span class="overline">Ngày của tôi</span><span class="tiny faint">${custom.length} ngày</span></div>
    <section class="card" style="padding-top:6px;padding-bottom:6px">
      <div class="list">
        ${
          custom
            .map(
              (e) => `<button class="row" data-edit="${e.id}">
          <div class="row__icon ${e.fasting ? 'lotus' : 'gold'}"><span class="ms fill">${e.fasting ? 'local_florist' : 'celebration'}</span></div>
          <div class="row__body"><b>${esc(e.name)}</b><span>${esc(lunarLabel(e))}</span><span class="tiny faint">${esc(occText(e))}${e.remind ? '' : ' • không nhắc'}</span></div>
          <span class="ms faint">edit</span>
        </button>`,
            )
            .join('') || '<div class="empty">Chưa có ngày nào. Bấm “Thêm ngày” để tạo.</div>'
        }
      </div>
    </section>

    <div class="section-label"><span class="overline">Gợi ý sẵn</span><span class="tiny faint">Bật/tắt từng ngày</span></div>
    <section class="card" style="padding-top:6px;padding-bottom:6px">
      <div class="list">
        ${presets
          .map(
            (e) => `<div class="row">
          <div class="row__icon"><span class="ms">temple_buddhist</span></div>
          <button class="row__body" style="text-align:left" data-edit="${e.id}"><b>${esc(e.name)}</b><span>${esc(lunarLabel(e))}</span>${e.enabled ? `<span class="tiny faint">${esc(occText(e))}</span>` : ''}</button>
          <label class="switch"><input type="checkbox" data-toggle="${e.id}" ${e.enabled ? 'checked' : ''} aria-label="Bật ${esc(e.name)}" /><span></span></label>
        </div>`,
          )
          .join('')}
      </div>
    </section>
    <div style="height:56px"></div>
    <button class="fab" id="fab-add"><span class="ms">add</span>Thêm ngày</button>
  `;

  const rerender = () => renderEvents(root);
  root.querySelector('#fab-add').addEventListener('click', () => openEventForm(null, rerender));
  root.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openEventForm(getState().events.find((e) => e.id === b.dataset.edit), rerender)),
  );
  root.querySelectorAll('[data-toggle]').forEach((t) =>
    t.addEventListener('change', () => {
      update((s) => {
        const e = s.events.find((x) => x.id === t.dataset.toggle);
        if (e) e.enabled = t.checked;
      });
      rerender();
    }),
  );
}

/**
 * Form thêm/sửa sự kiện. `ev` là sự kiện có sẵn (sửa) hoặc gợi ý {day, month, leap, year} (thêm mới).
 */
export function openEventForm(ev, onSaved) {
  const editing = !!(ev && ev.id);
  const cur = lunarOf(new Date());
  const v = {
    name: '',
    day: cur.day,
    month: cur.month,
    leap: false,
    repeat: 'yearly',
    year: cur.year,
    remind: true,
    fasting: false,
    remindInLeap: false,
    ...(ev || {}),
  };
  if (!v.year) v.year = cur.year;

  const dayOpts = Array.from({ length: 30 }, (_, i) => i + 1)
    .map((d) => `<option value="${d}" ${d === v.day ? 'selected' : ''}>${d <= 10 ? 'Mùng ' + d : d === 15 ? '15 (Rằm)' : d}</option>`)
    .join('');
  const monthOpts = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((m) => `<option value="${m}" ${m === v.month ? 'selected' : ''}>Tháng ${m} (${lunarMonthName(m)})</option>`)
    .join('');

  openSheet(
    `
    <div class="sheet__head">
      <h2 class="h-md">${editing ? 'Sửa ngày Phật pháp' : 'Thêm ngày Phật pháp'}</h2>
      <button class="icon-btn" data-close aria-label="Đóng"><span class="ms">close</span></button>
    </div>
    <form id="ev-form" style="display:flex;flex-direction:column;gap:12px" autocomplete="off">
      <div class="field">
        <label for="f-name">Tên ngày</label>
        <input class="input" id="f-name" required maxlength="80" placeholder="VD: Vía Quan Âm, giỗ ông bà…" value="${esc(v.name)}" ${v.preset ? 'readonly' : ''} />
      </div>
      <div class="form-row">
        <div class="field"><label for="f-day">Ngày âm</label><select class="select" id="f-day">${dayOpts}</select></div>
        <div class="field"><label for="f-month">Tháng âm</label><select class="select" id="f-month">${monthOpts}</select></div>
      </div>
      <div class="field">
        <label>Lặp lại</label>
        <div class="seg" id="f-repeat">
          <button type="button" data-v="yearly" class="${v.repeat === 'yearly' ? 'on' : ''}">Hằng năm</button>
          <button type="button" data-v="once" class="${v.repeat === 'once' ? 'on' : ''}">Một lần</button>
        </div>
      </div>
      <div class="form-row" id="once-fields" ${v.repeat === 'once' ? '' : 'hidden'}>
        <div class="field"><label for="f-year">Năm âm lịch</label><input class="input" id="f-year" type="number" min="2025" max="2035" value="${v.year}" /></div>
        <div class="field"><label for="f-leap">Tháng nhuận?</label><select class="select" id="f-leap"><option value="0">Không</option><option value="1" ${v.leap ? 'selected' : ''}>Có (tháng nhuận)</option></select></div>
      </div>
      <p class="tiny faint" id="leap-hint"></p>
      <div class="check-row"><span>Nhắc nhở<small>Theo các mốc giờ trong Cài đặt</small></span><label class="switch"><input type="checkbox" id="f-remind" ${v.remind ? 'checked' : ''} /><span></span></label></div>
      <div class="check-row"><span>Có ăn chay ngày này<small>Tính như một ngày chay</small></span><label class="switch"><input type="checkbox" id="f-fasting" ${v.fasting ? 'checked' : ''} /><span></span></label></div>
      <div class="check-row" id="leap-row" ${v.repeat === 'yearly' ? '' : 'hidden'}><span>Nhắc cả trong tháng nhuận<small>Mặc định chỉ nhắc tháng thường</small></span><label class="switch"><input type="checkbox" id="f-inleap" ${v.remindInLeap ? 'checked' : ''} /><span></span></label></div>
      <div class="sheet__actions">
        ${editing && !v.preset ? '<button type="button" class="btn btn--danger" id="f-del"><span class="ms">delete</span>Xóa</button>' : ''}
        <button type="submit" class="btn btn--primary"><span class="ms">check</span>${editing ? 'Lưu' : 'Thêm ngày'}</button>
      </div>
    </form>
  `,
    (sheet, close) => {
      const form = sheet.querySelector('#ev-form');
      let repeat = v.repeat;
      const hint = sheet.querySelector('#leap-hint');
      const refreshHint = () => {
        const day = +sheet.querySelector('#f-day').value;
        const parts = [];
        if (day === 30) parts.push('Nếu tháng thiếu (29 ngày), sự kiện sẽ dời về ngày 29.');
        if (repeat === 'once') {
          const lm = leapMonthOfYear(+sheet.querySelector('#f-year').value);
          parts.push(lm ? `Năm này có tháng ${lm} nhuận.` : 'Năm này không có tháng nhuận.');
        }
        hint.textContent = parts.join(' ');
      };
      sheet.querySelectorAll('#f-repeat button').forEach((b) =>
        b.addEventListener('click', () => {
          repeat = b.dataset.v;
          sheet.querySelectorAll('#f-repeat button').forEach((x) => x.classList.toggle('on', x === b));
          sheet.querySelector('#once-fields').hidden = repeat !== 'once';
          sheet.querySelector('#leap-row').hidden = repeat !== 'yearly';
          refreshHint();
        }),
      );
      ['#f-day', '#f-year'].forEach((s) => sheet.querySelector(s).addEventListener('input', refreshHint));
      refreshHint();

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = sheet.querySelector('#f-name').value.trim();
        if (!name) return sheet.querySelector('#f-name').focus();
        const data = {
          name,
          day: +sheet.querySelector('#f-day').value,
          month: +sheet.querySelector('#f-month').value,
          repeat,
          year: repeat === 'once' ? +sheet.querySelector('#f-year').value : null,
          leap: repeat === 'once' && sheet.querySelector('#f-leap').value === '1',
          remind: sheet.querySelector('#f-remind').checked,
          fasting: sheet.querySelector('#f-fasting').checked,
          remindInLeap: repeat === 'yearly' && sheet.querySelector('#f-inleap').checked,
        };
        if (data.leap && leapMonthOfYear(data.year) !== data.month) {
          toast(`Năm ${data.year} không có tháng ${data.month} nhuận`);
          return;
        }
        update((s) => {
          if (editing) {
            const target = s.events.find((x) => x.id === ev.id);
            Object.assign(target, data, { enabled: true });
          } else {
            s.events.push({ id: uid(), preset: false, enabled: true, ...data });
          }
        });
        toast(editing ? 'Đã lưu' : 'Đã thêm ngày 🌸');
        close();
        onSaved?.();
      });
      sheet.querySelector('#f-del')?.addEventListener('click', () => {
        if (!confirm(`Xóa “${v.name}”?`)) return;
        update((s) => (s.events = s.events.filter((x) => x.id !== ev.id)));
        toast('Đã xóa');
        close();
        onSaved?.();
      });
    },
  );
  if (!editing) setTimeout(() => document.querySelector('#f-name')?.focus(), 50);
}
