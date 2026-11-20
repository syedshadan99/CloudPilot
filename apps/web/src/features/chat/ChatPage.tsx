import { useEffect, useState } from "react";
import { chatApi, type ChatSession } from "../../lib/api/chat.js";
import { ChatWorkspace } from "./ChatWorkspace.js";
import styles from "./chat.module.css";

// Demo customer ID — will be replaced by real auth session in CP-03
const DEMO_CUSTOMER_ID = "00000000-0000-0000-0000-000000000001";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { dateStyle: "medium" });
}

export function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadSessions = () => {
    setLoading(true);
    chatApi
      .listSessions(DEMO_CUSTOMER_ID)
      .then((s) => {
        setSessions(s);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleNewSession = async () => {
    setCreating(true);
    try {
      const session = await chatApi.createSession(DEMO_CUSTOMER_ID, `Chat ${new Date().toLocaleString()}`);
      setActiveSessionId(session.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (activeSessionId) {
    return (
      <ChatWorkspace
        sessionId={activeSessionId}
        onBack={() => {
          setActiveSessionId(null);
          loadSessions();
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>AI Requirements Chat</h1>
      </header>

      <div className={styles.sessionList}>
        <button
          className={styles.newSessionBtn}
          onClick={handleNewSession}
          disabled={creating}
          type="button"
        >
          {creating ? "Starting…" : "+ New Chat"}
        </button>

        {error && (
          <div className={`${styles.inlineAlert} ${styles.inlineAlertError}`} role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p className={styles.requirementEmpty}>Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <div className={styles.emptyState}>
            <p className="type-title-medium">No chats yet</p>
            <p className="type-body-medium">
              Start a new chat to describe your VM requirements to the AI assistant.
            </p>
          </div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              className={styles.sessionCard}
              onClick={() => setActiveSessionId(s.id)}
              type="button"
            >
              <p className={styles.sessionTitle}>{s.title ?? "Untitled session"}</p>
              <p className={styles.sessionMeta}>
                {s.state.replace(/_/g, " ")} · {formatDate(s.created_at)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
