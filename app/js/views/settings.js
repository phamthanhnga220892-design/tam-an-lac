// R5, R6, R9, R10 — Cài đặt nhắc, quyền thông báo, thống kê, dữ liệu
import { getState, update, uid, exportJSON, importJSON } from '../store.js';
import { jdToDate, lunarMonthName, canChiYear } from '../lunar.js';
import { FASTING_MODES, fastingDatesOfLunarMonth, toKey, lunarOf } from '../fasting.js';
import { permissionState, requestPermission, testNotification, upcomingNotifications, buildICS, isStandalone, isIOS } from '../notify.js';
import { esc, toast, download, WEEKDAYS, dmy } from '../ui.js';
import { showPermissionHelp, showInstallHelp } from './today.js';

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});

const BEFORE_OPTS = [
  [0, 'Đúng ngày'],
  [1, 'Trước 1 ngày'],
  [2, 'Trước 2 ngày'],
  [3, 'Trước 3 ngày'],
];

function monthStats(n = 6) {
  const state = getState();
  const out = [];
  let ref = new Date();
  for (let i = 0; i < n; i++) {
    const l = lunarOf(ref);
    const days = fastingDatesOfLunarMonth(ref, state.settings.mode);
    const done = days.filter((d) => state.log[toKey(d.date)]).length;
    out.push({ label: `Tháng ${lunarMonthName(l.month, l.leap)} ${canChiYear(l.year)}`, done, total: days.length });
    const prev = jdToDate(l.monthStartJd - 1);
    ref = new Date(prev.year, prev.month - 1, prev.day);
  }
  return out;
}

