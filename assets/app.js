const SESSIONS_KEY = "draffiq-sessions-v2";
const OLD_STORAGE_KEY = "draffiq-chat-v1";

const form = document.getElementById("chat-form");
const textarea = document.getElementById("query");
const messages = document.getElementById("messages");
const sendBtn = document.getElementById("send-btn");
const printBtn = document.getElementById("print-btn");
const shareBtn = document.getElementById("share-btn");
const newBtn = document.getElementById("new-btn");
const menuBtn = document.getElementById("menu-btn");
const landingOverlay = document.getElementById("landing-overlay");
const landingCta = document.getElementById("landing-cta");
const chatSection = document.getElementById("chat-section");
const menuDropdown = document.getElementById("menu-dropdown");
const homeLink = document.getElementById("home-link");
const chatLink = document.getElementById("chat-link");
const sessionListEl = document.getElementById("session-list");
const sidebarNewBtn = document.getElementById("sidebar-new-btn");
const deepModeBtn = document.getElementById("deep-mode-btn");
const assetTypeSelect = document.getElementById("asset-type");
const highlightsWrapper = document.getElementById("highlights-wrapper");
const highlightsListEl = document.getElementById("highlights-list");
const clearHighlightsBtn = document.getElementById("clear-highlights-btn");

let sessions = [];
let activeSessionId = null;
let currentMode = "normal";
let currentWorkMode = "stock";

const EXAMPLE_PROMPTS = [
  { label: "מפת סיכונים למניה", text: "בנה לי מפת סיכונים והזדמנויות למניית פועלים לשנתיים הקרובות." },
  { label: "השוואת אג\"ח", text: "השווה בין אג\"ח ממשלתי שקלי ל-10 שנים לבין אג\"ח קונצרני בדירוג AA באותו מח\"מ." },
  { label: "סקטור נדל\"ן", text: "מהם הסיכונים המרכזיים כיום בסקטור הנדל\"ן המניב בישראל, ואילו תרחישים יכולים לשנות את הכיוון?" },
  { label: "דוח אחרון", text: "בצע ניתוח על הדוח האחרון של בזק, עם דגש על תזרים מזומנים ו-Red Flags פוטנציאליים." }
];

function setViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", vh + "px");
}
window.addEventListener("load", setViewportHeight);
window.addEventListener("resize", setViewportHeight);

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 80) + "px";
}

if (textarea) {
  textarea.addEventListener("input", () => autoResizeTextarea(textarea));
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (form) form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });
}

function renderTextWithLinks(text) {
  if (!text) return "";
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">🔗 קישור</a>`;
  });
}

function saveSessions() {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({ sessions, activeSessionId }));
  } catch (e) { }
}

function getActiveSession() {
  const s = sessions.find((sess) => sess.id === activeSessionId) || null;
  if (s) {
    if (!Array.isArray(s.messages)) s.messages = [];
    if (!Array.isArray(s.highlights)) s.highlights = [];
  }
  return s;
}

function renderMessagesForSession(session, options = {}) {
  const { scroll = true } = options;
  if (!messages) return;

  const rows = messages.querySelectorAll(".message-row");
  rows.forEach((r) => r.remove());

  if (!session || !Array.isArray(session.messages)) {
    if (scroll) messages.scrollTop = messages.scrollHeight;
    return;
  }

  session.messages.forEach((m) =>
    appendMessage(m.text, m.role, { persist: false, scroll: false, messageId: m.id })
  );

  if (scroll) messages.scrollTop = messages.scrollHeight;
}

function renderSessionList() {
  if (!sessionListEl) return;
  sessionListEl.innerHTML = "";

  sessions.forEach((sess) => {
    const wrapper = document.createElement("div");
    wrapper.className =
      "session-item-wrapper" + (sess.id === activeSessionId ? " active" : "");
    wrapper.dataset.sessionId = sess.id;

    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "session-item-main";
    mainBtn.textContent =
      sess.title ||
      "שיחה " +
        new Date(sess.createdAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        });
    mainBtn.title = "פתיחת שיחה";

    mainBtn.addEventListener("click", () => {
      if (sess.id === activeSessionId) return;
      activeSessionId = sess.id;
      saveSessions();
      renderSessionList();
      renderMessagesForSession(sess);
      renderHighlights();
    });

    const threeDotsBtn = document.createElement("button");
    threeDotsBtn.type = "button";
    threeDotsBtn.className = "session-item-menu-btn";
    threeDotsBtn.innerHTML = "⋮";

    const menu = document.createElement("div");
    menu.className = "session-item-menu";

    const renameItem = document.createElement("button");
    renameItem.type = "button";
    renameItem.className = "session-item-menu-item";
    renameItem.textContent = "שנה שם שיחה";

    renameItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("open");
      const currentTitle = sess.title || "";
      const newTitle = prompt("שם חדש לשיחה:", currentTitle);
      if (newTitle && newTitle.trim()) {
        sess.title = newTitle.trim();
        saveSessions();
        renderSessionList();
      }
    });

    menu.appendChild(renameItem);

    threeDotsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("open");
      document
        .querySelectorAll(".session-item-menu.open")
        .forEach((m) => m.classList.remove("open"));
      if (!isOpen) {
        menu.classList.add("open");
      }
    });

    wrapper.appendChild(mainBtn);
    wrapper.appendChild(threeDotsBtn);
    wrapper.appendChild(menu);

    sessionListEl.appendChild(wrapper);
  });
}

