// R3 — Màn hình Hôm nay
import { getState, update } from '../store.js';
import { canChiDay, canChiMonth, canChiYear, tietKhi, gioHoangDao, lunarMonthName, lunarDayLabel } from '../lunar.js';
import { fastingDatesOfLunarMonth, toKey, daysBetween, FASTING_MODES } from '../fasting.js';
import { dayInfo, nextFastingDay, permissionState, requestPermission, isStandalone, isIOS } from '../notify.js';
import { esc, dmy, WEEKDAYS, lunarText, toast, ringBell, openSheet } from '../ui.js';

const VERSES = [
  ['Nam Mô Dược Sư Lưu Ly Quang Vương Phật', 'Nguyện cho thân thể an khang, tật bệnh tiêu trừ, tâm trí sáng suốt như ngọc lưu ly, gieo mầm từ bi đến muôn loài trong từng bữa ăn thanh tịnh.'],
  ['Nam Mô A Di Đà Phật', 'Một bữa ăn chay là một lần nuôi dưỡng lòng từ, cho mình và cho muôn loài.'],
  ['Nam Mô Đại Bi Quán Thế Âm Bồ Tát', 'Ăn trong chánh niệm, biết ơn những bàn tay đã làm nên bữa cơm hôm nay.'],
  ['Nam Mô Bổn Sư Thích Ca Mâu Ni Phật', 'Giữ giới như giữ ngọc sáng; tâm thanh tịnh thì thân an lạc.'],
];

