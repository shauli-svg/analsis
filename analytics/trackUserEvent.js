// analytics/trackUserEvent.js
import { query } from "../db.js";

/**
 * רושם אירוע אנליטי לטבלת user_events
 */
export async function trackUserEvent({
  userId = null,
  name,
  context = {},
  sessionId = null,
  source = "web",
}) {
  if (!name) {
    throw new Error("trackUserEvent: name is required");
  }

  await query(
    `
      INSERT INTO user_events (user_id, event_name, context, session_id, source)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, name, context, sessionId, source]
  );
}

