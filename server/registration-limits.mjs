const limited = (status, message) =>
  Object.assign(new Error(message), { status, retryAfter: 60 });

// Per-service limits. Socket addresses are trusted; client-provided forwarding headers are not.
export function createRegistrationGuard({ now = Date.now } = {}) {
  const sources = new Map();
  let global = { at: now(), count: 0 };
  let active = 0;
  const waiting = [];
  function check(source) {
    const time = now();
    for (const [key, bucket] of sources)
      if (time - bucket.at >= 60000) sources.delete(key);
    if (time - global.at >= 60000) global = { at: time, count: 0 };
    if (global.count >= 120)
      throw limited(429, "註冊過於頻繁，請一分鐘後再試。");
    global.count++;
    let bucket = sources.get(source);
    if (!bucket) {
      if (sources.size >= 2048) throw limited(429, "註冊忙碌中，請稍後再試。");
      bucket = { at: time, count: 0 };
      sources.set(source, bucket);
    }
    if (bucket.count >= 60)
      throw limited(429, "此連線來源註冊過於頻繁，請一分鐘後再試。");
    bucket.count++;
  }
  async function run(job) {
    if (active >= 2) {
      if (waiting.length >= 30)
        throw limited(503, "註冊忙碌中，請稍後手動重試。");
      await new Promise((resolve) => waiting.push(resolve));
    } else active++;
    try {
      return await job();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }
  return { check, run };
}
