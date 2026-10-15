// Upstash Redis qua REST (không cần thư viện). Hỗ trợ tên biến của tích hợp Vercel (KV_*) và của Upstash.
import { createHash } from 'node:crypto';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const SUBS = 'tt:subs'; // set các id subscription
export const subKey = (id) => `tt:sub:${id}`; // JSON {subscription, schedule, updatedAt}
export const sentKey = (id) => `tt:sent:${id}`; // hash {notificationId: timestamp}
export const KEEP_SECONDS = 60 * 24 * 3600; // subscription không gửi lại 60 ngày thì tự hết hạn

export function idOf(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

/** Chạy một lệnh Redis, trả về result */
export async function redis(...cmd) {
  const [r] = await pipeline([cmd]);
  return r;
}

/** Chạy nhiều lệnh trong một request */
export async function pipeline(cmds) {
  if (!URL_ || !TOKEN) throw new Error('Chưa cấu hình Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN)');
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}: ${await res.text()}`);
  const out = await res.json();
  for (const r of out) if (r.error) throw new Error(`Redis: ${r.error}`);
  return out.map((r) => r.result);
}