function createNewSession() {
  const id = "s_" + Date.now();
  const session = { id, title: "שיחה חדשה", createdAt: Date.now(), messages: [], highlights: [] };
  sessions.unshift(session);
  activeSessionId = id;
  saveSessions();
  renderSessionList();
  renderMessagesForSession(session);
  renderHighlights();
  if (textarea) {
    textarea.value = "";
    autoResizeTextarea(textarea);
    textarea.focus();
  }
}

function migrateOldHistoryIfNeeded() {
  try {
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return;
    const id = "s_" + Date.now();
    sessions = [
      {
        id,
        title: "שיחה קודמת",
        createdAt: Date.now(),
        messages: parsed.map((m, idx) => ({
          ...m,
          id: m.id || "m_" + Date.now() + "_" + idx
        })),
        highlights: []
      },
    ];
    activeSessionId = id;
  } catch (e) { }
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sessions)) {
        sessions = parsed.sessions.map((s) => ({
          ...s,
          messages: (s.messages || []).map((m, idx) => ({
            ...m,
            id: m.id || "m_" + s.id + "_" + idx
          })),
          highlights: s.highlights || []
        }));
        activeSessionId =
          parsed.activeSessionId || (sessions[0] && sessions[0].id) || null;
      }
    }
    if (!sessions || !sessions.length) {
      migrateOldHistoryIfNeeded();
    }
    if (!sessions || !sessions.length) {
      const id = "s_" + Date.now();
      sessions = [
        {
          id,
          title: "שיחה חדשה",
          createdAt: Date.now(),
          messages: [],
          highlights: []
        },
      ];
      activeSessionId = id;
    }
  } catch (e) {
    const id = "s_" + Date.now();
    sessions = [
      {
        id,
        title: "שיחה חדשה",
        createdAt: Date.now(),
        messages: [],
        highlights: []
      },
    ];
    activeSessionId = id;
  }
}

/**
 * הוספת הודעה לדום ולשיחה
 */
function appendMessage(text, role, options = {}) {
  const { persist = true, scroll = true, messageId = null } = options;
  if (!messages) return;

  let msgId = messageId || ("m_" + Date.now() + "_" + Math.random().toString(36).slice(2));

  const row = document.createElement("div");
  row.className = "message-row " + role;
  row.dataset.messageId = msgId;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = renderTextWithLinks(text);

  // כפתור כוכב רק על תשובות assistant
  if (role === "assistant") {
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = "highlight-star-btn";
    starBtn.textContent = "☆";

    const session = getActiveSession();
    const isHighlighted =
      session &&
      Array.isArray(session.highlights) &&
      session.highlights.some((h) => h.messageId === msgId);
    if (isHighlighted) {
      starBtn.classList.add("active");
      starBtn.textContent = "★";
    }

    starBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleHighlightForMessage(msgId, text, starBtn);
    });

    content.appendChild(starBtn);
  }

  row.appendChild(content);
  messages.appendChild(row);

  if (scroll && role === "user") {
    messages.scrollTop = messages.scrollHeight;
  }

  if (persist) {
    const session = getActiveSession();
    if (session) {
      if (role === "user" && Array.isArray(session.messages) && session.messages.length === 0) {
        let t = text.replace(/\s+/g, " ").trim();
        if (t.length > 28) t = t.slice(0, 28) + "…";
        session.title = t || "שיחה חדשה";
        renderSessionList();
      }
      if (!Array.isArray(session.messages)) session.messages = [];
      session.messages.push({ role, text, id: msgId });
      saveSessions();
    }
  }
}

/**
 * מוסיף "אני חושב…" זמני
 */
function appendThinking() {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML =
    `<div class="thinking-dots">
       <span class="thinking-dot"></span>
       <span class="thinking-dot"></span>
       <span class="thinking-dot"></span>
     </div>`;
  row.appendChild(content);
  messages.appendChild(row);
  return row;
}

