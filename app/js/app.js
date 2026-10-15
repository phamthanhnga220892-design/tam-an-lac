import { subscribe, update } from './store.js';
import { syncSchedule, registerPeriodicSync } from './notify.js';
import { toast } from './ui.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderEvents } from './views/events.js';
import { renderSettings } from './views/settings.js';

const routes = {
  'hom-nay': { title: 'Hôm Nay', render: renderToday },
  lich: { title: 'Lịch Âm', render: renderCalendar },
  'su-kien': { title: 'Ngày Phật Pháp', render: renderEvents },
  'cai-dat': { title: 'Cài Đặt Nhắc', render: renderSettings },
};

const view = document.getElementById('view');
let current = null;

function routeName() {
  const r = location.hash.replace(/^#\/?/, '').split('?')[0];
  return routes[r] ? r : 'hom-nay';
}

export function render() {
  const name = routeName();
  const changed = name !== current;
  current = name;
  document.getElementById('page-title').textContent = routes[name].title;
  document.querySelectorAll('.tab-bar a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
  const y = window.scrollY;
  routes[name].render(view);
  window.scrollTo(0, changed ? 0 : y);
}

window.addEventListener('hashchange', render);
document.getElementById('btn-today').addEventListener('click', () => {
  if (location.hash === '#/hom-nay') render();
  else location.hash = '#/hom-nay';
  window.dispatchEvent(new CustomEvent('go-today'));
});

// Dữ liệu đổi → lập lịch nhắc lại (debounce)
let syncT;
subscribe(() => {
  clearTimeout(syncT);
  syncT = setTimeout(syncSchedule, 300);
});

// Đánh dấu "đã ăn chay" từ nút trên thông báo
function markDone(target) {
  if (!target) return;
  update((s) => (s.log[target] = true));
  toast('Đã ghi nhận ngày chay 🌿');
  render();
}
const params = new URLSearchParams(location.search);
if (params.get('done')) {
  markDone(params.get('done'));
  history.replaceState(null, '', location.pathname + location.hash);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => registerPeriodicSync());
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'mark-done') markDone(e.data.target);
  });
}

// Qua nửa đêm hoặc quay lại app → cập nhật "hôm nay" và lịch nhắc
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  syncSchedule();
  if (new Date().toDateString() !== lastDay) {
    lastDay = new Date().toDateString();
    render();
  }
});
setInterval(() => {
  if (new Date().toDateString() !== lastDay) {
    lastDay = new Date().toDateString();
    render();
  }
}, 60 * 1000);

if (!location.hash) history.replaceState(null, '', '#/hom-nay');
render();
syncSchedule();
