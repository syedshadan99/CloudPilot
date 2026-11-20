import { useEffect, useRef, useState } from "react";
import { chatApi, type ChatMessage, type VmRequirements, type SessionDetail } from "../../lib/api/chat.js";
import { ManualFallbackForm } from "./ManualFallbackForm.js";
import styles from "./chat.module.css";

interface ChatWorkspaceProps {
  sessionId: string;
  onBack: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RequirementsPanel({
  requirements,
  onEdit,
}: {
  requirements: VmRequirements | null;
  onEdit: () => void;
}) {
  const rows: { label: string; value: string | null }[] = [
    { label: "CPU Cores", value: requirements?.cpu_cores?.toString() ?? null },
    { label: "RAM", value: requirements?.ram_gb ? `${requirements.ram_gb} GB` : null },
    { label: "Storage", value: requirements?.storage_gb ? `${requirements.storage_gb} GB` : null },
    { label: "OS", value: requirements?.os ?? null },
    { label: "Duration", value: requirements?.duration_days ? `${requirements.duration_days} days` : null },
    { label: "Billing", value: requirements?.billing_cycle ?? null },
    { label: "Use Case", value: requirements?.use_case ?? null },
  ];

  return (
    <aside className={styles.requirementsPanel} aria-label="Extracted VM requirements">
      <p className={styles.requirementsPanelTitle}>VM Requirements</p>

      {requirements ? (
        <>
          <span
            className={`${styles.sourceBadge} ${
              requirements.source === "ai" ? styles.sourceBadgeAi : styles.sourceBadgeManual
            }`}
          >
            {requirements.source === "ai" ? "AI extracted" : "Manual"}
          </span>

          {rows.map(({ label, value }) => (
            <div key={label} className={styles.requirementItem}>
              <span className={styles.requirementLabel}>{label}</span>
              {value ? (
                <span className={styles.requirementValue}>{value}</span>
              ) : (
                <span className={styles.requirementEmpty}>—</span>
              )}
            </div>
          ))}

          {requirements.notes && (
            <div className={styles.requirementItem} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <span className={styles.requirementLabel}>Notes</span>
              <span className={styles.requirementValue}>{requirements.notes}</span>
            </div>
          )}
        </>
      ) : (
        <p className={styles.requirementEmpty} style={{ fontSize: "0.875rem" }}>
          Chat with the assistant to extract VM requirements, or fill the form manually.
        </p>
      )}

      <button className={styles.editReqBtn} onClick={onEdit} type="button">
        {requirements ? "Edit requirements" : "Enter requirements manually"}
      </button>
    </aside>
  );
}

export function ChatWorkspace({ sessionId, onBack }: ChatWorkspaceProps) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showForm, setShowForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setLoading(true);
    chatApi
      .getSession(sessionId)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [detail?.messages]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || sending) return;

    setInputValue("");
    setSending(true);

    // Optimistically add user message
    const tempUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setDetail((d) => d ? { ...d, messages: [...d.messages, tempUser] } : d);

    try {
      const result = await chatApi.sendMessage(sessionId, content);
      setDetail((d) => {
        if (!d) return d;
        const withoutTemp = d.messages.filter((m) => m.id !== tempUser.id);
        return {
          ...d,
          messages: [...withoutTemp, result.userMessage, result.assistantMessage],
          requirements: result.requirements ?? d.requirements,
        };
      });
    } catch (e) {
      setDetail((d) => {
        if (!d) return d;
        // Keep user message but mark failure
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          session_id: sessionId,
          role: "assistant",
          content: "⚠️ Failed to send message. Please try again or use the manual form.",
          created_at: new Date().toISOString(),
        };
        return { ...d, messages: [...d.messages, errorMsg] };
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveRequirements = async (data: Partial<VmRequirements>) => {
    const updated = await chatApi.updateRequirements(sessionId, data);
    setDetail((d) => d ? { ...d, requirements: updated } : d);
    setShowForm(false);
  };

  const title = detail?.session.title ?? "Chat Session";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back to sessions">
          ←
        </button>
        <h1 className={styles.headerTitle}>{title}</h1>
      </header>

      {loading && (
        <div className={styles.messages} style={{ justifyContent: "center", alignItems: "center" }}>
          <p className={styles.requirementEmpty}>Loading…</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.messages}>
          <div className={`${styles.inlineAlert} ${styles.inlineAlertError}`} role="alert">
            {error}
          </div>
        </div>
      )}

      {!loading && !error && detail && (
        <>
          {showForm ? (
            <div className={styles.sessionList}>
              <h2 className={styles.requirementsPanelTitle} style={{ color: "var(--color-text)", fontSize: "1rem", textTransform: "none" }}>
                Enter VM Requirements
              </h2>
              <ManualFallbackForm
                sessionId={sessionId}
                initial={detail.requirements}
                onSave={handleSaveRequirements}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : (
            <div className={styles.workspace}>
              <div className={styles.chatPanel}>
                <div className={styles.messages} role="log" aria-live="polite" aria-label="Chat messages">
                  {detail.messages.length === 0 && (
                    <p className={styles.requirementEmpty} style={{ alignSelf: "center" }}>
                      Start by describing the VM you need.
                    </p>
                  )}

                  {detail.messages.map((msg) => (
                    <div key={msg.id}>
                      <div
                        className={`${styles.bubble} ${
                          msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div className={styles.bubbleTime}>{formatTime(msg.created_at)}</div>
                    </div>
                  ))}

                  {sending && (
                    <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                      <div className={styles.typing} aria-label="Assistant is typing">
                        <div className={styles.typingDot} />
                        <div className={styles.typingDot} />
                        <div className={styles.typingDot} />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                <div className={styles.inputBar}>
                  <textarea
                    ref={textareaRef}
                    className={styles.messageInput}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe the VM you need… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    disabled={sending}
                    aria-label="Message input"
                    maxLength={8000}
                  />
                  <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={sending || !inputValue.trim()}
                    aria-label="Send message"
                    type="button"
                  >
                    Send
                  </button>
                </div>
              </div>

              <RequirementsPanel
                requirements={detail.requirements}
                onEdit={() => setShowForm(true)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
