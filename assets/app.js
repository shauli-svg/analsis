// =========================
// הגדרות כלליות
// =========================
const API_URL = "/chat"; // אם שינית נתיב בשרת – לעדכן כאן

// מצב גלובלי
let sessions = {};
let currentSessionId = null;
let currentWorkMode = "stock"; // stock / bond / sector
let deepMode = false;

// DOM refs
const landingOverlay = document.getElementById("landing-overlay");
const landingCta = document.getElementById("landing-cta");

const menuBtn = document.getElementById("menu-btn");
const menuDropdown = document.getElementById("menu-dropdown");
const homeLink = document.getElementById("home-link");
const chatLink = document.getElementById("chat-link");

const sidebar = document.querySelector(".sidebar");
const sessionListEl = document.getElementById("session-list");
const sidebarNewBtn = document.getElementById("sidebar-new-btn");
const topNewBtn = document.getElementById("new-btn");

const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const queryInput = document.getElementById("query");
const sendBtn = document.getElementById("send-btn");

const workModeButtons = document.querySelectorAll(".work-mode-option");
const deepModeBtn = document.getElementById("deep-mode-btn");
const assetTypeSelect = document.getElementById("asset-type");

const examplesContainer = document.getElementById("promptExamplesContainer");

const highlightsWrapper = document.getElementById("highlights-wrapper");
const highlightsListEl = document.getElementById("highlights-list");
const highlightsClearBtn = document.getElementById("clear-highlights-btn");

const shareBtn = document.getElementById("share-btn");
const printBtn = document.getElementById("print-btn");

// highlight-detail (אופציונלי – משאיר קיים)
const highlightDetail = document.getElementById("highlight-detail");
const highlightDetailClose = document.getElementById("highlight-detail-close");
const highlightDetailContent = document.getElementById("highlight-detail-content");

// =========================
// עזרה – אחסון מקומי
// =========================
function loadSessions() {
  try {
    const raw = localStorage.getItem("draffiq_sessions_v1");
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error("loadSessions error", e);
    return {};
  }
}

function saveSessions() {
  try {
    localStorage.setItem("draffiq_sessions_v1", JSON.stringify(sessions));
  } catch (e) {
    console.error("saveSessions error", e);
  }
}

function getCurrentSession() {
  if (!currentSessionId || !sessions[currentSessionId]) return null;
  return sessions[currentSessionId];
}

// =========================
// יצירת שיחה חדשה
// =========================
function createNewSession() {
  const id = "s_" + Date.now();
  const session = {
    id,
    title: "שיחה חדשה",
    createdAt: Date.now(),
    messages: [],
    highlights: []
  };
  sessions[id] = session;
  currentSessionId = id;
  saveSessions();
  renderSessionList();
  // לא מוחק את ההודעות המערכתיות הראשונות – הן כבר ב-HTML
  // מוחק רק הודעות משתמש/סוכן קיימות
  resetConversationView();
}

function resetConversationView() {
  const rows = messagesContainer.querySelectorAll(".message-row");
  rows.forEach((row) => row.remove());

  // לשמור את בלוקי system שכבר קיימים ב-HTML
  // שום פעולה על .message.system

  clearHighlightsUI();
}

