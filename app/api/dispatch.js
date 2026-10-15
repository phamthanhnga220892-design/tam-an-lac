// POST/GET /api/dispatch — gọi mỗi phút từ cron-job.org (có secret). Gửi Web Push cho các lời nhắc đến hạn.
import webpush from 'web-push';
import { redis, pipeline, subKey, sentKey, SUBS, KEEP_SECONDS } from './_redis.js';

const LATE_MS = 6 * 60 * 60 * 1000; // lỡ (cron chết, máy chủ lỗi) quá 6 giờ thì bỏ, giống nhắc bù phía app

function authorized(req) {
  const secret = process.env.DISPATCH_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${secret}` || req.query?.key === secret;
}

async function sendOne(subscription, n) {
  const payload = JSON.stringify({ title: n.title, body: n.body, tag: n.id, target: n.target, fasting: n.fasting });
  const ttl = Math.max(60, Math.round((LATE_MS - (Date.now() - n.fireAt)) / 1000));
  return webpush.sendNotification(subscription, payload, { TTL: ttl, urgency: 'high' });
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://tam-an-lac.vercel.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const now = Date.now();
  const report = { subs: 0, sent: 0, failed: 0, removed: 0 };
  try {
    const ids = (await redis('SMEMBERS', SUBS)) || [];
    report.subs = ids.length;
    if (!ids.length) return res.status(200).json(report);
    const records = await pipeline(ids.map((id) => ['GET', subKey(id)]));

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!records[i]) {
        // Subscription hết hạn lưu (không mở app 60 ngày)
        await pipeline([['SREM', SUBS, id], ['DEL', sentKey(id)]]);
        report.removed++;
        continue;
      }
      const { subscription, schedule } = JSON.parse(records[i]);
      const due = schedule.filter((n) => n.fireAt <= now && now - n.fireAt < LATE_MS);
      if (!due.length) continue;

      // HSETNX: chỉ một lần gọi dispatch được "giữ chỗ" gửi mỗi lời nhắc
      const claims = await pipeline(due.map((n) => ['HSETNX', sentKey(id), n.id, now]));
      for (let j = 0; j < due.length; j++) {
        if (claims[j] !== 1) continue;
        const n = due[j];
        try {
          await sendOne(subscription, n);
          report.sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await pipeline([['DEL', subKey(id)], ['DEL', sentKey(id)], ['SREM', SUBS, id]]);
            report.removed++;
            break;
          }
          console.error('push lỗi', err.statusCode, err.body || err.message);
          await redis('HDEL', sentKey(id), n.id); // thử lại ở lần gọi sau
          report.failed++;
        }
      }
      await redis('EXPIRE', sentKey(id), KEEP_SECONDS);
    }
    return res.status(200).json(report);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message, ...report });
  }
}