export function renderToday(root) {
  const state = getState();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const info = dayInfo(today, state);
  const l = info.lunar;
  const todayKey = toKey(today);
  const done = !!state.log[todayKey];
  const next = info.fasting ? nextFastingDay(today, false) : nextFastingDay(today, true);
  const daysToNext = next ? daysBetween(today, next.date) : null;
  const monthDays = fastingDatesOfLunarMonth(today, state.settings.mode);
  const doneCount = monthDays.filter((d) => state.log[toKey(d.date)]).length;
  const hd = gioHoangDao(l.jd);
  const verse = VERSES[l.jd % VERSES.length];
  const modeName = FASTING_MODES[state.settings.mode]?.name || 'Thập Trai';

  root.innerHTML = `
    ${bannerHTML()}

    <section class="date-head">
      <div class="date-head__row">
        <span class="overline">${WEEKDAYS[today.getDay()]}, ${dmy(today, true)}</span>
        <button class="chip" id="btn-hd"><span class="ms" style="font-size:14px">schedule</span>Giờ Hoàng Đạo</button>
      </div>
      <div class="date-head__lunar">
        <h1 class="h-display">${lunarDayLabel(l.day) === 'Rằm' ? 'Rằm' : l.day <= 10 ? `Mùng ${String(l.day).padStart(2, '0')}` : `Ngày ${l.day}`}</h1>
        <span class="h-sm">tháng ${lunarMonthName(l.month, l.leap)}, Năm ${canChiYear(l.year)}</span>
      </div>
      <p class="small faint">Ngày ${canChiDay(l.jd)} • Tháng ${canChiMonth(l.month, l.year)} • Tiết ${tietKhi(l.jd)} • Tháng ${l.monthLength === 30 ? 'đủ' : 'thiếu'}</p>
      <div class="hoang-dao" id="hd-list" hidden>
        ${hd.map((h) => `<span class="chip chip--primary">${h.chi} ${h.from}h–${h.to}h</span>`).join('')}
      </div>
    </section>

    <section class="card card--hero ${info.fasting ? 'card--glow' : ''}">
      <div class="card__orb"></div>
      <div class="card__head">
        <div class="card__title"><span class="ms fill">filter_vintage</span><span class="label-title">Lịch ${esc(modeName)}</span></div>
        ${info.fasting ? '<span class="chip chip--gold">Ngày Trai</span>' : '<span class="chip">Ngày Bình Thường</span>'}
      </div>

      <div class="status ${info.fasting ? 'status--fast' : ''}">
        <div class="status__icon"><span class="ms ${info.fasting ? 'fill' : ''}">${info.fasting ? 'local_florist' : 'eco'}</span></div>
        <h2 class="h-md">${info.fasting ? 'Hôm nay ăn chay' : 'Hôm nay không phải ngày trai'}</h2>
        <p class="small muted">${
          info.fasting
            ? `${esc(lunarText(l))} — ngày thứ ${monthDays.findIndex((d) => d.lunarDay === l.day) + 1 || '•'} trong ${monthDays.length} ngày chay của tháng. Nguyện một ngày thanh tịnh, thân tâm an lạc.`
            : 'Tâm luôn giữ giới, lòng nhẹ như mây. Giữ tâm niệm thiện lành trong từng hành động.'
        }</p>
      </div>

      ${
        next
          ? `<div class="countdown">
        <div class="countdown__icon"><span class="ms">hourglass_top</span></div>
        <div style="min-width:0">
          <div class="countdown__top"><span class="tiny">Ngày chay kế tiếp</span><span class="chip chip--gold" style="padding:0 6px">${daysToNext === 1 ? 'Ngày mai' : `Còn ${daysToNext} ngày`}</span></div>
          <div class="countdown__main">${esc(lunarText(next.lunar, { numeric: true }))} • ${WEEKDAYS[next.date.getDay()]}, ${dmy(next.date)}</div>
        </div>
      </div>`
          : ''
      }

      <div style="display:flex;flex-direction:column;gap:4px;padding-top:4px">
        ${
          info.fasting
            ? `<button class="btn btn--block ${done ? 'btn--done' : 'btn--primary'}" id="btn-done">
                <span class="ms">${done ? 'task_alt' : 'check_circle'}</span>
                <span>${done ? 'Đã ghi nhận công đức ăn chay hôm nay' : 'Tôi đã ăn chay hôm nay'}</span>
              </button>`
            : `<a class="btn btn--block btn--glass" href="#/lich"><span class="ms">calendar_month</span><span>Xem lịch tháng</span></a>`
        }
        <div class="progress-row">
          <span class="small muted">Tiến độ tháng ${lunarMonthName(l.month, l.leap)}</span>
          <b>Đã giữ ${doneCount} / ${monthDays.length} ngày</b>
        </div>
      </div>
    </section>

    ${
      info.events.length
        ? `<section class="card">
      <div class="card__head"><div class="card__title"><span class="ms">celebration</span><h3>Ngày Phật pháp hôm nay</h3></div></div>
      ${info.events.map((e) => `<div class="event-line"><span class="ms fill">local_florist</span><div><b>${esc(e.name)}</b><span class="small muted">${e.fasting ? 'Có ăn chay' : 'Ngày lễ'}</span></div></div>`).join('')}
    </section>`
        : ''
    }

    <section class="card">
      <div class="card__head">
        <div class="card__title"><span class="ms">psychology_alt</span><h3>${monthDays.length} Ngày ${esc(modeName)}</h3></div>
        <span class="tiny muted">Tháng ${lunarMonthName(l.month, l.leap)} ${canChiYear(l.year)}</span>
      </div>
      <p class="small muted">${
        l.monthLength === 29 && state.settings.mode === 'thapTrai'
          ? 'Tháng thiếu (29 ngày): ngày chay cuối tháng là 27, 28, 29.'
          : 'Mười ngày trì trai diệt trừ phiền não, tiêu tai tăng phước theo kinh Dược Sư &amp; Địa Tạng.'
      }</p>
      <div class="gems">${monthDays.map((d) => gemHTML(d, today, state, next)).join('')}</div>
      <p class="tiny faint" style="text-align:center">Chạm vào ngày đã qua để đánh dấu đã ăn chay</p>
    </section>

    <section class="card verse">
      <div class="card__title" style="color:var(--primary)"><span class="ms">self_improvement</span><span class="overline">Tịnh Khẩu • Quán Chiếu</span></div>
      <p class="verse__quote">“${verse[0]}”</p>
      <p class="muted" style="line-height:1.7">${verse[1]}</p>
      <div class="verse__foot">
        <button class="pill-btn" id="btn-bell"><span class="ms">campaign</span><span>Thỉnh 1 tiếng chuông</span></button>
        <span class="bell-fb" id="bell-fb">Boong... Tâm an định</span>
      </div>
    </section>
  `;

  bindBanner(root);
  root.querySelector('#btn-hd').addEventListener('click', () => {
    const el = root.querySelector('#hd-list');
    el.hidden = !el.hidden;
  });
  root.querySelector('#btn-done')?.addEventListener('click', () => {
    update((s) => {
      if (s.log[todayKey]) delete s.log[todayKey];
      else s.log[todayKey] = true;
    });
    if (!done) toast('Công đức viên mãn 🌸');
    renderToday(root);
  });
  root.querySelectorAll('[data-gem]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.gem;
      update((s) => {
        if (s.log[k]) delete s.log[k];
        else s.log[k] = true;
      });
      renderToday(root);
    }),
  );
  root.querySelector('#btn-bell').addEventListener('click', () => {
    ringBell();
    const fb = root.querySelector('#bell-fb');
    fb.classList.add('show');
    setTimeout(() => fb.classList.remove('show'), 2200);
  });
}

