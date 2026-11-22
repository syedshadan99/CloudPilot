-- Deterministic, synthetic demo data for local development and semester demos.
-- The password hash is generated from a non-production demo phrase with
-- pgcrypto; this file must never be used as a production bootstrap.

INSERT INTO users (
  id, full_name, email, normalized_email, password_hash, role, status,
  email_verified_at, terms_accepted_at
) VALUES
  ('20000000-0000-0000-0000-000000000001', 'CloudPilot Demo Customer', 'customer.demo@cloudpilot.invalid', 'customer.demo@cloudpilot.invalid', crypt('cloudpilot-demo-only', '$2a$10$abcdefghijklmnopqrstuu'), 'customer', 'active', '2026-01-01T09:00:00Z', '2026-01-01T08:55:00Z'),
  ('20000000-0000-0000-0000-000000000002', 'CloudPilot Demo Provider', 'provider.demo@cloudpilot.invalid', 'provider.demo@cloudpilot.invalid', crypt('cloudpilot-demo-only', '$2a$10$abcdefghijklmnopqrstuu'), 'provider_admin', 'active', '2026-01-01T09:00:00Z', '2026-01-01T08:55:00Z'),
  ('20000000-0000-0000-0000-000000000003', 'CloudPilot Demo Support', 'support.demo@cloudpilot.invalid', 'support.demo@cloudpilot.invalid', crypt('cloudpilot-demo-only', '$2a$10$abcdefghijklmnopqrstuu'), 'provider_staff', 'active', '2026-01-01T09:00:00Z', '2026-01-01T08:55:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, owner_id, status)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'CloudPilot Demo Provider Organization', '20000000-0000-0000-0000-000000000002', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'CloudPilot Demo Customer Organization', '20000000-0000-0000-0000-000000000001', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, member_role)
VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'member'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'owner')
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO customer_profiles (user_id, organization_id, company_name, workload_type, preferred_currency, billing_email)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Demo Web Studio', 'web hosting', 'USD', 'customer.demo@cloudpilot.invalid')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO onboarding_progress (user_id, current_step, status, responses, completed_at)
VALUES (
  '20000000-0000-0000-0000-000000000001', 'complete', 'completed',
  '{"workload":"web hosting","duration_days":30,"billing_cycle":"monthly","technical_level":"intermediate"}'::jsonb,
  '2026-01-02T10:00:00Z'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO billing_accounts (id, customer_id, balance, currency, status)
VALUES ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 0, 'USD', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO capacity_pools (
  id, organization_id, name, region, total_cpu_cores, total_ram_gb, total_storage_gb, available, created_by
)
VALUES ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Demo Simulated Pool', 'simulated-1', 128, 512, 10000, true, '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_versions (
  id, organization_id, version_name, currency, effective_from, status, created_by
)
VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Demo pricing 2026-01', 'USD', '2026-01-01T00:00:00Z', 'active', '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vm_templates (
  id, organization_id, name, slug, description, cpu_cores, ram_gb, storage_gb,
  storage_type, operating_system, bandwidth_mbps, region, availability, active,
  current_pricing_version_id, created_by, capacity_pool_id
)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Nano', 'nano', 'Synthetic starter configuration', 1, 1, 25, 'ssd', 'Ubuntu 24.04 LTS', 100, 'simulated-1', 'available', true, '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Starter', 'starter', 'Synthetic small web workload configuration', 2, 4, 50, 'ssd', 'Ubuntu 24.04 LTS', 250, 'simulated-1', 'available', true, '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Growth', 'growth', 'Synthetic application workload configuration', 4, 8, 100, 'nvme', 'Ubuntu 24.04 LTS', 500, 'simulated-1', 'available', true, '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Performance', 'performance', 'Synthetic high-throughput configuration', 8, 16, 250, 'nvme', 'Ubuntu 24.04 LTS', 1000, 'simulated-1', 'available', true, '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pricing_rules (
  id, pricing_version_id, vm_template_id, rule_type, hourly_rate, daily_rate, monthly_rate, minimum_price, maximum_discount_percent
)
VALUES
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'template_base', 0.05, 1.20, 20.00, 16.00, 10.00),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'template_base', 0.12, 2.88, 48.00, 40.00, 10.00),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 'template_base', 0.24, 5.76, 96.00, 80.00, 8.00),
  ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'template_base', 0.48, 11.52, 192.00, 160.00, 6.00)
