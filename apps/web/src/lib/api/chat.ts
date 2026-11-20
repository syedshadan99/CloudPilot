/**
 * Typed HTTP client for the CloudPilot chat API.
 * Base URL is read from VITE_API_URL env var or defaults to http://localhost:3000.
 */

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:3000") + "/api/v1";

export interface ChatSession {
  id: string;
  customer_id: string;
  state: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface VmRequirements {
  id: string;
  session_id: string;
  cpu_cores: number | null;
  ram_gb: number | null;
  storage_gb: number | null;
  os: string | null;
  duration_days: number | null;
  billing_cycle: "hourly" | "daily" | "monthly" | null;
  use_case: string | null;
  notes: string | null;
  source: "ai" | "manual";
  updated_at: string;
}

export interface SessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
  requirements: VmRequirements | null;
}

export interface SendMessageResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  requirements: VmRequirements | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body["message"] as string) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const chatApi = {
  createSession: (customerId: string, title?: string) =>
    request<ChatSession>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ customerId, title }),
    }),

  listSessions: (customerId: string) =>
    request<ChatSession[]>(`/chat/sessions?customerId=${encodeURIComponent(customerId)}`),

  getSession: (id: string) =>
    request<SessionDetail>(`/chat/sessions/${id}`),

  sendMessage: (sessionId: string, content: string) =>
    request<SendMessageResult>(`/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  getRequirements: (sessionId: string) =>
    request<VmRequirements | null>(`/chat/sessions/${sessionId}/requirements`),

  updateRequirements: (sessionId: string, data: Partial<VmRequirements>) =>
    request<VmRequirements>(`/chat/sessions/${sessionId}/requirements`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
