import { api } from "./api";

// Persistent session id per browser tab (localStorage = persistent across reloads)
function getSessionId() {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("rl_session_id");
  if (!sid) {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("rl_session_id", sid);
  }
  return sid;
}

/**
 * Fire-and-forget tracking event.
 * kind: "impression" | "call" | "whatsapp" | "directions" | "visit" | "tickets"
 * entityType: "advertiser" | "event"
 */
export function track(kind, entityType, entityId) {
  if (!entityId) return;
  try {
    api.post("/track", {
      kind,
      entity_type: entityType,
      entity_id: entityId,
      session_id: getSessionId(),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