// =========================
// רינדור צד שמאל – רשימת שיחות
// =========================
function renderSessionList() {
  if (!sessionListEl) return;
  sessionListEl.innerHTML = "";

  const arr = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);
  arr.forEach((session) => {
    const wrapper = document.createElement("div");
    wrapper.className = "session-item-wrapper";
    if (session.id === currentSessionId) {
      wrapper.classList.add("active");
    }

    const mainBtn = document.createElement("button");
    mainBtn.className = "session-item-main";
    mainBtn.textContent = session.title || "שיחה ללא כותרת";
    mainBtn.addEventListener("click", () => {
      switchSession(session.id);
    });

    const menuBtn = document.createElement("button");
    menuBtn.className = "session-item-menu-btn";
    menuBtn.innerHTML = "⋯";

    const menu = document.createElement("div");
    menu.className = "session-item-menu";

    const renameItem = document.createElement("button");
    renameItem.className = "session-item-menu-item";
    renameItem.textContent = "שינוי שם";
    renameItem.addEventListener("click", () => {
      const newTitle = prompt("שם חדש לשיחה:", session.title || "");
      if (newTitle && newTitle.trim()) {
        session.title = newTitle.trim();
        saveSessions();
        renderSessionList();
      }
      menu.classList.remove("open");
    });

    const deleteItem = document.createElement("button");
    deleteItem.className = "session-item-menu-item";
    deleteItem.textContent = "מחיקה";
    deleteItem.addEventListener("click", () => {
      if (confirm("למחוק את השיחה הזאת?")) {
        delete sessions[session.id];
        if (currentSessionId === session.id) {
          currentSessionId = null;
          if (Object.keys(sessions).length === 0) {
            createNewSession();
          } else {
            currentSessionId = Object.keys(sessions)[0];
          }
        }
        saveSessions();
        renderSessionList();
        loadSessionToView();
      }
      menu.classList.remove("open");
    });

    menu.appendChild(renameItem);
    menu.appendChild(deleteItem);

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const allMenus = document.querySelectorAll(".session-item-menu.open");
      allMenus.forEach((m) => {
        if (m !== menu) m.classList.remove("open");
      });
      menu.classList.toggle("open");
    });

    wrapper.appendChild(mainBtn);
    wrapper.appendChild(menuBtn);
    wrapper.appendChild(menu);
    sessionListEl.appendChild(wrapper);
  });
}

function switchSession(id) {
  if (!sessions[id]) return;
  currentSessionId = id;
  loadSessionToView();
  renderSessionList();
}

function loadSessionToView() {
  resetConversationView();
  const session = getCurrentSession();
  if (!session) return;

  session.messages.forEach((m) => {
    if (m.role === "user") {
      renderUserMessage(m.content, false);
    } else if (m.role === "assistant") {
      renderAssistantMessage(m.content, false, m.id);
    }
  });

  // highlights
  clearHighlightsUI();
  if (session.highlights && session.highlights.length) {
    highlightsWrapper.classList.remove("hidden");
    session.highlights.forEach((h) => {
      addHighlightToUI(h);
    });
  }
}

// =========================
// הודעות לצ'אט
// =========================
function renderUserMessage(text, scroll = true) {
  const row = document.createElement("div");
  row.className = "message-row user";

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  bubble.textContent = text;

  row.appendChild(bubble);
  messagesContainer.appendChild(row);

  if (scroll) {
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }
}

