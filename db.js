// db.js
import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;

// חיבור למסד הנתונים
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // אם אתה מריץ על Render או Heroku, ייתכן שתצטרך לבטל את ההערה בשורה הבאה:
  // ssl: { rejectUnauthorized: false },
});

export function query(text, params) {
  return pool.query(text, params);
}

export { pool };