export function renderSettings(root) {
  const state = getState();
  const s = state.settings;
  const perm = permissionState();
  const permText = {
    granted: ['Đã bật', 'chip--primary', 'notifications_active'],
    denied: ['Bị chặn', 'chip--lotus', 'notifications_off'],
    default: ['Chưa bật', 'chip--gold', 'notifications'],
    unsupported: ['Không hỗ trợ', 'chip--lotus', 'notifications_off'],
  }[perm];
  const upcoming = upcomingNotifications(new Date(), 30).filter((n) => n.fireAt > Date.now()).slice(0, 3);
  const stats = monthStats();

  root.innerHTML = `
    <section class="card">
      <div class="card__head"><div class="card__title"><span class="ms fill">filter_vintage</span><h3>Chế độ ăn chay</h3></div></div>
      <div class="seg" id="mode">
        ${Object.entries(FASTING_MODES)
          .map(([k, m]) => `<button data-mode="${k}" class="${s.mode === k ? 'on' : ''}">${m.name} (${m.full.length})</button>`)
          .join('')}
      </div>
      <p class="small muted">Tháng đủ: ${FASTING_MODES[s.mode].full.join(', ')}<br/>Tháng thiếu: ${FASTING_MODES[s.mode].short.join(', ')}</p>
    </section>

    <section class="card">
      <div class="card__head">
        <div class="card__title"><span class="ms">${permText[2]}</span><h3>Thông báo</h3></div>
        <span class="chip ${permText[1]}">${permText[0]}</span>
      </div>
      ${
        perm === 'default'
          ? '<button class="btn btn--primary btn--block" id="perm"><span class="ms">notifications_active</span>Cho phép thông báo</button>'
          : perm === 'denied'
            ? '<button class="btn btn--glass btn--block" id="perm-help"><span class="ms">help</span>Hướng dẫn bật lại thông báo</button>'
            : perm === 'granted'
              ? '<button class="btn btn--glass btn--block" id="test"><span class="ms">notifications</span>Gửi thử một thông báo</button>'
              : ''
      }
      ${
        !isStandalone()
          ? `<div class="banner banner--warn"><div class="banner__icon"><span class="ms">add_to_home_screen</span></div>
            <div class="banner__text"><b>Chưa cài app</b><span>${isIOS() ? 'iPhone chỉ nhận nhắc khi đã thêm vào MH chính' : 'Cài app để nhắc ổn định hơn'}</span></div>
            <div class="banner__actions"><button class="mini" id="install">${installPrompt ? 'Cài đặt' : 'Hướng dẫn'}</button></div></div>`
          : ''
      }
    </section>

    <section class="card">
      <div class="card__head"><div class="card__title"><span class="ms">alarm</span><h3>Mốc giờ nhắc</h3></div></div>
      <div class="list" id="reminders">
        ${s.reminders
          .map(
            (r) => `<div class="row reminder-row" data-r="${r.id}">
          <input class="input" type="time" value="${r.time}" data-f="time" aria-label="Giờ nhắc" />
          <select class="select" data-f="daysBefore" aria-label="Nhắc trước">
            ${BEFORE_OPTS.map(([v, t]) => `<option value="${v}" ${r.daysBefore === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <label class="switch"><input type="checkbox" data-f="enabled" ${r.enabled ? 'checked' : ''} aria-label="Bật mốc nhắc" /><span></span></label>
          <button class="icon-btn" data-del aria-label="Xóa mốc"><span class="ms">delete</span></button>
        </div>`,
          )
          .join('')}
      </div>
      <button class="btn btn--glass btn--sm" id="add-r"><span class="ms" style="font-size:16px">add</span>Thêm mốc nhắc</button>
      ${
        upcoming.length
          ? `<div><p class="tiny faint" style="margin-bottom:4px">LỜI NHẮC SẮP TỚI</p>
        ${upcoming
          .map((n) => {
            const d = new Date(n.fireAt);
            return `<div class="small" style="display:flex;gap:8px;padding:3px 0"><b style="color:var(--primary);white-space:nowrap">${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${WEEKDAYS[d.getDay()].replace('Thứ ', 'T.')} ${dmy(d)}</b><span class="muted">${esc(n.title)}</span></div>`;
          })
          .join('')}</div>`
          : ''
      }
    </section>

    <section class="card">
      <div class="card__head"><div class="card__title"><span class="ms">event</span><h3>Nhắc qua Lịch điện thoại</h3></div></div>
      <p class="small muted">Phương án chắc chắn nhất khi app đóng: tải file lịch (.ics) gồm ngày chay và ngày Phật pháp 12 tháng tới, kèm chuông báo theo các mốc giờ ở trên, rồi mở để thêm vào ứng dụng Lịch (Google Calendar, Lịch iPhone).</p>
      <button class="btn btn--primary btn--block" id="ics"><span class="ms">download</span>Xuất lịch nhắc (.ics)</button>
    </section>

    <section class="card">
      <div class="card__head"><div class="card__title"><span class="ms">insights</span><h3>Thống kê giữ trai</h3></div></div>
      ${stats
        .map(
          (m) => `<div style="display:flex;flex-direction:column;gap:4px">
        <div class="month-summary__row"><span>${m.label}</span><b style="color:var(--primary)">${m.done}/${m.total}</b></div>
        <div class="stat-bar"><i style="width:${m.total ? (m.done / m.total) * 100 : 0}%"></i></div>
      </div>`,
        )
        .join('')}
    </section>

    <section class="card">
      <div class="card__head"><div class="card__title"><span class="ms">database</span><h3>Dữ liệu</h3></div></div>
      <p class="small muted">Dữ liệu chỉ lưu trên máy này. Xuất file sao lưu để không mất khi đổi máy.</p>
      <div class="sheet__actions">
        <button class="btn btn--glass btn--sm" id="export"><span class="ms" style="font-size:16px">upload_file</span>Xuất JSON</button>
        <button class="btn btn--glass btn--sm" id="import"><span class="ms" style="font-size:16px">download</span>Nhập JSON</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden />
    </section>

    <p class="tiny faint" style="text-align:center">Thập Trai Thanh Tịnh v1.0 • Âm lịch theo thuật toán Hồ Ngọc Đức, múi giờ UTC+7 • Tính offline</p>
  `;

  const rerender = () => renderSettings(root);

  root.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      update((st) => (st.settings.mode = b.dataset.mode));
      rerender();
    }),
  );
  root.querySelector('#perm')?.addEventListener('click', async () => {
    const r = await requestPermission();
    toast(r === 'granted' ? 'Đã bật thông báo ✓' : 'Chưa được cấp quyền');
    rerender();
  });
  root.querySelector('#perm-help')?.addEventListener('click', showPermissionHelp);
  root.querySelector('#test')?.addEventListener('click', async () => {
    await testNotification();
    toast('Đã gửi thông báo thử');
  });
  root.querySelector('#install')?.addEventListener('click', async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      rerender();
    } else showInstallHelp();
  });

  root.querySelectorAll('[data-r]').forEach((row) => {
    const id = row.dataset.r;
    row.querySelectorAll('[data-f]').forEach((inp) =>
      inp.addEventListener('change', () => {
        update((st) => {
          const r = st.settings.reminders.find((x) => x.id === id);
          const f = inp.dataset.f;
          r[f] = f === 'enabled' ? inp.checked : f === 'daysBefore' ? +inp.value : inp.value || r.time;
        });
        rerender();
      }),
    );
    row.querySelector('[data-del]').addEventListener('click', () => {
      update((st) => (st.settings.reminders = st.settings.reminders.filter((x) => x.id !== id)));
      rerender();
    });
  });
  root.querySelector('#add-r').addEventListener('click', () => {
    update((st) => st.settings.reminders.push({ id: uid(), daysBefore: 1, time: '20:00', enabled: true }));
    rerender();
  });

  root.querySelector('#ics').addEventListener('click', () => {
    download('thap-trai.ics', buildICS(12), 'text/calendar;charset=utf-8');
    toast('Đã tạo file lịch — mở file để thêm vào Lịch');
  });
  root.querySelector('#export').addEventListener('click', () => {
    download(`thap-trai-sao-luu-${toKey(new Date())}.json`, exportJSON(), 'application/json');
  });
  const fileInput = root.querySelector('#import-file');
  root.querySelector('#import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      importJSON(await f.text());
      toast('Đã nhập dữ liệu ✓');
      rerender();
    } catch (err) {
      toast(`Không nhập được: ${err.message}`);
    }
  });
}