function renderAssistantThinking() {
  const row = document.createElement("div");
  row.className = "message-row assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-content";

  const dots = document.createElement("span");
  dots.className = "thinking-dots";
  dots.innerHTML =
    '<span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span>';

  bubble.appendChild(dots);
  row.appendChild(bubble);
  messagesContainer.appendChild(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
  return row;
}

function renderAssistantMessage(text, scroll = true, existingId = null) {
  const row = document.createElement("div");
  row.className = "message-row assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-content";

  const safeText = typeof text === "string" ? text : JSON.stringify(text, null, 2);
  bubble.textContent = safeText;

  const starBtn = document.createElement("button");
  starBtn.className = "highlight-star-btn";
  starBtn.type = "button";
  starBtn.innerHTML = "★";

  const messageId = existingId || "m_" + Date.now();
  bubble.dataset.messageId = messageId;

  starBtn.addEventListener("click", () => {
    toggleHighlightForMessage(messageId, safeText, starBtn);
  });

  bubble.appendChild(starBtn);
  row.appendChild(bubble);
  messagesContainer.appendChild(row);

  if (scroll) {
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  return { row, bubble, messageId };
}

// =========================
// Highlights – קוביות סיכום
// =========================
function toggleHighlightForMessage(messageId, fullText, starBtn) {
  const session = getCurrentSession();
  if (!session) return;

  if (!session.highlights) session.highlights = [];
  const existingIdx = session.highlights.findIndex((h) => h.messageId === messageId);

  if (existingIdx >= 0) {
    // קיים – למחוק
    session.highlights.splice(existingIdx, 1);
    saveSessions();
    starBtn.classList.remove("active");
    rebuildHighlightsUI(session.highlights);
    return;
  }

  const snippet = fullText.length > 90 ? fullText.slice(0, 90) + "…" : fullText;
  const highlight = {
    id: "h_" + Date.now(),
    messageId,
    snippet,
    fullText
  };

  session.highlights.push(highlight);
  saveSessions();
  starBtn.classList.add("active");
  addHighlightToUI(highlight);
}

function addHighlightToUI(highlight) {
  highlightsWrapper.classList.remove("hidden");

  const item = document.createElement("div");
  item.className = "highlight-item";
  item.dataset.highlightId = highlight.id;

  const headerBtn = document.createElement("button");
  headerBtn.className = "highlight-header";

  const snippetSpan = document.createElement("span");
  snippetSpan.className = "highlight-snippet";
  snippetSpan.textContent = highlight.snippet;

  const toggleSpan = document.createElement("span");
  toggleSpan.className = "highlight-toggle";
  toggleSpan.textContent = "+";

  headerBtn.appendChild(snippetSpan);
  headerBtn.appendChild(toggleSpan);

  const body = document.createElement("div");
  body.className = "highlight-body";
  body.textContent = highlight.fullText;

  headerBtn.addEventListener("click", () => {
    const isOpen = item.classList.toggle("open");
    toggleSpan.textContent = isOpen ? "–" : "+";
  });

  item.addEventListener("dblclick", () => {
    // אופציונלי – תצוגת פירוט בצד
    if (!highlightDetail || !highlightDetailContent) return;
    highlightDetailContent.textContent = highlight.fullText;
    highlightDetail.classList.remove("hidden");
  });

  item.appendChild(headerBtn);
  item.appendChild(body);
  highlightsListEl.appendChild(item);
}

function clearHighlightsUI() {
  if (!highlightsWrapper) return;
  highlightsListEl.innerHTML = "";
  highlightsWrapper.classList.add("hidden");
  if (highlightDetail) highlightDetail.classList.add("hidden");
}

function rebuildHighlightsUI(list) {
  clearHighlightsUI();
  if (!list || !list.length) return;
  highlightsWrapper.classList.remove("hidden");
  list.forEach((h) => addHighlightToUI(h));
}

// =========================
// שליחת שאלה לשרת
// =========================
async function handleSubmit(event) {
  event.preventDefault();
  const text = queryInput.value.trim();
  if (!text) return;

  const session = getCurrentSession();
  if (!session) createNewSession();

  renderUserMessage(text);

  // כותרת לשיחה אם עדיין "שיחה חדשה"
  if (session && (!session.title || session.title === "שיחה חדשה")) {
    session.title = text.slice(0, 40);
    saveSessions();
    renderSessionList();
  }

  // לשמור הודעת משתמש למבנה השיחה
  const s = getCurrentSession();
  if (s) {
    s.messages.push({ role: "user", content: text });
    saveSessions();
  }

  queryInput.value = "";
  queryInput.style.height = "20px";

  sendBtn.disabled = true;
  const thinkingRow = renderAssistantThinking();

  try {
    const payload = {
      query: text,
      work_mode: currentWorkMode,
      deep: deepMode,
      asset_type: assetTypeSelect ? assetTypeSelect.value || null : null,
      session_id: currentSessionId
    };

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error("שגיאה מהשרת: " + resp.status);
    }

    let data;
    try {
      data = await resp.json();
    } catch (e) {
      // אם זה לא JSON – נקרא כטקסט
      const txt = await resp.text();
      data = { answer: txt };
    }

    const answer =
      data.answer || data.response || data.message || "לא התקבלה תשובה מהשרת.";

    thinkingRow.remove();
    const { messageId } = renderAssistantMessage(answer);

    const cur = getCurrentSession();
    if (cur) {
      cur.messages.push({ id: messageId, role: "assistant", content: answer });
      saveSessions();
    }

    // אם השרת מחזיר גם highlights מובנים
    if (Array.isArray(data.highlights)) {
      const curSession = getCurrentSession();
      if (curSession) {
        curSession.highlights = data.highlights.map((h) => ({
          id: h.id || "h_" + Date.now(),
          messageId: h.messageId || messageId,
          snippet: h.snippet || (h.text ? h.text.slice(0, 90) + "…" : ""),
          fullText: h.fullText || h.text || ""
        }));
        saveSessions();
        rebuildHighlightsUI(curSession.highlights);
      }
    }
  } catch (err) {
    console.error(err);
    thinkingRow.remove();
    renderAssistantMessage("הייתה תקלה בחיבור לשרת. נסה שוב מאוחר יותר.", true);

  } finally {
    sendBtn.disabled = false;
  }
}

// =========================
// אינטראקציות UI – מצבים, כפתורים, לנדינג
// =========================
function initWorkModes() {
  workModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      workModeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentWorkMode = btn.dataset.mode || "stock";
    });
  });
}