/**
 * קריאה ל־API בצד שרת
 */
async function callApi(query) {
  const response = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    let err;
    try {
      err = await response.json();
    } catch {
      err = {};
    }
    throw new Error(err.error || "שגיאה בצד השרת.");
  }
  const data = await response.json();
  if (!data.ok && data.answer === undefined) {
    throw new Error(data.error || "שגיאה בצד השרת.");
  }
  return data.answer ?? "";
}

/**
 * טקסט גולמי של כל השיחה – לשיתוף
 */
function getConversationPlainText() {
  const session = getActiveSession();
  if (session && Array.isArray(session.messages) && session.messages.length > 0) {
    return session.messages
      .map((m) => (m.role === "user" ? "YOU" : "DRAFFIQ") + ":\n" + m.text)
      .join("\n\n");
  }
  const rows = messages.querySelectorAll(".message-row");
  const parts = [];
  rows.forEach((row) => {
    const isUser = row.classList.contains("user");
    const label = isUser ? "YOU" : "DRAFFIQ";
    const contentEl = row.querySelector(".message-content");
    if (!contentEl) return;
    const text = contentEl.innerText.trim();
    if (!text) return;
    parts.push(label + ":\n" + text);
  });
  return parts.join("\n\n");
}

/**
 * כפתורי PDF ושיתוף
 */
if (printBtn) {
  printBtn.addEventListener("click", () => {
    window.print();
  });
}

if (shareBtn) {
  shareBtn.addEventListener("click", async () => {
    const text = getConversationPlainText() || "DRAFFIQ – שיחה ריקה.";
    const title = "DRAFFIQ – שיחת מחקר";
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (e) { }
    } else {
      try {
        await navigator.clipboard.writeText(text + "\n\n" + url);
        alert("הטקסט והקישור הועתקו ללוח. ניתן להדביק בכל אפליקציה.");
      } catch {
        alert("שיתוף אוטומטי לא נתמך בדפדפן זה. נסה להעתיק ידנית.");
      }
    }
  });
}

/**
 * מסך כניסה
 */
if (landingCta) {
  landingCta.addEventListener("click", () => {
    landingOverlay.classList.add("hidden");
    if (chatSection && chatSection.scrollIntoView) {
      chatSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

/**
 * New Chat
 */
function handleNewChatClick() {
  createNewSession();
  if (menuDropdown) menuDropdown.classList.remove("open");
}

if (newBtn) newBtn.addEventListener("click", handleNewChatClick);
if (sidebarNewBtn) sidebarNewBtn.addEventListener("click", handleNewChatClick);

/**
 * תפריט עליון
 */
if (menuBtn) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!menuDropdown) return;
    menuDropdown.classList.toggle("open");
  });
}

if (homeLink) {
  homeLink.addEventListener("click", () => {
    window.location.href = "/";
  });
}

if (chatLink) {
  chatLink.addEventListener("click", () => {
    if (chatSection && chatSection.scrollIntoView) {
      chatSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (menuDropdown) menuDropdown.classList.remove("open");
  });
}

/**
 * סגירת תפריטים בלחיצה בחוץ
 */
document.addEventListener("click", (e) => {
  const target = e.target;

  if (menuDropdown && menuDropdown.classList.contains("open")) {
    if (
      target !== menuBtn &&
      !(menuBtn && menuBtn.contains(target)) &&
      !menuDropdown.contains(target)
    ) {
      menuDropdown.classList.remove("open");
    }
  }

  if (!target.closest(".session-item-wrapper")) {
    document
      .querySelectorAll(".session-item-menu.open")
      .forEach((m) => m.classList.remove("open"));
  }
});

/**
 * דוגמאות פרומפטים
 */
function renderPromptExamples() {
  const container = document.getElementById("promptExamplesContainer");
  if (!container || !textarea) return;
  container.innerHTML = EXAMPLE_PROMPTS.map((ex, i) =>
    `<button type="button" class="example-chip" data-idx="${i}">${ex.label}</button>`
  ).join("");

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".example-chip");
    if (!btn) return;
    const idx = btn.getAttribute("data-idx");
    const ex = EXAMPLE_PROMPTS[idx];
    if (!ex) return;
    textarea.value = ex.text;
    autoResizeTextarea(textarea);
    textarea.focus();
  });
}

/**
 * מצב Deep / רגיל
 */
function setupModeToggle() {
  if (!deepModeBtn) return;
  deepModeBtn.addEventListener("click", () => {
    const isActive = deepModeBtn.classList.contains("active");
    if (isActive) {
      deepModeBtn.classList.remove("active");
      currentMode = "normal";
    } else {
      deepModeBtn.classList.add("active");
      currentMode = "deep";
    }
  });
}

