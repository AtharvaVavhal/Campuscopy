const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || "campuscopy",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("connect", () => console.log("PostgreSQL connected"));
pool.on("error",   (err) => console.error("PostgreSQL error:", err.message));

pool.query("SELECT 1")
  .then(() => console.log("DB connection verified"))
  .catch((err) => console.error("DB connection failed:", err.message));

module.exports = pool;