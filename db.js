// db.js
import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;

// מתחברים ל-Postgres לפי הכתובת שב-DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // אם ברנדר תצטרך SSL – נוסיף פה, בינתיים אפשר בלי
  // ssl: { rejectUnauthorized: false },
});

// פונקציה נוחה להריץ שאילתות: query("SELECT ...", [param1, param2])
export function query(text, params) {
  return pool.query(text, params);
}

export { pool };
