// Token buckets in memory, keyed by whatever the caller passes (an IP, a DID). Refill per minute.
const buckets = new Map();
export function allow(key, perMinute) {
  const now = Date.now(); let b = buckets.get(key);
  if (!b) { b = { tokens: perMinute, at: now }; buckets.set(key, b); }
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60e3) * perMinute); b.at = now;
  if (b.tokens < 1) return false; b.tokens -= 1; return true;
}
setInterval(() => { const cutoff = Date.now() - 10 * 60e3; for (const [k, b] of buckets) if (b.at < cutoff) buckets.delete(k); }, 60e3).unref();