ON CONFLICT DO NOTHING;

INSERT INTO negotiation_policies (
  id, organization_id, name, maximum_discount_percent, minimum_price, approval_threshold,
  maximum_attempts, effective_from, active, created_by
)
VALUES ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Demo standard negotiation', 10.00, 40.00, 42.00, 3, '2026-01-01T00:00:00Z', true, '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_sessions (id, customer_id, state, title, session_type, created_at, updated_at)
VALUES
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ACTIVE', 'Starter web application', 'negotiation', '2026-01-02T10:05:00Z', '2026-01-02T10:20:00Z'),
  ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'OFFER_READY', 'Provider review example', 'negotiation', '2026-01-03T10:05:00Z', '2026-01-03T10:20:00Z'),
  ('80000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'PROVISIONING', 'Provisioning failure example', 'negotiation', '2026-01-04T10:05:00Z', '2026-01-04T10:20:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, session_id, role, content, created_at)
VALUES
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'user', 'I need a Linux server for a small web application for 30 days.', '2026-01-02T10:06:00Z'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'assistant', 'The Starter template is a suitable synthetic recommendation. I can prepare a policy-checked offer.', '2026-01-02T10:07:00Z'),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', 'user', 'Please apply the available demo discount.', '2026-01-02T10:08:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vm_requirements (id, session_id, cpu_cores, ram_gb, storage_gb, os, duration_days, billing_cycle, use_case, source)
VALUES ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 2, 4, 50, 'Ubuntu 24.04 LTS', 30, 'monthly', 'small web application', 'ai')
ON CONFLICT (id) DO NOTHING;

