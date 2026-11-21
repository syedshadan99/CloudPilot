/**
 * CP-15 unit tests — Notifications, support tickets, and immutable audit logging.
 * Uses Node.js built-in test runner (node --test).
 *
 * Run from repo root:
 *   node --test apps/api/test/unit/notifications-support-audit.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NotificationsService } from "../../dist/modules/notifications/notifications.service.js";
import { SupportService } from "../../dist/modules/support/support.service.js";
import { TicketStatus, TicketPriority } from "../../dist/modules/support/dto/support-ticket.dto.js";
import { AuditService } from "../../dist/modules/audit/audit.service.js";
import { AuditRepository } from "../../dist/modules/audit/audit.repository.js";

// ── 1. Notifications — Visibility and Ownership ──────────────────────────────

describe("NotificationsService — Ownership and Scoped Visibility", () => {
  function createMockNotificationsRepo() {
    const notifications = [];

    return {
      notifications,
      create: async (params) => {
        const item = {
          id: "notif-" + (notifications.length + 1),
          user_id: params.userId,
          role: params.role || "CUSTOMER",
          type: params.type,
          title: params.title,
          message: params.message,
          read_at: null,
          metadata: params.metadata || null,
          created_at: new Date(),
        };
        notifications.push(item);
        return { ...item };
      },
      findById: async (id) => notifications.find((n) => n.id === id) || null,
      listByUser: async (userId, unreadOnly) =>
        notifications.filter(
          (n) => n.user_id === userId && (!unreadOnly || n.read_at === null),
        ),
      markAsRead: async (id, userId) => {
        const item = notifications.find(
          (n) => n.id === id && n.user_id === userId,
        );
        if (item && !item.read_at) {
          item.read_at = new Date();
          return { ...item };
        }
        return item;
      },
      markAllAsRead: async (userId) => {
        let count = 0;
        for (const item of notifications) {
          if (item.user_id === userId && !item.read_at) {
            item.read_at = new Date();
            count++;
          }
        }
        return count;
      },
      countUnread: async (userId) =>
        notifications.filter((n) => n.user_id === userId && !n.read_at).length,
    };
  }

  it("creates and retrieves notifications scoped to intended user only", async () => {
    const repo = createMockNotificationsRepo();
    const service = new NotificationsService(repo);

    await service.createNotification({
      userId: "cust-1",
      type: "VM_READY",
      title: "Your VM is ready",
      message: "VM sim-vm-123 is now online.",
    });

    await service.createNotification({
      userId: "cust-2",
      type: "INVOICE_GENERATED",
      title: "New invoice",
      message: "Invoice INV-001 issued.",
    });

    const cust1List = await service.listForUser("cust-1");
    assert.equal(cust1List.length, 1);
    assert.equal(cust1List[0].title, "Your VM is ready");

    const cust2List = await service.listForUser("cust-2");
    assert.equal(cust2List.length, 1);
    assert.equal(cust2List[0].title, "New invoice");
  });

  it("marks notifications as read idempotently for the owner", async () => {
    const repo = createMockNotificationsRepo();
    const service = new NotificationsService(repo);

    const n = await service.createNotification({
      userId: "cust-1",
      type: "OFFER_READY",
      title: "Offer ready",
      message: "Special starter plan available",
    });

    assert.equal(n.read_at, null);

    const read = await service.markAsRead(n.id, "cust-1");
    assert.ok(read.read_at);

    // Repeated call is idempotent
    const repeat = await service.markAsRead(n.id, "cust-1");
    assert.ok(repeat.read_at);
  });

  it("rejects marking another user's notification as read (IDOR guard)", async () => {
    const repo = createMockNotificationsRepo();
    const service = new NotificationsService(repo);

    const n = await service.createNotification({
      userId: "cust-owner",
      type: "ALERT",
      title: "Private notification",
      message: "Only cust-owner should see this.",
    });

    await assert.rejects(
      () => service.markAsRead(n.id, "attacker-cust"),
      /You cannot access another user's notifications/,
    );
  });

  it("tracks unread count accurately", async () => {
    const repo = createMockNotificationsRepo();
    const service = new NotificationsService(repo);

    await service.createNotification({
      userId: "cust-counts",
      type: "N1",
      title: "1",
      message: "1",
    });
    await service.createNotification({
      userId: "cust-counts",
      type: "N2",
      title: "2",
      message: "2",
    });

    const unread = await service.getUnreadCount("cust-counts");
    assert.equal(unread.unreadCount, 2);

    await service.markAllAsRead("cust-counts");
    const after = await service.getUnreadCount("cust-counts");
    assert.equal(after.unreadCount, 0);
  });
});

// ── 2. Support Tickets — Ownership & Access Controls ─────────────────────────

describe("SupportService — Strict Ownership and Access Controls", () => {
  function createMockSupportRepo() {
    const tickets = [];
    const messages = [];

    return {
      tickets,
      messages,
      createTicket: async (params) => {
        const item = {
          id: "ticket-" + (tickets.length + 1),
          customer_id: params.customerId,
          subject: params.subject,
          description: params.description,
          priority: params.priority || TicketPriority.MEDIUM,
          status: TicketStatus.OPEN,
          assigned_to: null,
          resolution_notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        tickets.push(item);
        return { ...item };
      },
      findById: async (id) => tickets.find((t) => t.id === id) || null,
      listByCustomer: async (customerId) =>
        tickets.filter((t) => t.customer_id === customerId),
      listAll: async (filters) =>
        tickets.filter(
          (t) =>
            (!filters?.status || t.status === filters.status) &&
            (!filters?.assignedTo || t.assigned_to === filters.assignedTo),
        ),
      updateStatus: async (id, status, notes) => {
        const item = tickets.find((t) => t.id === id);
        if (item) {
          item.status = status;
          if (notes) item.resolution_notes = notes;
          item.updated_at = new Date();
          return { ...item };
        }
        return null;
      },
      assignTicket: async (id, assignedTo) => {
        const item = tickets.find((t) => t.id === id);
        if (item) {
          item.assigned_to = assignedTo;
          item.updated_at = new Date();
          return { ...item };
        }
        return null;
      },
      addMessage: async (params) => {
        const msg = {
          id: "msg-" + (messages.length + 1),
          ticket_id: params.ticketId,
          sender_id: params.senderId,
          sender_role: params.senderRole,
          message: params.message,
          created_at: new Date(),
        };
        messages.push(msg);
        return { ...msg };
      },
      listMessages: async (ticketId) =>
        messages.filter((m) => m.ticket_id === ticketId),
    };
  }

  it("allows a customer to create a support ticket and view own thread", async () => {
    const repo = createMockSupportRepo();
    const service = new SupportService(repo);

    const ticket = await service.createTicket({
      customerId: "cust-alice",
      subject: "SSH connection timeout",
      description: "Cannot connect to port 22 on VM sim-vm-001",
      priority: TicketPriority.HIGH,
    });

    assert.equal(ticket.status, TicketStatus.OPEN);
    assert.equal(ticket.customer_id, "cust-alice");

    const retrieved = await service.getTicket(ticket.id, "cust-alice", "CUSTOMER");
    assert.equal(retrieved.ticket.subject, "SSH connection timeout");
    assert.deepEqual(retrieved.messages, []);
  });

  it("blocks a customer from viewing another customer's ticket (IDOR guard)", async () => {
    const repo = createMockSupportRepo();
    const service = new SupportService(repo);

    const ticket = await service.createTicket({
      customerId: "cust-alice",
      subject: "Billing inquiry",
      description: "Question about invoice amount",
    });

    await assert.rejects(
      () => service.getTicket(ticket.id, "cust-bob", "CUSTOMER"),
      /You do not have access to this support ticket/,
    );
  });

  it("blocks customer from replying to another customer's ticket", async () => {
    const repo = createMockSupportRepo();
    const service = new SupportService(repo);

    const ticket = await service.createTicket({
      customerId: "cust-alice",
      subject: "Issue",
      description: "Desc",
    });

    await assert.rejects(
      () =>
        service.addMessage(ticket.id, {
          senderId: "cust-bob",
          senderRole: "CUSTOMER",
          message: "Malicious reply",
        }),
      /You cannot reply to a ticket you do not own/,
    );
  });

  it("allows provider to list all tickets, assign staff, and update status", async () => {
    const repo = createMockSupportRepo();
    const service = new SupportService(repo);

    const ticket = await service.createTicket({
      customerId: "cust-alice",
      subject: "Server issue",
      description: "Need help",
    });

    // Provider lists all
    const all = await service.listTickets("provider-admin", "PROVIDER");
    assert.equal(all.length, 1);

    // Provider assigns ticket
    const assigned = await service.assignTicket(ticket.id, {
      providerId: "provider-admin",
      assignedTo: "staff-engineer-1",
    });
    assert.equal(assigned.assigned_to, "staff-engineer-1");

    // Provider resolves ticket
    const resolved = await service.updateStatus(ticket.id, {
      actorId: "provider-admin",
      actorRole: "PROVIDER",
      status: TicketStatus.RESOLVED,
      resolutionNotes: "Fixed network routing rule",
    });
    assert.equal(resolved.status, TicketStatus.RESOLVED);
    assert.equal(resolved.resolution_notes, "Fixed network routing rule");
  });

  it("blocks customer from arbitrarily assigning tickets or changing status to RESOLVED", async () => {
    const repo = createMockSupportRepo();
    const service = new SupportService(repo);

    const ticket = await service.createTicket({
      customerId: "cust-alice",
      subject: "Issue",
      description: "Desc",
    });

    await assert.rejects(
      () =>
        service.updateStatus(ticket.id, {
          actorId: "cust-alice",
          actorRole: "CUSTOMER",
          status: TicketStatus.RESOLVED,
        }),
      /Customers can only close their support tickets/,
    );
  });
});

// ── 3. Audit Logs — Immutability and Scoped Visibility ───────────────────────

describe("AuditService & Repository — Immutability and Scoped Visibility", () => {
  function createMockAuditRepo() {
    const logs = [];

    return {
      logs,
      append: async (params) => {
        const item = {
          id: "audit-" + (logs.length + 1),
          actor_id: params.actorId,
          actor_role: params.actorRole || "CUSTOMER",
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId,
          old_data: params.oldData || null,
          new_data: params.newData || null,
          ip_address: params.ipAddress || null,
          metadata: params.metadata || null,
          created_at: new Date(),
        };
        logs.push(item);
        return { ...item };
      },
      findById: async (id) => logs.find((l) => l.id === id) || null,
      listByActor: async (actorId, limit = 50) =>
        logs.filter((l) => l.actor_id === actorId).slice(0, limit),
      listByEntity: async (entityType, entityId, limit = 50) =>
        logs
          .filter((l) => l.entity_type === entityType && l.entity_id === entityId)
          .slice(0, limit),
      listAll: async (filters, limit = 50) =>
        logs
          .filter(
            (l) =>
              (!filters?.actorId || l.actor_id === filters.actorId) &&
              (!filters?.entityType || l.entity_type === filters.entityType) &&
              (!filters?.action || l.action === filters.action),
          )
          .slice(0, limit),
    };
  }

  it("verifies repository provides NO update or delete methods (immutability contract)", () => {
    const auditRepoPrototype = AuditRepository.prototype;

    assert.equal(typeof auditRepoPrototype.append, "function");
    assert.equal(typeof auditRepoPrototype.findById, "function");
    assert.equal(typeof auditRepoPrototype.listByActor, "function");
    assert.equal(typeof auditRepoPrototype.listByEntity, "function");
    assert.equal(typeof auditRepoPrototype.listAll, "function");

    // Immutability checks: no mutation methods exist on repository
    assert.equal(typeof auditRepoPrototype["update"], "undefined");
    assert.equal(typeof auditRepoPrototype["delete"], "undefined");
    assert.equal(typeof auditRepoPrototype["remove"], "undefined");
    assert.equal(typeof auditRepoPrototype["updateById"], "undefined");
    assert.equal(typeof auditRepoPrototype["deleteById"], "undefined");
  });

  it("appends immutable audit logs for VM and business operations", async () => {
    const repo = createMockAuditRepo();
    const service = new AuditService(repo);

    const entry = await service.append({
      actorId: "cust-1",
      actorRole: "CUSTOMER",
      action: "VM_START",
      entityType: "VIRTUAL_MACHINE",
      entityId: "vm-456",
      oldData: { state: "STOPPED" },
      newData: { state: "RUNNING" },
      ipAddress: "192.168.1.100",
    });

    assert.equal(entry.action, "VM_START");
    assert.equal(entry.entity_id, "vm-456");
    assert.equal(entry.actor_id, "cust-1");
    assert.equal(repo.logs.length, 1);
  });

  it("restricts customer queries strictly to their own audit logs", async () => {
    const repo = createMockAuditRepo();
    const service = new AuditService(repo);

    await service.append({
      actorId: "cust-alice",
      action: "VM_RESIZE_REQUESTED",
      entityType: "UPGRADE_REQUEST",
      entityId: "req-1",
    });

    await service.append({
      actorId: "cust-bob",
      action: "OFFER_ACCEPTED",
      entityType: "OFFER",
      entityId: "off-99",
    });

    // Alice queries logs as customer
    const aliceLogs = await service.queryLogs({
      actorId: "cust-alice",
      role: "CUSTOMER",
    });
    assert.equal(aliceLogs.length, 1);
    assert.equal(aliceLogs[0].action, "VM_RESIZE_REQUESTED");

    // Bob queries logs as customer
    const bobLogs = await service.queryLogs({
      actorId: "cust-bob",
      role: "CUSTOMER",
    });
    assert.equal(bobLogs.length, 1);
    assert.equal(bobLogs[0].action, "OFFER_ACCEPTED");
  });

  it("allows provider to query global audit logs across all entities and actors", async () => {
    const repo = createMockAuditRepo();
    const service = new AuditService(repo);

    await service.append({
      actorId: "cust-alice",
      action: "VM_START",
      entityType: "VIRTUAL_MACHINE",
      entityId: "vm-1",
    });

    await service.append({
      actorId: "cust-bob",
      action: "VM_STOP",
      entityType: "VIRTUAL_MACHINE",
      entityId: "vm-2",
    });

    const providerLogs = await service.queryLogs({
      actorId: "ALL",
      role: "PROVIDER",
    });
    assert.equal(providerLogs.length, 2);
  });
});