function gemHTML(d, today, state, next) {
  const k = toKey(d.date);
  const diff = daysBetween(today, d.date);
  const isDone = !!state.log[k];
  const isToday = diff === 0;
  const isNext = !isToday && next && toKey(next.date) === k;
  const isPast = diff < 0;
  const ram = d.lunarDay === 15;
  const cls = ['gem'];
  let icon = 'spa';
  if (isDone) {
    cls.push('gem--done');
    icon = 'check';
    if (isToday) cls.push('gem--gold');
  } else if (isToday) {
    cls.push('gem--today');
    icon = 'local_florist';
  } else if (isNext) {
    cls.push('gem--next');
    icon = 'notifications';
  } else if (ram) {
    cls.push('gem--ram');
    icon = 'brightness_7';
  } else if (isPast) {
    cls.push('gem--missed');
    icon = 'radio_button_unchecked';
  }
  if (ram && !cls.includes('gem--ram') && !isDone) cls.push('gem--ram');
  const label = d.lunarDay === 1 ? 'Mùng 1' : d.lunarDay === 8 ? 'Mùng 8' : ram ? '15 (Rằm)' : String(d.lunarDay);
  const tag = isPast || isToday ? 'button' : 'div';
  const attrs = tag === 'button' ? `data-gem="${k}" aria-label="${label}: ${isDone ? 'đã ăn chay' : 'chưa đánh dấu'}"` : '';
  return `<${tag} class="${cls.join(' ')}" ${attrs}>
    <span class="gem__label">${label}</span>
    <span class="gem__dot"><span class="ms ${isDone ? 'fill' : ''}">${icon}</span></span>
    <span class="gem__date">${dmy(d.date)}</span>
  </${tag}>`;
}

// ---------- R6: banner quyền thông báo / cài PWA ----------
function bannerHTML() {
  const perm = permissionState();
  const s = getState().settings;
  if (perm === 'denied') {
    return `<div class="banner banner--warn">
      <div class="banner__icon"><span class="ms">notifications_off</span></div>
      <div class="banner__text"><b>Thông báo đang bị chặn</b><span>Bạn sẽ không được nhắc ngày chay</span></div>
      <div class="banner__actions"><button class="mini" data-banner="howto">Cách bật</button></div>
    </div>`;
  }
  if (isIOS() && !isStandalone()) {
    return `<div class="banner banner--warn">
      <div class="banner__icon"><span class="ms">add_to_home_screen</span></div>
      <div class="banner__text"><b>Cài app vào Màn hình chính</b><span>iPhone chỉ nhận nhắc khi đã cài app</span></div>
      <div class="banner__actions"><button class="mini" data-banner="install">Hướng dẫn</button></div>
    </div>`;
  }
  if (perm === 'default' && Date.now() - (s.bannerDismissedAt || 0) > 3 * 24 * 3600 * 1000) {
    return `<div class="banner" id="noti-banner">
      <div class="banner__icon"><span class="ms">notifications_active</span></div>
      <div class="banner__text"><b>Nhắc nhở ngày trai giới</b><span>Bật thông báo để không lỡ ngày chay</span></div>
      <div class="banner__actions">
        <button class="mini" data-banner="allow">Bật ngay</button>
        <button class="icon-btn" style="width:28px;height:28px" data-banner="dismiss" aria-label="Ẩn"><span class="ms" style="font-size:18px">close</span></button>
      </div>
    </div>`;
  }
  if (perm === 'unsupported') {
    return `<div class="banner banner--warn">
      <div class="banner__icon"><span class="ms">notifications_off</span></div>
      <div class="banner__text"><b>Trình duyệt không hỗ trợ thông báo</b><span>Hãy xuất lịch nhắc (.ics) trong Cài đặt</span></div>
      <div class="banner__actions"><a class="mini" href="#/cai-dat">Mở</a></div>
    </div>`;
  }
  return '';
}

