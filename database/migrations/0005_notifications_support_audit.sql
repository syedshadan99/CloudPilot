-- 0005_notifications_support_audit.sql
-- In-app notifications, customer support tickets & threads, and immutable audit logging.

-- ── 1. Notifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER',
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ── 2. Support Tickets ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(64) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  assigned_to VARCHAR(64),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);

-- Support ticket messages (conversation thread)
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) NOT NULL,
  sender_role VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at ASC);

-- ── 3. Audit Logs (Immutable) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(16) NOT NULL DEFAULT 'CUSTOMER',
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Database-level immutability rules: prevent UPDATE and DELETE
CREATE OR REPLACE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
