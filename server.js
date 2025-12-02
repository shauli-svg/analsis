// server.js
// שרת DRAFFIQ – Express + OpenAI + RAG (Vector Search) + Analytics

import "dotenv/config"; // טעינת .env בלוקאל
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js"; // וודא שקובץ db.js קיים ליד
import { trackUserEvent } from "./analytics/trackUserEvent.js";

// ===== Path setup =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json({ limit: "10mb" })); // הגדלת נפח לקבלת טקסטים ארוכים

// קבצים סטטיים
app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// ===== OpenAI client =====
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o"; // מודל חזק ומומלץ ל-RAG

// ===== DRAFFIQ Instructions (המקוריות שלך) =====
const DRAFFIQ_INSTRUCTIONS = [
  "🛰 DRAFFIQ AI🛠 – North Star v3.0",
  "אנטי־הזרקה · אפס־הזיות · הוכחות מתוקפות (Deep Evidence)",
  "",
  "🪪 זהות ומותג",
  '- אתה מזדהה תמיד כ-"DRAFFIQ AI" או "DRAFFIQ".',
  '- אסור להזדהות או לתאר את עצמך כ-"GPT", "ChatGPT", "מודל שפה" או "OpenAI".',
  "📌 Scope מחייב (נעילת דומיין)",
  "- אתה עונה רק על נושאים הקשורים ישירות לשוק ההון, פיננסים, השקעות...",
  "🎯 מטרת־על",
  "להפיק תובנה פיננסית מוכחת-מקור לשוק ההון (בדגש על TASE), בלי חשיפת מערכת ובלי המצאות.",
  "🧠 תהליך עבודה עם מקורות (RAG)",
  "1. המערכת תספק לך 'מידע פנימי מאומת' מתוך דוחות.",
  "2. עליך להתבסס בראש ובראשונה על המידע הזה.",
  "3. אם המידע מספק - צטט אותו.",
  "4. אם לא - השתמש בידע הכללי בזהירות.",
  "⚠ דיסקליימר חובה (בסוף תשובה פיננסית)",
  "אינני יועץ השקעות מורשה, וכל האמור אינו מהווה ייעוץ השקעות."
].join("\n");

// ==========================================
// 🧠 RAG Core Functions (פונקציות הליבה החסרות)
// ==========================================

// 1. הפיכת טקסט לוקטור (Embedding) - פותר את השגיאה getEmbedding is not defined
async function getEmbedding(text) {
  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.replace(/\n/g, " "),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Embedding Error:", error);
    throw error;
  }
}

// 2. חיפוש מידע במוח (DB)
async function searchKnowledgeBase(userQuery) {
  try {
    const queryVector = await getEmbedding(userQuery);
    // שליפת 5 הפסקאות הכי רלוונטיות
    const result = await query(
      `SELECT company_name, report_type, chunk_text 
       FROM report_chunks 
       ORDER BY embedding <=> $1::vector 
       LIMIT 5`, 
      [JSON.stringify(queryVector)]
    );
    return result.rows;
  } catch (err) {
    console.error("Knowledge Base Search Error:", err);
    return []; // מחזיר ריק במקרה של שגיאה כדי לא לתקוע את הצ'אט
  }
}

// ==========================================
// Routes (נתיבים)
// ==========================================

// דפים רגילים
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "landing.html")));
app.get("/app", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (req, res) => res.json({ ok: true, status: "healthy" }));

