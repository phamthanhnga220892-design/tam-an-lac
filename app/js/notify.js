// Nhắc nhở (R5, R6, BR7) và xuất lịch .ics làm phương án nhắc khi app đóng.
import { getState, update } from './store.js';
import { isFastingDay, addDays, toKey, lunarOf, daysBetween } from './fasting.js';
import { eventsOn } from './events.js';
import { lunarDayLabel, lunarMonthName } from './lunar.js';

/** Thông tin một ngày: ăn chay? sự kiện nào? */
export function dayInfo(date, state = getState()) {
  const lunar = lunarOf(date);
  const fasting = isFastingDay(lunar, state.settings.mode);
  const events = eventsOn(lunar, state.events);
  const eventFasting = events.some((e) => e.fasting);
  return { date, lunar, fasting: fasting || eventFasting, thapTrai: fasting, events };
}

/** Ngày chay kế tiếp tính từ `from` (không gồm `from` nếu includeFrom=false) */
export function nextFastingDay(from, includeFrom = false) {
  for (let i = includeFrom ? 0 : 1; i < 400; i++) {
    const d = addDays(from, i);
    const info = dayInfo(d);
    if (info.fasting) return info;
  }
  return null;
}

function lunarShort(l) {
  return `${lunarDayLabel(l.day).toLowerCase()} tháng ${lunarMonthName(l.month, l.leap)}`;
}

function relWord(n) {
  if (n === 0) return 'Hôm nay';
  if (n === 1) return 'Mai';
  if (n === 2) return 'Ngày kia';
  return `Còn ${n} ngày nữa`;
}

/** BR7: gộp chay + nhiều sự kiện cùng ngày thành một thông báo */
export function buildMessage(info, daysBefore) {
  const rel = relWord(daysBefore);
  const l = info.lunar;
  const dayLabel = l.day <= 10 ? `mùng ${l.day}` : l.day === 15 ? 'rằm' : `ngày ${l.day}`;
  const parts = [];
  if (info.fasting) parts.push('ngày chay');
  const evNames = info.events.filter((e) => e.remind).map((e) => e.name);
  let title;
  if (daysBefore <= 2) title = `${rel} (${dayLabel}) là ${parts.length ? parts.join('') : evNames[0] || 'ngày lễ'}`;
  else title = `${rel} đến ${parts.length ? 'ngày chay' : evNames[0]} (${dayLabel})`;
  const lines = [];
  if (evNames.length) lines.push(evNames.join(' • '));
  lines.push(`${lunarShort(l)} ÂL • ${info.date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}`);
  if (info.fasting && daysBefore >= 1) lines.push('Nhớ chuẩn bị đồ chay nhé 🌿');
  return { title, body: lines.join('\n') };
}

/** Danh sách lời nhắc trong khoảng [from, from+days) */
export function upcomingNotifications(from = new Date(), days = 30) {
  const state = getState();
  const out = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (const r of state.settings.reminders) {
    if (!r.enabled) continue;
    const [hh, mm] = r.time.split(':').map(Number);
    for (let i = -1; i <= days; i++) {
      const target = addDays(start, i + r.daysBefore);
      const info = dayInfo(target, state);
      const hasEvent = info.events.some((e) => e.remind);
      if (!info.fasting && !hasEvent) continue;
      const fireDay = addDays(target, -r.daysBefore);
      const fireAt = new Date(fireDay.getFullYear(), fireDay.getMonth(), fireDay.getDate(), hh, mm);
      const msg = buildMessage(info, r.daysBefore);
      out.push({ id: `${r.id}|${toKey(target)}`, fireAt: fireAt.getTime(), target: toKey(target), fasting: info.fasting, ...msg });
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt);
}

// ---------- Quyền & trạng thái (R6) ----------
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
export function permissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // granted | denied | default
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  const res = await Notification.requestPermission();
  if (res === 'granted') await syncSchedule();
  return res;
}

async function showNotification(n) {
  const reg = await navigator.serviceWorker?.getRegistration();
  const opts = {
    body: n.body,
    tag: n.id,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { target: n.target },
    actions: n.fasting ? [{ action: 'done', title: 'Đã ăn chay' }] : [],
  };
  if (reg) await reg.showNotification(n.title, opts);
  else new Notification(n.title, opts);
}

export async function testNotification() {
  const info = nextFastingDay(new Date(), true);
  if (!info) return;
  const days = daysBetween(new Date(), info.date);
  await showNotification({ id: 'test', target: toKey(info.date), fasting: info.fasting, ...buildMessage(info, days) });
}

// ---------- Bộ hẹn giờ khi app đang mở + đồng bộ lịch cho Service Worker ----------
let timer = null;
const CATCH_UP_MS = 6 * 60 * 60 * 1000; // nhắc bù nếu lỡ trong 6 giờ gần nhất

