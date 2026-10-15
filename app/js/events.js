// Ngày Phật pháp theo âm lịch (R7, BR5, BR6)

const p = (id, name, day, month, enabled) => ({
  id: `p-${id}`,
  name,
  day,
  month,
  leap: false,
  repeat: 'yearly',
  year: null,
  remind: true,
  fasting: false,
  remindInLeap: false,
  enabled,
  preset: true,
});

export const PRESET_EVENTS = [
  p('di-lac', 'Vía Phật Di Lặc', 1, 1, false),
  p('ram-gieng', 'Rằm tháng Giêng (Thượng Nguyên)', 15, 1, true),
  p('xuat-gia', 'Phật Thích Ca xuất gia', 8, 2, false),
  p('niet-ban', 'Phật Thích Ca nhập Niết Bàn', 15, 2, false),
  p('qa-dan-sanh', 'Vía Quan Âm đản sanh', 19, 2, true),
  p('pho-hien', 'Vía Bồ Tát Phổ Hiền', 21, 2, false),
  p('van-thu', 'Vía Bồ Tát Văn Thù', 4, 4, false),
  p('phat-dan', 'Lễ Phật Đản', 15, 4, true),
  p('qa-thanh-dao', 'Vía Quan Âm thành đạo', 19, 6, true),
  p('vu-lan', 'Lễ Vu Lan (Trung Nguyên)', 15, 7, true),
  p('dia-tang', 'Vía Bồ Tát Địa Tạng', 30, 7, false),
  p('qa-xuat-gia', 'Vía Quan Âm xuất gia', 19, 9, true),
  p('duoc-su', 'Vía Phật Dược Sư', 30, 9, false),
  p('ha-nguyen', 'Rằm tháng Mười (Hạ Nguyên)', 15, 10, false),
  p('a-di-da', 'Vía Phật A Di Đà', 17, 11, true),
  p('thanh-dao', 'Phật Thích Ca thành đạo', 8, 12, false),
];

/** Các sự kiện rơi vào ngày âm `lunar` (kết quả của solarToLunar) */
export function eventsOn(lunar, events) {
  return events.filter((e) => e.enabled && matches(e, lunar));
}

function matches(e, l) {
  if (e.repeat === 'once') {
    return e.year === l.year && e.month === l.month && !!e.leap === l.leap && dayMatches(e.day, l);
  }
  if (e.month !== l.month) return false;
  // BR6: sự kiện lặp hằng năm không áp dụng trong tháng nhuận, trừ khi bật riêng
  if (l.leap && !e.remindInLeap) return false;
  return dayMatches(e.day, l);
}

function dayMatches(day, l) {
  if (day === l.day) return true;
  // BR5: ngày 30 không tồn tại (tháng thiếu) → dời về 29
  return day === 30 && l.monthLength === 29 && l.day === 29;
}
