const Redis = require("ioredis");

// Use TLS only for rediss:// URLs (Upstash) — not for Render internal redis://
const isTLS = process.env.REDIS_URL?.startsWith("rediss://");

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    })
  : new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

module.exports = redis;