export async function syncSchedule() {
  clearTimeout(timer);
  const list = upcomingNotifications(new Date(), 45);
  // Lưu lịch cho Service Worker (dùng khi periodic sync đánh thức app)
  try {
    const cache = await caches.open('thaptrai-schedule');
    await cache.put('schedule.json', new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    /* Cache API không khả dụng */
  }
  updateBadge();
  if (permissionState() !== 'granted') return;
  syncPush(list);

  const now = Date.now();
  const state = getState();
  for (const n of list) {
    if (n.fireAt <= now && now - n.fireAt < CATCH_UP_MS && !state.notified[n.id]) {
      await showNotification(n);
      update((s) => (s.notified[n.id] = now));
    }
  }
  const next = list.find((n) => n.fireAt > now);
  if (next) {
    const wait = Math.min(next.fireAt - now, 2 ** 31 - 1);
    timer = setTimeout(async () => {
      if (!getState().notified[next.id]) {
        await showNotification(next);
        update((s) => (s.notified[next.id] = Date.now()));
      }
      syncSchedule();
    }, wait);
  }
  pruneNotified();
}

function pruneNotified() {
  const limit = Date.now() - 60 * 24 * 3600 * 1000;
  const n = getState().notified;
  if (Object.values(n).some((t) => t < limit)) {
    update((s) => {
      for (const k of Object.keys(s.notified)) if (s.notified[k] < limit) delete s.notified[k];
    });
  }
}

// ---------- Web Push: máy chủ gửi đúng giờ cả khi app đã đóng (iOS 16.4+ đã thêm vào MH chính, Android) ----------
const VAPID_PUBLIC_KEY = 'BG6FpKMwADlQYPg0FrXFkpkR1I0sPHvG3wL7662XEbVl4TwUXe8KE0nQSZgocUnbGfJ_8B_VrR3x03ifqiw52Ts';
const PUSH_ENDPOINT_KEY = 'thaptrai.pushEndpoint';

function base64UrlToBytes(s) {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

let pushStatus = { ok: false, next: null, error: null };
export const getPushStatus = () => pushStatus;

/** Đăng ký push (nếu chưa) rồi gửi lịch nhắc lên máy chủ */
export async function syncPush(list = upcomingNotifications(new Date(), 45)) {
  if (!pushSupported() || permissionState() !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    const test = getState().pushTest;
    const schedule = test && test > Date.now() - 6 * 3600 * 1000 ? [...list, pushTestItem(test)] : list;
    let replaces = null;
    try {
      replaces = localStorage.getItem(PUSH_ENDPOINT_KEY);
    } catch {}
    const res = await fetch('api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: json, schedule, replaces: replaces !== json.endpoint ? replaces : null }),
    });
    if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);
    const out = await res.json();
    try {
      localStorage.setItem(PUSH_ENDPOINT_KEY, json.endpoint);
    } catch {}
    pushStatus = { ok: true, next: out.next, error: null };
  } catch (err) {
    pushStatus = { ok: false, next: null, error: err.message };
  }
  return pushStatus;
}

function pushTestItem(fireAt) {
  const t = new Date(fireAt);
  return {
    id: `test|${fireAt}`,
    fireAt,
    target: toKey(t),
    fasting: false,
    title: 'Thử nhắc nền 🌿',
    body: `Máy chủ gửi lúc ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} — nhắc ngày chay sẽ đến như thế này kể cả khi app đã đóng.`,
  };
}

/** Hẹn một thông báo thử từ máy chủ sau `minutes` phút (để kiểm tra khi đóng app) */
export async function schedulePushTest(minutes = 2) {
  update((s) => (s.pushTest = Date.now() + minutes * 60 * 1000));
  return syncPush();
}

export async function registerPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await reg.periodicSync.register('thaptrai-check', { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

// R11: huy hiệu trên icon = số ngày đến ngày chay kế tiếp
export function updateBadge() {
  if (!('setAppBadge' in navigator)) return;
  const info = nextFastingDay(new Date(), true);
  if (!info) return navigator.clearAppBadge?.();
  const n = daysBetween(new Date(), info.date);
  (n > 0 ? navigator.setAppBadge(n) : navigator.setAppBadge()).catch(() => {});
}

// ---------- Xuất .ics: nhắc qua lịch hệ thống, chạy cả khi app đóng ----------
function icsDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function icsEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function triggerFor(r) {
  // Sự kiện cả ngày bắt đầu 00:00; tính độ lệch đến giờ nhắc
  const [hh, mm] = r.time.split(':').map(Number);
  let minutes = -r.daysBefore * 24 * 60 + hh * 60 + mm;
  const sign = minutes < 0 ? '-' : '';
  minutes = Math.abs(minutes);
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
  return `${sign}P${d ? d + 'D' : ''}T${h}H${m}M`;
}

export function buildICS(months = 12) {
  const state = getState();
  const start = new Date();
  const days = Math.round(months * 30.5);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ThapTrai//VI', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Thập Trai', 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh'];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const info = dayInfo(d, state);
    const evs = info.events.filter((e) => e.remind);
    if (!info.fasting && !evs.length) continue;
    const l = info.lunar;
    const summary = [info.fasting ? `🌿 Ngày chay (${lunarDayLabel(l.day).toLowerCase()} ÂL)` : null, ...evs.map((e) => e.name)].filter(Boolean).join(' • ');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${toKey(d)}@thaptrai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(d)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(d, 1))}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(`${lunarShort(l)} âm lịch`)}`,
      'TRANSP:TRANSPARENT',
    );
    for (const r of state.settings.reminders.filter((x) => x.enabled)) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(buildMessage(info, r.daysBefore).title)}`, `TRIGGER:${triggerFor(r)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