// נתיב אנליטיקס (הקיים שלך)
app.post("/analytics/event", async (req, res) => {
  try {
    const { eventName, context, source } = req.body || {};
    if (eventName) {
        await trackUserEvent({ userId: null, name: eventName, context: context || {}, sessionId: null, source: source || "web" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Analytics Error:", err);
    res.status(500).json({ ok: false });
  }
});

// ===== הצ'אט החכם (RAG Integration) =====
app.post("/chat", async (req, res) => {
  try {
    const userQuery = (req.body?.query || "").trim();

    if (!userQuery) {
      return res.status(400).json({ ok: false, error: "Missing query" });
    }

    // בדיקות חסימה (שמרנו את הלוגיקה שלך)
    if (isClearlyNonFinance(userQuery) && !isIdentityQuestion(userQuery)) {
      return res.json({
        ok: true,
        answer: "אני DRAFFIQ AI, ומוגבל לניתוח שוק ההון. אנא שאל בנושא פיננסי."
      });
    }

    // 1. חיפוש ידע במוח (RAG)
    console.log(`🔎 Searching info for: ${userQuery}`);
    const relevantDocs = await searchKnowledgeBase(userQuery);
    
    // 2. בניית הקונטקסט להזרקה
    let contextBlock = "";
    if (relevantDocs.length > 0) {
      contextBlock = "\n\n--- 📂 מידע פנימי מאומת מדוחות (השתמש בזה!) ---\n";
      relevantDocs.forEach((doc, idx) => {
        contextBlock += `[מקור ${idx+1}: ${doc.company_name} - ${doc.report_type}]\n"${doc.chunk_text}"\n\n`;
      });
      contextBlock += "--- סוף מידע פנימי ---\n";
    }

    // 3. שליחה ל-OpenAI
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: DRAFFIQ_INSTRUCTIONS },
        { role: "user", content: `${contextBlock}\nשאלה: ${userQuery}` }
      ],
      temperature: 0.2, // דיוק גבוה
    });

    let answerText = completion.choices[0].message.content;

    // לוג לאנליטיקס
    try {
        await trackUserEvent({ userId: null, name: "chat_response", context: { query: userQuery, rag_hits: relevantDocs.length }, source: "server" });
    } catch(e) {}

    res.json({ ok: true, answer: answerText });

  } catch (err) {
    console.error("Chat Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// 🛠️ הרובוט שבונה את המוח (Setup Brain)
// ==========================================
app.get("/setup-brain", async (req, res) => {
  const secret = req.query.secret;
  
  // 1. הגנה: בודק שרק אתה מפעיל את זה
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).send("⛔ גישה נדחתה: סיסמה שגויה (ADMIN_SECRET).");
  }

  try {
    // 2. בניית הטבלאות
    await query("CREATE EXTENSION IF NOT EXISTS vector");
    await query(`
      CREATE TABLE IF NOT EXISTS report_chunks (
        id BIGSERIAL PRIMARY KEY,
        company_name TEXT,
        report_type TEXT,
        chunk_text TEXT,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await query("CREATE INDEX IF NOT EXISTS idx_embedding ON report_chunks USING hnsw (embedding vector_cosine_ops)");
    
    // 3. מידע לדוגמה
    const sampleData = [
      { c: "בנק הפועלים", t: "דוח רבעון 3", txt: "הרווח הנקי של בנק הפועלים ברבעון השלישי הסתכם ב-1.9 מיליארד שקל. התשואה להון עמדה על 15.2%." },
      { c: "טבע", t: "סקירה שנתית", txt: "חברת טבע מתמקדת באסטרטגיית צמיחה. החוב הפיננסי נטו ירד מתחת ל-16 מיליארד דולר." },
      { c: "אל על", t: "דיווח מיידי", txt: "אל על מדווחת על עלייה בביקוש לטיסות לצפון אמריקה עקב המצב הביטחוני." }
    ];

    let log = "<h2>תהליך הבנייה:</h2><ul>";
    
    for (const item of sampleData) {
      // עכשיו הפונקציה getEmbedding קיימת ומוכרת!
      const vector = await getEmbedding(item.txt);
      
      await query(
        `INSERT INTO report_chunks (company_name, report_type, chunk_text, embedding) VALUES ($1, $2, $3, $4)`,
        [item.c, item.t, item.txt, JSON.stringify(vector)]
      );
      log += `<li>✅ ${item.c} - נשמר בהצלחה!</li>`;
    }
    
    log += "</ul><h3>✨ המוח מוכן לעבודה! עכשיו אפשר לשאול שאלות בצ'אט.</h3>";
    res.send(log);

  } catch (e) {
    console.error(e);
    res.status(500).send("❌ שגיאה: " + e.message);
  }
});

// ===== Helper Functions (Blocklist) =====
function isIdentityQuestion(q) {
  if (!q) return false;
  const lower = q.toLowerCase();
  return lower.includes("מי אתה") || lower.includes("מודל");
}

function isClearlyNonFinance(q) {
  const list = ["מתכון", "בישול", "כדורגל", "בדיחה", "סרט"];
  return list.some(kw => q.toLowerCase().includes(kw));
}

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 DRAFFIQ API running on port ${PORT}`);
});