INSERT INTO offers (
  id, customer_id, organization_id, chat_session_id, pricing_version_id, negotiation_policy_id,
  vm_template_id, vm_configuration, base_price, discount_percent, discount_amount, final_price,
  currency, billing_cycle, rental_duration_days, status, presented_at, expires_at, accepted_at, created_by
)
VALUES
  ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 8.3333, 4.0000, 44.0000, 'USD', 'monthly', 30, 'accepted', '2026-01-02T10:15:00Z', '2026-01-03T10:15:00Z', '2026-01-02T10:20:00Z', '20000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '{"template":"growth","cpu_cores":4,"ram_gb":8,"storage_gb":100,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 96.0000, 0.0000, 0.0000, 96.0000, 'USD', 'monthly', 30, 'pending_provider_review', '2026-01-03T10:15:00Z', '2026-01-04T10:15:00Z', NULL, '20000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 0.0000, 0.0000, 48.0000, 'USD', 'monthly', 30, 'accepted', '2026-01-04T10:15:00Z', '2026-01-05T10:15:00Z', '2026-01-04T10:20:00Z', '20000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 0.0000, 0.0000, 48.0000, 'USD', 'monthly', 30, 'accepted', '2026-01-04T10:15:00Z', '2026-01-05T10:15:00Z', '2026-01-04T10:20:00Z', '20000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 0.0000, 0.0000, 48.0000, 'USD', 'monthly', 30, 'accepted', '2026-01-04T10:15:00Z', '2026-01-05T10:15:00Z', '2026-01-04T10:20:00Z', '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

UPDATE chat_sessions SET active_offer_id = '90000000-0000-0000-0000-000000000001' WHERE id = '80000000-0000-0000-0000-000000000001';

INSERT INTO offer_events (id, offer_id, actor_id, from_status, to_status, event_type, reason, created_at)
VALUES
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'presented', 'accepted', 'customer_confirmation', 'Synthetic demo acceptance', '2026-01-02T10:20:00Z'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'countered', 'pending_provider_review', 'provider_review_requested', 'Synthetic review threshold example', '2026-01-03T10:20:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (
  id, customer_id, organization_id, offer_id, order_number, pricing_version_id, vm_configuration,
  base_price, discount_amount, final_price, currency, billing_cycle, rental_duration_days,
  status, accepted_at, payment_verified_at, provisioning_eligible_at, start_at, end_at
)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'CP-DEMO-0001', '30000000-0000-0000-0000-000000000001', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 4.0000, 44.0000, 'USD', 'monthly', 30, 'active', '2026-01-02T10:20:00Z', '2026-01-02T10:30:00Z', '2026-01-02T10:30:00Z', '2026-01-02T10:35:00Z', '2026-02-01T10:35:00Z'),
  ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', 'CP-DEMO-0002', '30000000-0000-0000-0000-000000000001', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 0.0000, 48.0000, 'USD', 'monthly', 30, 'active', '2026-01-04T10:20:00Z', '2026-01-04T10:30:00Z', '2026-01-04T10:30:00Z', '2026-01-04T10:35:00Z', '2026-02-01T10:35:00Z'),
  ('a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 'CP-DEMO-0003', '30000000-0000-0000-0000-000000000001', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS","region":"simulated-1"}'::jsonb, 48.0000, 0.0000, 48.0000, 'USD', 'monthly', 30, 'provisioning_failed', '2026-01-04T10:20:00Z', '2026-01-04T10:30:00Z', '2026-01-04T10:30:00Z', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_events (id, order_id, actor_id, from_status, to_status, event_type, reason, created_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pending_payment', 'payment_verified', 'payment_verified', 'Synthetic payment verification', '2026-01-02T10:30:00Z'),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL, 'payment_verified', 'provisioning', 'provisioning_started', 'Synthetic worker start', '2026-01-02T10:31:00Z'),
  ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', NULL, 'provisioning', 'provisioning_failed', 'provisioning_failed', 'Synthetic provider failure', '2026-01-04T10:40:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (
  id, invoice_number, billing_account_id, customer_id, order_id, invoice_type, currency,
  billing_period_start, billing_period_end, subtotal, discount_amount, tax_amount,
  adjustment_amount, total, amount_paid, status, issued_at, due_at, paid_at
)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'INV-DEMO-0001', 'b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'initial_order', 'USD', '2026-01-02T10:20:00Z', '2026-02-01T10:20:00Z', 48.0000, 4.0000, 0.0000, 0.0000, 44.0000, 44.0000, 'paid', '2026-01-02T10:21:00Z', '2026-01-09T10:21:00Z', '2026-01-02T10:30:00Z'),
  ('c0000000-0000-0000-0000-000000000002', 'INV-DEMO-0002', 'b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'initial_order', 'USD', '2026-01-04T10:20:00Z', '2026-02-03T10:20:00Z', 48.0000, 0.0000, 0.0000, 0.0000, 48.0000, 48.0000, 'paid', '2026-01-04T10:21:00Z', '2026-01-11T10:21:00Z', '2026-01-04T10:30:00Z'),
  ('c0000000-0000-0000-0000-000000000003', 'INV-DEMO-0003', 'b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'initial_order', 'USD', '2026-01-04T10:20:00Z', '2026-02-03T10:20:00Z', 48.0000, 0.0000, 0.0000, 0.0000, 48.0000, 48.0000, 'paid', '2026-01-04T10:21:00Z', '2026-01-11T10:21:00Z', '2026-01-04T10:30:00Z'),
  ('c0000000-0000-0000-0000-000000000004', 'INV-DEMO-USAGE-0001', 'b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', NULL, 'recurring_usage', 'USD', '2026-01-02T10:35:00Z', '2026-01-04T10:35:00Z', 2.0000, 0.0000, 0.0000, 0.0000, 2.0000, 2.0000, 'paid', '2026-01-05T10:00:00Z', '2026-01-12T10:00:00Z', '2026-01-05T10:05:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, line_number, item_type, description, quantity, unit_price, amount)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 'setup', 'Starter monthly synthetic rental', 1, 48.0000, 48.0000),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 2, 'discount', 'Policy-constrained demo discount', 1, -4.0000, -4.0000),
  ('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 1, 'setup', 'Starter monthly synthetic rental', 1, 48.0000, 48.0000),
  ('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 1, 'setup', 'Starter monthly synthetic rental', 1, 48.0000, 48.0000),
  ('c1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 1, 'compute', 'Synthetic usage interval one', 1, 1.0000, 1.0000),
  ('c1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004', 2, 'compute', 'Synthetic usage interval two', 1, 1.0000, 1.0000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_records (
  id, invoice_id, order_id, customer_id, payment_reference, amount, currency, status, submitted_at, verified_at, verified_by
)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SIM-DEMO-PAY-0001', 44.0000, 'USD', 'verified', '2026-01-02T10:29:00Z', '2026-01-02T10:30:00Z', '20000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'SIM-DEMO-PAY-0002', 48.0000, 'USD', 'verified', '2026-01-04T10:29:00Z', '2026-01-04T10:30:00Z', '20000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'SIM-DEMO-PAY-0003', 48.0000, 'USD', 'verified', '2026-01-04T10:29:00Z', '2026-01-04T10:30:00Z', '20000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', NULL, '20000000-0000-0000-0000-000000000001', 'SIM-DEMO-PAY-USAGE-0001', 2.0000, 'USD', 'verified', '2026-01-05T10:04:00Z', '2026-01-05T10:05:00Z', '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO provisioning_jobs (
  id, order_id, customer_id, status, attempt_count, max_attempts, vm_config,
  simulated_vm_id, simulated_host, simulated_ip, created_at, updated_at,
  started_at, completed_at, eligibility_verified_at
)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'READY', 1, 3, '{"cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS"}'::jsonb, 'sim-vm-demo-0001', 'sim-vm-demo-0001.sim.cloudpilot.local', '10.18.62.69', '2026-01-02T10:31:00Z', '2026-01-02T10:35:00Z', '2026-01-02T10:31:00Z', '2026-01-02T10:35:00Z', '2026-01-02T10:30:00Z'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'READY', 1, 3, '{"cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS"}'::jsonb, 'sim-vm-demo-0002', 'sim-vm-demo-0002.sim.cloudpilot.local', '10.18.62.70', '2026-01-04T10:31:00Z', '2026-01-04T10:35:00Z', '2026-01-04T10:31:00Z', '2026-01-04T10:35:00Z', '2026-01-04T10:30:00Z'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'FAILED', 3, 3, '{"cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS"}'::jsonb, NULL, NULL, NULL, '2026-01-04T10:31:00Z', '2026-01-04T10:45:00Z', '2026-01-04T10:31:00Z', '2026-01-04T10:45:00Z', '2026-01-04T10:30:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO virtual_machines (
  id, customer_id, order_id, provisioning_job_id, state, simulated_vm_id, hostname, ip_address,
  vm_config, name, cpu_cores, ram_gb, storage_gb, operating_system, region, billing_account_id,
  created_at, updated_at, started_at, access_granted_at
)
VALUES
  ('f0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'RUNNING', 'sim-vm-demo-0001', 'sim-vm-demo-0001.sim.cloudpilot.local', '10.18.62.69', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS"}'::jsonb, 'Demo running VM', 2, 4, 50, 'Ubuntu 24.04 LTS', 'simulated-1', 'b0000000-0000-0000-0000-000000000001', '2026-01-02T10:35:00Z', '2026-01-02T10:35:00Z', '2026-01-02T10:35:00Z', '2026-01-02T10:35:00Z'),
  ('f0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'STOPPED', 'sim-vm-demo-0002', 'sim-vm-demo-0002.sim.cloudpilot.local', '10.18.62.70', '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS"}'::jsonb, 'Demo stopped VM', 2, 4, 50, 'Ubuntu 24.04 LTS', 'simulated-1', 'b0000000-0000-0000-0000-000000000001', '2026-01-04T10:35:00Z', '2026-01-04T11:10:00Z', '2026-01-04T10:35:00Z', '2026-01-04T10:35:00Z'),
  ('f0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'FAILED', NULL, NULL, NULL, '{"template":"starter","cpu_cores":2,"ram_gb":4,"storage_gb":50,"operating_system":"Ubuntu 24.04 LTS"}'::jsonb, 'Demo failed VM', 2, 4, 50, 'Ubuntu 24.04 LTS', 'simulated-1', 'b0000000-0000-0000-0000-000000000001', '2026-01-04T10:35:00Z', '2026-01-04T10:45:00Z', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vm_state_events (id, vm_id, actor_id, from_state, to_state, action, note, created_at)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', NULL, 'PROVISIONING', 'RUNNING', 'PROVISION', 'Synthetic provisioning completed after payment verification', '2026-01-02T10:35:00Z'),
  ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'RUNNING', 'STOPPED', 'STOP', 'Synthetic customer stop', '2026-01-04T11:10:00Z'),
  ('f1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', NULL, 'PROVISIONING', 'FAILED', 'FAIL', 'Synthetic provider failure after bounded retries', '2026-01-04T10:45:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usage_records (
  id, vm_id, period_start, period_end, runtime_seconds, cpu_percent, ram_percent,
  disk_read_mb, disk_write_mb, net_in_mb, net_out_mb, cpu_usage, memory_usage, storage_usage, bandwidth_usage, source
)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-01-02T10:35:00Z', '2026-01-03T10:35:00Z', 86400, 42.00, 38.00, 120.00, 80.00, 250.00, 180.00, 42.00, 38.00, 50.00, 430.00, 'simulated'),
  ('10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '2026-01-03T10:35:00Z', '2026-01-04T10:35:00Z', 86400, 47.00, 41.00, 140.00, 90.00, 270.00, 210.00, 47.00, 41.00, 50.00, 480.00, 'simulated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO charge_ledger_entries (
  id, customer_id, vm_id, usage_record_id, invoice_id, idempotency_key, charge_type,
  quantity, unit_price, amount, currency, billing_period_start, billing_period_end
)
VALUES
  ('11000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'demo-usage-charge-0001', 'compute', 1, 1.0000, 1.0000, 'USD', '2026-01-02T10:35:00Z', '2026-01-03T10:35:00Z'),
  ('11000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'demo-usage-charge-0002', 'compute', 1, 1.0000, 1.0000, 'USD', '2026-01-03T10:35:00Z', '2026-01-04T10:35:00Z')
ON CONFLICT (id) DO NOTHING;

UPDATE usage_records SET charge_ledger_id = '11000000-0000-0000-0000-000000000001', invoiced_at = '2026-01-05T10:00:00Z' WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE usage_records SET charge_ledger_id = '11000000-0000-0000-0000-000000000002', invoiced_at = '2026-01-05T10:00:00Z' WHERE id = '10000000-0000-0000-0000-000000000002';

UPDATE invoice_items SET charge_ledger_id = '11000000-0000-0000-0000-000000000001' WHERE id = 'c1000000-0000-0000-0000-000000000005';
UPDATE invoice_items SET charge_ledger_id = '11000000-0000-0000-0000-000000000002' WHERE id = 'c1000000-0000-0000-0000-000000000006';

INSERT INTO capacity_reservations (id, pool_id, order_id, vm_id, status, cpu_cores, ram_gb, storage_gb, committed_at)
VALUES
  ('1a000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'committed', 2, 4, 50, '2026-01-02T10:35:00Z'),
  ('1a000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'committed', 2, 4, 50, '2026-01-04T10:35:00Z'),
  ('1a000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', NULL, 'released', 2, 4, 50, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO upgrade_requests (
  id, customer_id, vm_id, previous_configuration, requested_configuration, status,
  price_difference, currency, requested_at, approved_at, effective_at, reviewed_by
)
VALUES (
  '13000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
  '{"cpu_cores":2,"ram_gb":4,"storage_gb":50}'::jsonb, '{"cpu_cores":4,"ram_gb":8,"storage_gb":100}'::jsonb,
  'applied', 48.0000, 'USD', '2026-01-05T09:00:00Z', '2026-01-05T09:05:00Z', '2026-01-05T09:10:00Z', '20000000-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vm_configuration_history (id, vm_id, upgrade_request_id, version_number, configuration, effective_from, effective_to)
VALUES
  ('14000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', NULL, 1, '{"cpu_cores":2,"ram_gb":4,"storage_gb":50}'::jsonb, '2026-01-02T10:35:00Z', '2026-01-05T09:10:00Z'),
  ('14000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 2, '{"cpu_cores":4,"ram_gb":8,"storage_gb":100}'::jsonb, '2026-01-05T09:10:00Z', NULL),
  ('14000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002', NULL, 1, '{"cpu_cores":2,"ram_gb":4,"storage_gb":50}'::jsonb, '2026-01-04T10:35:00Z', NULL),
  ('14000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', NULL, 1, '{"cpu_cores":2,"ram_gb":4,"storage_gb":50}'::jsonb, '2026-01-04T10:35:00Z', NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE vm_configuration_history SET effective_to = '2026-01-05T09:10:00Z' WHERE id = '14000000-0000-0000-0000-000000000001';

INSERT INTO notifications (id, user_id, notification_type, title, message, related_entity_type, related_entity_id)
VALUES
  ('15000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'provisioning_ready', 'Your demo VM is ready', 'The simulated Starter VM is ready for access.', 'virtual_machine', 'f0000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'provider_review', 'Offer awaiting review', 'A synthetic Growth offer is awaiting provider review.', 'offer', '90000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO notification_deliveries (id, notification_id, channel, status, attempts, sent_at)
VALUES
  ('15100000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'in_app', 'sent', 1, '2026-01-02T10:36:00Z'),
  ('15100000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'in_app', 'sent', 1, '2026-01-03T10:21:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_tickets (
  id, customer_id, subject, description, priority, status, assigned_to, related_order_id, related_vm_id
)
VALUES ('16000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo provisioning question', 'Synthetic support ticket for the database demonstration.', 'normal', 'in_progress', '20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_messages (id, ticket_id, author_id, visibility, body)
VALUES
  ('16100000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'customer', 'The synthetic provisioning job reports a failure.'),
  ('16100000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'customer', 'Support has acknowledged the simulated failure and will retry it.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit_logs (id, actor_id, organization_id, action, entity_type, entity_id, new_data, reason, request_id)
VALUES
  ('17000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'pricing.version_created', 'pricing_version', '30000000-0000-0000-0000-000000000001', '{"version_name":"Demo pricing 2026-01"}'::jsonb, 'Synthetic demo setup', 'seed-demo-0001'),
  ('17000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'order.accepted', 'order', 'a0000000-0000-0000-0000-000000000001', '{"order_number":"CP-DEMO-0001","final_price":"44.0000","currency":"USD"}'::jsonb, 'Synthetic demo acceptance', 'seed-demo-0002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO idempotency_keys (
  id, scope, idempotency_key, request_hash, status, response_status, response_body, resource_type, resource_id, expires_at
)
VALUES ('18000000-0000-0000-0000-000000000001', 'user:20000000-0000-0000-0000-000000000001:offer-acceptance', 'demo-accept-0001', 'sha256:demo-acceptance', 'succeeded', 201, '{"order_number":"CP-DEMO-0001"}'::jsonb, 'order', 'a0000000-0000-0000-0000-000000000001', '2027-01-01T00:00:00Z')
ON CONFLICT (scope, idempotency_key) DO NOTHING;

INSERT INTO outbox_events (
  id, aggregate_type, aggregate_id, event_type, deduplication_key, payload, status, attempts, published_at
)
VALUES ('19000000-0000-0000-0000-000000000001', 'order', 'a0000000-0000-0000-0000-000000000001', 'order.payment_verified', 'demo-outbox-order-payment-0001', '{"order_id":"a0000000-0000-0000-0000-000000000001","payment_id":"d0000000-0000-0000-0000-000000000001"}'::jsonb, 'published', 1, '2026-01-02T10:31:00Z')
ON CONFLICT (id) DO NOTHING;