function bindBanner(root) {
  root.querySelectorAll('[data-banner]').forEach((b) =>
    b.addEventListener('click', async () => {
      const act = b.dataset.banner;
      if (act === 'allow') {
        const r = await requestPermission();
        toast(r === 'granted' ? 'Đã bật thông báo ✓' : 'Chưa được cấp quyền thông báo');
        renderToday(root);
      } else if (act === 'dismiss') {
        update((s) => (s.settings.bannerDismissedAt = Date.now()));
        renderToday(root);
      } else if (act === 'howto') {
        showPermissionHelp();
      } else if (act === 'install') {
        showInstallHelp();
      }
    }),
  );
}

export function showPermissionHelp() {
  openSheet(`
    <div class="sheet__head"><h2 class="h-md">Bật lại thông báo</h2><button class="icon-btn" data-close aria-label="Đóng"><span class="ms">close</span></button></div>
    <p class="small muted">Thông báo đã bị chặn nên app không thể nhắc bạn. Cách bật lại:</p>
    <div><b class="small">Android (Chrome)</b>
    <ol class="steps"><li>Nhấn giữ biểu tượng app Thập Trai → <b>Thông tin ứng dụng</b></li><li>Chọn <b>Thông báo</b> → bật <b>Cho phép</b></li><li>Hoặc trong Chrome: ⋮ → Cài đặt → Cài đặt trang web → Thông báo</li></ol></div>
    <div><b class="small">iPhone (iOS 16.4+)</b>
    <ol class="steps"><li>Mở <b>Cài đặt</b> → <b>Thông báo</b></li><li>Chọn <b>Thập Trai</b> → bật <b>Cho phép thông báo</b></li></ol></div>
    <p class="small muted">Phương án dự phòng: vào <b>Cài đặt → Xuất lịch nhắc (.ics)</b> để thêm ngày chay vào ứng dụng Lịch của điện thoại.</p>
    <button class="btn btn--primary btn--block" data-close>Đã hiểu</button>
  `);
}

export function showInstallHelp() {
  openSheet(`
    <div class="sheet__head"><h2 class="h-md">Cài app vào Màn hình chính</h2><button class="icon-btn" data-close aria-label="Đóng"><span class="ms">close</span></button></div>
    <div><b class="small">iPhone (Safari)</b>
    <ol class="steps"><li>Bấm nút <b>Chia sẻ</b> <span class="ms" style="font-size:16px;vertical-align:-3px">ios_share</span> ở thanh dưới</li><li>Chọn <b>Thêm vào MH chính</b></li><li>Mở app từ biểu tượng mới, rồi bấm <b>Bật ngay</b> để cho phép thông báo</li></ol></div>
    <div><b class="small">Android (Chrome)</b>
    <ol class="steps"><li>Bấm ⋮ ở góc trên → <b>Cài đặt ứng dụng</b> / <b>Thêm vào màn hình chính</b></li><li>Mở app từ biểu tượng và cho phép thông báo</li></ol></div>
    <button class="btn btn--primary btn--block" data-close>Đã hiểu</button>
  `);
}

