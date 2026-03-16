// queues/connection.js
// Shared Redis connection config for BullMQ.
// BullMQ manages its own connections — separate from the ioredis instance
// used for caching so they don't interfere with each other.

function getConnection() {
  if (process.env.REDIS_URL) {
    return {
      url: process.env.REDIS_URL,
      tls: { rejectUnauthorized: false },
      maxRetriesPerRequest: null, // required by BullMQ
    };
  }
  return {
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // required by BullMQ
  };
}

module.exports = { getConnection };