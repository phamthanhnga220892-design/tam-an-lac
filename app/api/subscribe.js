// POST /api/subscribe — lưu push subscription + lịch nhắc 45 ngày tới (đầu ra upcomingNotifications).
import { pipeline, idOf, subKey, sentKey, SUBS, KEEP_SECONDS } from './_redis.js';

const MAX_ITEMS = 1000;
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanSchedule(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((n) => n && typeof n.id === 'string' && Number.isFinite(n.fireAt))
    .slice(0, MAX_ITEMS)
    .map((n) => ({
      id: str(n.id, 100),
      fireAt: n.fireAt,
      title: str(n.title, 200),
      body: str(n.body, 500),
      target: str(n.target, 20),
      fasting: !!n.fasting,
    }));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Client lấy public key (để không phải nhúng cứng khi đổi khoá)
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) {
    return res.status(400).json({ error: 'subscription không hợp lệ' });
  }
  const subscription = { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } };
  const id = idOf(sub.endpoint);

  try {
    if (body.unsubscribe) {
      await pipeline([['DEL', subKey(id)], ['DEL', sentKey(id)], ['SREM', SUBS, id]]);
      return res.status(200).json({ ok: true, removed: true });
    }
    const schedule = cleanSchedule(body.schedule);
    const record = { subscription, schedule, updatedAt: Date.now() };
    const cmds = [
      ['SET', subKey(id), JSON.stringify(record), 'EX', KEEP_SECONDS],
      ['SADD', SUBS, id],
    ];
    // Endpoint cũ (trình duyệt đổi subscription) → xoá
    if (typeof body.replaces === 'string' && body.replaces !== sub.endpoint) {
      const old = idOf(body.replaces);
      cmds.push(['DEL', subKey(old)], ['DEL', sentKey(old)], ['SREM', SUBS, old]);
    }
    await pipeline(cmds);
    const next = schedule.filter((n) => n.fireAt > Date.now()).sort((a, b) => a.fireAt - b.fireAt)[0];
    return res.status(200).json({ ok: true, count: schedule.length, next: next ? next.fireAt : null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
