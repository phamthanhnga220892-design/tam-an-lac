// Chuyển đổi âm – dương lịch Việt Nam (thuật toán Hồ Ngọc Đức), múi giờ UTC+7.
// Tính hoàn toàn offline trên client.

const TZ = 7;
const PI = Math.PI;

export function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) {
    a = jd + 32044;
    b = Math.floor((4 * a + 3) / 146097);
    c = a - Math.floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = b * 100 + d - 4800 + Math.floor(m / 10);
  return { day, month, year };
}

function newMoon(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat;
  if (T < -11) deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  else deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

// Kinh độ mặt trời (radian) tại thời điểm jdn (ngày Julius, tính cả phần lẻ)
function sunLongitudeRad(jdn) {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T, dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - PI * 2 * Math.floor(L / (PI * 2));
  return L;
}

function getNewMoonDay(k) {
  return Math.floor(newMoon(k) + 0.5 + TZ / 24);
}

// Cung kinh độ mặt trời 0..11 (mỗi cung 30°) vào đầu ngày dayNumber
function getSunLongitude(dayNumber) {
  return Math.floor((sunLongitudeRad(dayNumber - 0.5 - TZ / 24) / PI) * 6);
}

function getLunarMonth11(yy) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = Math.floor(off / 29.530588853);
  let nm = getNewMoonDay(k);
  const sunLong = getSunLongitude(nm);
  if (sunLong >= 9) nm = getNewMoonDay(k - 1);
  return nm;
}

function getLeapMonthOffset(a11) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i));
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

const cache = new Map();

/** Dương → Âm. Trả về { day, month, year, leap, monthLength, jd } */
export function solarToLunar(dd, mm, yy) {
  const key = `${yy}-${mm}-${dd}`;
  if (cache.has(key)) return cache.get(key);
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
  let a11 = getLunarMonth11(yy);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;

  // Độ dài tháng âm = khoảng cách giữa hai điểm Sóc (BR3)
  let nextStart = getNewMoonDay(Math.floor((monthStart - 2415021.076998695) / 29.530588853 + 0.5) + 1);
  if (nextStart <= monthStart) nextStart = getNewMoonDay(Math.floor((monthStart - 2415021.076998695) / 29.530588853 + 0.5) + 2);
  const monthLength = nextStart - monthStart;

  const res = { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap, monthLength, jd: dayNumber, monthStartJd: monthStart };
  cache.set(key, res);
  return res;
}

/** Âm → Dương. Trả về {day, month, year} hoặc null nếu không tồn tại (vd tháng nhuận không có) */
export function lunarToSolar(lunarDay, lunarMonth, lunarYear, lunarLeap = false) {
  let a11, b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1);
    b11 = getLunarMonth11(lunarYear);
  } else {
    a11 = getLunarMonth11(lunarYear);
    b11 = getLunarMonth11(lunarYear + 1);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (lunarLeap && lunarMonth !== leapMonth) return null;
    if (lunarLeap || off >= leapOff) off += 1;
  } else if (lunarLeap) {
    return null;
  }
  const monthStart = getNewMoonDay(k + off);
  return jdToDate(monthStart + lunarDay - 1);
}

/** Tháng nhuận của năm âm (0 nếu không có) */
export function leapMonthOfYear(lunarYear) {
  // Khoảng (tháng 11 năm trước → tháng 11 năm nay): tháng nhuận 1..10 thuộc năm nay
  // Khoảng (tháng 11 năm nay → tháng 11 năm sau): tháng nhuận 11, 12 thuộc năm nay
  for (const y of [lunarYear - 1, lunarYear]) {
    const a11 = getLunarMonth11(y);
    const b11 = getLunarMonth11(y + 1);
    if (b11 - a11 <= 365) continue;
    let m = getLeapMonthOffset(a11) - 2;
    if (m <= 0) m += 12;
    const belongsToThisYear = y === lunarYear - 1 ? m <= 10 : m >= 11;
    if (belongsToThisYear) return m;
  }
  return 0;
}

// ---------- Can chi, tiết khí ----------
export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const TIET_KHI = [
  'Xuân Phân', 'Thanh Minh', 'Cốc Vũ', 'Lập Hạ', 'Tiểu Mãn', 'Mang Chủng',
  'Hạ Chí', 'Tiểu Thử', 'Đại Thử', 'Lập Thu', 'Xử Thử', 'Bạch Lộ',
  'Thu Phân', 'Hàn Lộ', 'Sương Giáng', 'Lập Đông', 'Tiểu Tuyết', 'Đại Tuyết',
  'Đông Chí', 'Tiểu Hàn', 'Đại Hàn', 'Lập Xuân', 'Vũ Thủy', 'Kinh Trập',
];

export function canChiYear(lunarYear) {
  return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
}
export function canChiDay(jd) {
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
}
export function canChiMonth(lunarMonth, lunarYear) {
  return `${CAN[(lunarYear * 12 + lunarMonth + 3) % 10]} ${CHI[(lunarMonth + 1) % 12]}`;
}
export function tietKhi(jd) {
  const idx = Math.floor((sunLongitudeRad(jd + 0.5 - TZ / 24) / PI) * 12);
  return TIET_KHI[idx];
}

// Giờ hoàng đạo theo chi ngày
const GIO_HD = ['110100101100', '001101001011', '110011010010', '101100110100', '001011001101', '010010110011'];
export function gioHoangDao(jd) {
  const chiOfDay = (jd + 1) % 12;
  const pattern = GIO_HD[chiOfDay % 6];
  const out = [];
  for (let i = 0; i < 12; i++) {
    if (pattern[i] === '1') {
      const start = (i * 2 + 23) % 24;
      out.push({ chi: CHI[i], from: start, to: (start + 2) % 24 });
    }
  }
  return out;
}

export const MONTH_NAMES = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Một', 'Chạp'];
export function lunarMonthName(m, leap) {
  return `${MONTH_NAMES[m - 1]}${leap ? ' nhuận' : ''}`;
}
export function lunarDayLabel(d) {
  if (d <= 10) return `Mùng ${d}`;
  if (d === 15) return 'Rằm';
  return `${d}`;
}