function initDeepMode() {
  if (!deepModeBtn) return;
  deepModeBtn.addEventListener("click", () => {
    deepMode = !deepMode;
    deepModeBtn.classList.toggle("active", deepMode);
  });
}

function initLandingOverlay() {
  if (!landingOverlay || !landingCta) return;

  const seen = localStorage.getItem("draffiq_landing_seen");
  if (seen === "1") {
    landingOverlay.classList.add("hidden");
    return;
  }

  landingCta.addEventListener("click", () => {
    landingOverlay.classList.add("hidden");
    localStorage.setItem("draffiq_landing_seen", "1");
  });
}

function initMenu() {
  if (!menuBtn || !menuDropdown) return;

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    menuDropdown.classList.remove("open");
  });

  if (homeLink) {
    homeLink.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      menuDropdown.classList.remove("open");
    });
  }

  if (chatLink) {
    chatLink.addEventListener("click", () => {
      if (messagesContainer) {
        messagesContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      menuDropdown.classList.remove("open");
    });
  }
}

function initNewChatButtons() {
  if (topNewBtn) {
    topNewBtn.addEventListener("click", () => {
      createNewSession();
    });
  }
  if (sidebarNewBtn) {
    sidebarNewBtn.addEventListener("click", () => {
      createNewSession();
    });
  }
}

// כפתורי highlights
function initHighlightsControls() {
  if (highlightsClearBtn) {
    highlightsClearBtn.addEventListener("click", () => {
      const session = getCurrentSession();
      if (!session) return;
      session.highlights = [];
      saveSessions();
      clearHighlightsUI();
    });
  }

  if (highlightDetailClose && highlightDetail) {
    highlightDetailClose.addEventListener("click", () => {
      highlightDetail.classList.add("hidden");
    });
  }
}

// כפתורי שיתוף / PDF
function initShareAndPrint() {
  if (shareBtn && navigator.share) {
    shareBtn.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: "DRAFFIQ AI – TASE Chat",
          url: window.location.href
        });
      } catch (_) {}
    });
  } else if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => alert("קישור הועתק ללוח."));
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }
}

// דוגמאות לשאלות
function initExamples() {
  if (!examplesContainer) return;
  const examples = [
    "נתח עבורי את מניית POLI – סיכונים, הזדמנויות והערכת שווי גסה.",
    "מה מצב המינוף והתזרים של בנק הפועלים מול בנק לאומי?",
    "אני מחזיק קרן אג\"ח ממשלתית ארוכת טווח – אילו סיכוני ריבית עליי לקחת בחשבון?",
    "סכם לי את מצב הסקטור הסולארי בישראל ובארה\"ב, כולל הזדמנויות בולטות.",
    "בדוק אם יש סימני אזהרה בדוחות האחרונים של חברה בולטת במדד ת\"א 125."
  ];

  examples.forEach((ex) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "example-chip";
    chip.textContent = ex;
    chip.addEventListener("click", () => {
      queryInput.value = ex;
      queryInput.focus();
    });
    examplesContainer.appendChild(chip);
  });
}

// התאמת גובה textarea בזמן כתיבה
function initAutoResizeTextarea() {
  if (!queryInput) return;
  const resize = () => {
    queryInput.style.height = "20px";
    queryInput.style.height = queryInput.scrollHeight + "px";
  };
  queryInput.addEventListener("input", resize);
}

// =========================
// init ראשי
// =========================
document.addEventListener("DOMContentLoaded", () => {
  // לטעון שיחות קודמות
  sessions = loadSessions();
  if (!Object.keys(sessions).length) {
    createNewSession();
  } else {
    // לבחור אחרונה
    const latest = Object.values(sessions).sort(
      (a, b) => b.createdAt - a.createdAt
    )[0];
    currentSessionId = latest.id;
    renderSessionList();
    loadSessionToView();
  }

  initLandingOverlay();
  initMenu();
  initNewChatButtons();
  initWorkModes();
  initDeepMode();
  initHighlightsControls();
  initShareAndPrint();
  initExamples();
  initAutoResizeTextarea();

  if (chatForm) {
    chatForm.addEventListener("submit", handleSubmit);
  }
});