/**
 * מצבי עבודה – מניות / אג"ח / סקטור
 */
function setupWorkModes() {
  const buttons = document.querySelectorAll(".work-mode-option");
  if (!buttons.length) return;
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.getAttribute("data-mode");
      currentWorkMode = mode || "stock";
    });
  });
}

/**
 * מודול קוביות סיכום
 */
function toggleHighlightForMessage(messageId, text, starBtn) {
  const session = getActiveSession();
  if (!session) return;
  if (!Array.isArray(session.highlights)) session.highlights = [];

  const idx = session.highlights.findIndex((h) => h.messageId === messageId);
  if (idx >= 0) {
    // הסרה
    session.highlights.splice(idx, 1);
    if (starBtn) {
      starBtn.classList.remove("active");
      starBtn.textContent = "☆";
    }
  } else {
    // הוספה
    const plain = text.replace(/\s+/g, " ").trim();
    let snippet = plain;
    if (snippet.length > 80) snippet = snippet.slice(0, 80) + "…";

    session.highlights.push({
      id: "h_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      messageId,
      snippet,
      text,
      createdAt: Date.now()
    });

    if (starBtn) {
      starBtn.classList.add("active");
      starBtn.textContent = "★";
    }
  }

  saveSessions();
  renderHighlights();
}

function renderHighlights() {
  if (!highlightsWrapper || !highlightsListEl) return;
  const session = getActiveSession();
  highlightsListEl.innerHTML = "";

  if (!session || !Array.isArray(session.highlights) || session.highlights.length === 0) {
    highlightsWrapper.classList.add("hidden");
    return;
  }

  highlightsWrapper.classList.remove("hidden");

  session.highlights.forEach((h) => {
    const item = document.createElement("div");
    item.className = "highlight-item";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "highlight-header";
    header.innerHTML = `
      <span class="highlight-snippet">${h.snippet}</span>
      <span class="highlight-toggle">▾</span>
    `;

    const body = document.createElement("div");
    body.className = "highlight-body";
    body.innerHTML = renderTextWithLinks(h.text);

    header.addEventListener("click", () => {
      const isOpen = item.classList.toggle("open");
      if (isOpen) {
        body.style.maxHeight = body.scrollHeight + "px";
      } else {
        body.style.maxHeight = "0px";
      }
    });

    item.appendChild(header);
    item.appendChild(body);
    highlightsListEl.appendChild(item);
  });
}

if (clearHighlightsBtn) {
  clearHighlightsBtn.addEventListener("click", () => {
    const session = getActiveSession();
    if (!session || !Array.isArray(session.highlights) || !session.highlights.length) return;
    if (!confirm("למחוק את כל נקודות המפתח בשיחה הזו?")) return;
    session.highlights = [];
    saveSessions();
    renderHighlights();

    // לעדכן את הכוכבים על ההודעות
    const starBtns = messages.querySelectorAll(".highlight-star-btn");
    starBtns.forEach((btn) => {
      btn.classList.remove("active");
      btn.textContent = "☆";
    });
  });
}

/**
 * init
 */
window.addEventListener("DOMContentLoaded", () => {
  setViewportHeight();
  loadSessions();
  renderSessionList();
  renderMessagesForSession(getActiveSession(), { scroll: false });
  renderPromptExamples();
  setupModeToggle();
  setupWorkModes();
  renderHighlights();
});

/**
 * שליחת טופס
 */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = textarea ? textarea.value.trim() : "";
    if (!raw) return;

    appendMessage(raw, "user");

    const metaParts = [];
    if (currentWorkMode) {
      metaParts.push(`WORK_MODE=${currentWorkMode}`);
    }
    if (assetTypeSelect && assetTypeSelect.value) {
      metaParts.push(`ASSET_TYPE=${assetTypeSelect.value}`);
    }

    const metaPrefix = metaParts.length ? "[" + metaParts.join("; ") + "] " : "";

    const queryForApi =
      currentMode === "deep"
        ? metaPrefix + "DEEP_DIVE: " + raw
        : metaPrefix + raw;

    if (textarea) {
      textarea.value = "";
      autoResizeTextarea(textarea);
      textarea.focus();
    }

    if (sendBtn) sendBtn.disabled = true;
    const thinking = appendThinking();

    try {
      const ans = await callApi(queryForApi);
      thinking.remove();

      const safeAnswer = ans || "לא התקבלה תשובה מהשרת.";
      appendMessage(safeAnswer, "assistant");
    } catch (err) {
      thinking.remove();
      appendMessage(
        "שגיאה בתקשורת עם השרת: " + (err.message || "שגיאה לא ידועה."),
        "assistant"
      );
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });
}
