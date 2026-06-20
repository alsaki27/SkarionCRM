import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb, withAudit } from "@skarion/db-kit";
import { requireAuth, requireSuperadmin, type AuthedVariables } from "@skarion/auth-client";
import { can } from "@skarion/permissions";
import { parseContactsCsv, parseCompaniesCsv, parseLeadsCsv } from "@skarion/importers";
import * as schema from "./db/schema.js";
import { eq, and, isNull, like, sql, desc, asc } from "drizzle-orm";
import type { CrmDb } from "./db/types.js";

interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  APP_URL: string;
}

function isAllowedOrigin(origin: string, appUrl: string): boolean {
  if (!origin) return false;
  if (origin === appUrl) return true;
  if (origin.endsWith(".skarion.com")) return true;
  if (origin.startsWith("http://localhost:")) return true;
  return false;
}

const app = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

app.use("*", cors({
  origin: (origin, c) => isAllowedOrigin(origin, c.env.APP_URL) ? origin : "",
  credentials: true,
}));

app.use("*", async (c, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
    const origin = c.req.header("Origin");
    if (origin && !isAllowedOrigin(origin, c.env.APP_URL)) {
      return c.json({ error: "CSRF: Invalid origin." }, 403);
    }
  }
  await next();
});

app.get("/health", (c) => c.json({ status: "ok", service: "skarion-crm-platform" }));

app.use("/api/*", requireAuth);
app.use("/api/admin/*", requireSuperadmin());

function getRole(c: unknown): string {
  const apps = (c as { get: (key: string) => unknown }).get("apps");
  return (apps as { crm?: string } | undefined)?.crm ?? "";
}

// --- COMPANIES ---

app.get("/api/companies", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), managedUserIds: undefined, isSuperadmin };
  if (!role) return c.json({ error: "Forbidden." }, 403);

  const { search, industry, owner } = c.req.query();
  const conditions = [isNull(schema.companies.deletedAt)];

  if (!isSuperadmin) {
    conditions.push(eq(schema.companies.ownerId, caller.userId));
  }
  if (search) {
    conditions.push(like(sql`lower(${schema.companies.name})`, `%${search.toLowerCase()}%`));
  }
  if (industry) conditions.push(eq(schema.companies.industry, industry));
  if (owner) conditions.push(eq(schema.companies.ownerId, owner));

  const rows = await db.select().from(schema.companies)
    .where(and(...conditions))
    .orderBy(desc(schema.companies.updatedAt))
    .limit(100);

  return c.json({ companies: rows });
});

app.post("/api/companies", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const data = {
    name: body.name,
    domain: body.domain ?? null,
    industry: body.industry ?? null,
    size: body.size ?? null,
    address: body.address ?? null,
    ownerId: caller.userId,
  };

  const [result] = await db.insert(schema.companies).values(data).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "company",
    resourceId: result.id,
    after: data,
    app: "crm",
  });

  return c.json({ company: result }, 201);
});

app.get("/api/companies/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [row] = await db.select().from(schema.companies)
    .where(and(eq(schema.companies.id, id), isNull(schema.companies.deletedAt)));
  if (!row) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "view", { ownerId: row.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  return c.json({ company: row });
});

app.put("/api/companies/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.companies)
    .where(and(eq(schema.companies.id, id), isNull(schema.companies.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.domain !== undefined) update.domain = body.domain;
  if (body.industry !== undefined) update.industry = body.industry;
  if (body.size !== undefined) update.size = body.size;
  if (body.address !== undefined) update.address = body.address;
  if (body.ownerId !== undefined && isSuperadmin) update.ownerId = body.ownerId;
  update.updatedAt = new Date();

  const [result] = await db.update(schema.companies).set(update)
    .where(eq(schema.companies.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "edit",
    resourceType: "company",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ company: result });
});

app.delete("/api/companies/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.companies)
    .where(and(eq(schema.companies.id, id), isNull(schema.companies.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "delete", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.update(schema.companies).set({
    deletedAt: new Date(),
    deletedBy: caller.userId,
  }).where(eq(schema.companies.id, id));

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "delete",
    resourceType: "company",
    resourceId: id,
    before: existing,
    app: "crm",
  });

  return c.json({ success: true });
});

// --- CONTACTS ---

app.get("/api/contacts", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), managedUserIds: undefined, isSuperadmin };
  if (!role) return c.json({ error: "Forbidden." }, 403);

  const { search, companyId, owner } = c.req.query();
  const conditions = [isNull(schema.contacts.deletedAt)];

  if (!isSuperadmin) {
    conditions.push(eq(schema.contacts.ownerId, caller.userId));
  }
  if (search) {
    conditions.push(like(sql`lower(${schema.contacts.email})`, `%${search.toLowerCase()}%`));
  }
  if (companyId) conditions.push(eq(schema.contacts.companyId, companyId));
  if (owner) conditions.push(eq(schema.contacts.ownerId, owner));

  const rows = await db.select().from(schema.contacts)
    .where(and(...conditions))
    .orderBy(desc(schema.contacts.updatedAt))
    .limit(100);

  return c.json({ contacts: rows });
});

app.post("/api/contacts", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const data = {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone ?? null,
    title: body.title ?? null,
    companyId: body.companyId ?? null,
    ownerId: caller.userId,
  };

  const [result] = await db.insert(schema.contacts).values(data).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "contact",
    resourceId: result.id,
    after: data,
    app: "crm",
  });

  return c.json({ contact: result }, 201);
});

app.get("/api/contacts/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [row] = await db.select().from(schema.contacts)
    .where(and(eq(schema.contacts.id, id), isNull(schema.contacts.deletedAt)));
  if (!row) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "view", { ownerId: row.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  return c.json({ contact: row });
});

app.put("/api/contacts/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.contacts)
    .where(and(eq(schema.contacts.id, id), isNull(schema.contacts.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.firstName !== undefined) update.firstName = body.firstName;
  if (body.lastName !== undefined) update.lastName = body.lastName;
  if (body.email !== undefined) update.email = body.email;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.title !== undefined) update.title = body.title;
  if (body.companyId !== undefined) update.companyId = body.companyId;
  if (body.ownerId !== undefined && isSuperadmin) update.ownerId = body.ownerId;
  update.updatedAt = new Date();

  const [result] = await db.update(schema.contacts).set(update)
    .where(eq(schema.contacts.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "edit",
    resourceType: "contact",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ contact: result });
});

app.delete("/api/contacts/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.contacts)
    .where(and(eq(schema.contacts.id, id), isNull(schema.contacts.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "delete", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.update(schema.contacts).set({
    deletedAt: new Date(),
    deletedBy: caller.userId,
  }).where(eq(schema.contacts.id, id));

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "delete",
    resourceType: "contact",
    resourceId: id,
    before: existing,
    app: "crm",
  });

  return c.json({ success: true });
});

// --- LEADS ---

app.get("/api/leads", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), managedUserIds: undefined, isSuperadmin };
  if (!role) return c.json({ error: "Forbidden." }, 403);

  const { status, source, search, owner } = c.req.query();
  const conditions = [isNull(schema.leads.deletedAt)];

  if (!isSuperadmin) {
    conditions.push(eq(schema.leads.ownerId, caller.userId));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (status) conditions.push(eq(schema.leads.status, status as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (source) conditions.push(eq(schema.leads.source, source as any));
  if (search) {
    conditions.push(like(sql`lower(${schema.leads.email})`, `%${search.toLowerCase()}%`));
  }
  if (owner) conditions.push(eq(schema.leads.ownerId, owner));

  const rows = await db.select().from(schema.leads)
    .where(and(...conditions))
    .orderBy(desc(schema.leads.createdAt))
    .limit(100);

  return c.json({ leads: rows });
});

app.post("/api/leads", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const data = {
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone ?? null,
    companyName: body.companyName ?? null,
    companyDomain: body.companyDomain ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source: (body.source ?? "other") as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: (body.status ?? "new") as any,
    notes: body.notes ?? null,
    ownerId: caller.userId,
  };

  const [result] = await db.insert(schema.leads).values(data).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "lead",
    resourceId: result.id,
    after: data,
    app: "crm",
  });

  return c.json({ lead: result }, 201);
});

app.get("/api/leads/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [row] = await db.select().from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));
  if (!row) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "view", { ownerId: row.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  return c.json({ lead: row });
});

app.put("/api/leads/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.firstName !== undefined) update.firstName = body.firstName;
  if (body.lastName !== undefined) update.lastName = body.lastName;
  if (body.email !== undefined) update.email = body.email;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.companyName !== undefined) update.companyName = body.companyName;
  if (body.companyDomain !== undefined) update.companyDomain = body.companyDomain;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (body.source !== undefined) update.source = body.source as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (body.status !== undefined) update.status = body.status as any;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.ownerId !== undefined && isSuperadmin) update.ownerId = body.ownerId;
  update.updatedAt = new Date();

  const [result] = await db.update(schema.leads).set(update)
    .where(eq(schema.leads.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "edit",
    resourceType: "lead",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ lead: result });
});

app.delete("/api/leads/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "delete", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.update(schema.leads).set({
    deletedAt: new Date(),
    deletedBy: caller.userId,
  }).where(eq(schema.leads.id, id));

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "delete",
    resourceType: "lead",
    resourceId: id,
    before: existing,
    app: "crm",
  });

  return c.json({ success: true });
});

app.post("/api/leads/:id/convert", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [lead] = await db.select().from(schema.leads)
    .where(and(eq(schema.leads.id, id), isNull(schema.leads.deletedAt)));
  if (!lead) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: lead.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }
  if (lead.status === "converted") {
    return c.json({ error: "Lead already converted." }, 400);
  }

  let companyId: string | null = null;
  if (lead.companyDomain) {
    const [existingCompany] = await db.select().from(schema.companies)
      .where(and(
        eq(sql`lower(${schema.companies.domain})`, lead.companyDomain.toLowerCase()),
        isNull(schema.companies.deletedAt)
      ));
    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const [newCompany] = await db.insert(schema.companies).values({
        name: lead.companyName || lead.companyDomain,
        domain: lead.companyDomain,
        ownerId: caller.userId,
      }).returning();
      if (!newCompany) return c.json({ error: "Internal error" }, 500);
      companyId = newCompany.id;
      await withAudit(db, schema.auditLog, {
        actorUserId: caller.userId,
        action: "create",
        resourceType: "company",
        resourceId: newCompany.id,
        after: newCompany,
        app: "crm",
      });
    }
  }

  const [contact] = await db.insert(schema.contacts).values({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    companyId,
    ownerId: caller.userId,
  }).returning();
  if (!contact) return c.json({ error: "Internal error" }, 500);

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "contact",
    resourceId: contact.id,
    after: contact,
    app: "crm",
  });

  const [updatedLead] = await db.update(schema.leads).set({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: "converted" as any,
    convertedToContactId: contact.id,
    convertedToCompanyId: companyId,
    convertedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(schema.leads.id, id)).returning();
  if (!updatedLead) return c.json({ error: "Internal error" }, 500);

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "convert",
    resourceType: "lead",
    resourceId: id,
    before: lead,
    after: updatedLead,
    app: "crm",
  });

  return c.json({ lead: updatedLead, contact, companyId });
});

// --- OPPORTUNITIES ---

app.get("/api/opportunities", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), managedUserIds: undefined, isSuperadmin };
  if (!role) return c.json({ error: "Forbidden." }, 403);

  const { stage, search, owner } = c.req.query();
  const conditions = [isNull(schema.opportunities.deletedAt)];

  if (!isSuperadmin) {
    conditions.push(eq(schema.opportunities.ownerId, caller.userId));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (stage) conditions.push(eq(schema.opportunities.stage, stage as any));
  if (search) {
    conditions.push(like(sql`lower(${schema.opportunities.name})`, `%${search.toLowerCase()}%`));
  }
  if (owner) conditions.push(eq(schema.opportunities.ownerId, owner));

  const rows = await db.select().from(schema.opportunities)
    .where(and(...conditions))
    .orderBy(desc(schema.opportunities.updatedAt))
    .limit(100);

  return c.json({ opportunities: rows });
});

app.post("/api/opportunities", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const data = {
    name: body.name,
    companyId: body.companyId ?? null,
    contactId: body.contactId ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stage: (body.stage ?? "prospecting") as any,
    amount: body.amount ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currency: (body.currency ?? "USD") as any,
    expectedCloseDate: body.expectedCloseDate ?? null,
    probability: body.probability ?? null,
    notes: body.notes ?? null,
    ownerId: caller.userId,
  };

  const [result] = await db.insert(schema.opportunities).values(data).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "opportunity",
    resourceId: result.id,
    after: data,
    app: "crm",
  });

  return c.json({ opportunity: result }, 201);
});

app.get("/api/opportunities/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [row] = await db.select().from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), isNull(schema.opportunities.deletedAt)));
  if (!row) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "view", { ownerId: row.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  return c.json({ opportunity: row });
});

app.put("/api/opportunities/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), isNull(schema.opportunities.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.companyId !== undefined) update.companyId = body.companyId;
  if (body.contactId !== undefined) update.contactId = body.contactId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (body.stage !== undefined) update.stage = body.stage as any;
  if (body.amount !== undefined) update.amount = body.amount;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (body.currency !== undefined) update.currency = body.currency as any;
  if (body.expectedCloseDate !== undefined) update.expectedCloseDate = body.expectedCloseDate;
  if (body.probability !== undefined) update.probability = body.probability;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.ownerId !== undefined && isSuperadmin) update.ownerId = body.ownerId;
  update.updatedAt = new Date();

  const [result] = await db.update(schema.opportunities).set(update)
    .where(eq(schema.opportunities.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "edit",
    resourceType: "opportunity",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ opportunity: result });
});

app.delete("/api/opportunities/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.opportunities)
    .where(and(eq(schema.opportunities.id, id), isNull(schema.opportunities.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "delete", { ownerId: existing.ownerId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.update(schema.opportunities).set({
    deletedAt: new Date(),
    deletedBy: caller.userId,
  }).where(eq(schema.opportunities.id, id));

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "delete",
    resourceType: "opportunity",
    resourceId: id,
    before: existing,
    app: "crm",
  });

  return c.json({ success: true });
});

// --- ACTIVITIES ---

app.get("/api/activities", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const _caller = { userId: c.get("userId") };
  if (!role) return c.json({ error: "Forbidden." }, 403);

  const { contactId, companyId, opportunityId, type } = c.req.query();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  if (contactId) conditions.push(eq(schema.activities.contactId, contactId));
  if (companyId) conditions.push(eq(schema.activities.companyId, companyId));
  if (opportunityId) conditions.push(eq(schema.activities.opportunityId, opportunityId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (type) conditions.push(eq(schema.activities.type, type as any));

  if (conditions.length === 0) {
    return c.json({ error: "Provide at least one filter: contactId, companyId, opportunityId, or type." }, 400);
  }

  const rows = await db.select().from(schema.activities)
    .where(and(...conditions))
    .orderBy(desc(schema.activities.happenedAt))
    .limit(100);

  return c.json({ activities: rows });
});

app.post("/api/activities", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const data = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: body.type as any,
    subject: body.subject,
    content: body.content ?? null,
    contactId: body.contactId ?? null,
    companyId: body.companyId ?? null,
    opportunityId: body.opportunityId ?? null,
    actorId: caller.userId,
    happenedAt: body.happenedAt ? new Date(body.happenedAt) : new Date(),
  };

  const [result] = await db.insert(schema.activities).values(data).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "activity",
    resourceId: result.id,
    after: data,
    app: "crm",
  });

  return c.json({ activity: result }, 201);
});

app.get("/api/activities/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId") };

  const [row] = await db.select().from(schema.activities)
    .where(eq(schema.activities.id, id));
  if (!row) return c.json({ error: "Not found." }, 404);
  if (!isSuperadmin && row.actorId !== caller.userId) {
    return c.json({ error: "Forbidden." }, 403);
  }

  return c.json({ activity: row });
});

app.put("/api/activities/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId") };

  const [existing] = await db.select().from(schema.activities)
    .where(eq(schema.activities.id, id));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!isSuperadmin && existing.actorId !== caller.userId) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (body.type !== undefined) update.type = body.type as any;
  if (body.subject !== undefined) update.subject = body.subject;
  if (body.content !== undefined) update.content = body.content;
  if (body.contactId !== undefined) update.contactId = body.contactId;
  if (body.companyId !== undefined) update.companyId = body.companyId;
  if (body.opportunityId !== undefined) update.opportunityId = body.opportunityId;
  if (body.happenedAt !== undefined) update.happenedAt = new Date(body.happenedAt);
  update.updatedAt = new Date();

  const [result] = await db.update(schema.activities).set(update)
    .where(eq(schema.activities.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "edit",
    resourceType: "activity",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ activity: result });
});

app.delete("/api/activities/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId") };

  const [existing] = await db.select().from(schema.activities)
    .where(eq(schema.activities.id, id));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!isSuperadmin && existing.actorId !== caller.userId) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.delete(schema.activities).where(eq(schema.activities.id, id));

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "delete",
    resourceType: "activity",
    resourceId: id,
    before: existing,
    app: "crm",
  });

  return c.json({ success: true });
});

// --- TASKS ---

app.get("/api/tasks", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), managedUserIds: undefined, isSuperadmin };
  if (!role) return c.json({ error: "Forbidden." }, 403);

  const { assigneeId, contactId, companyId, opportunityId, completed, priority } = c.req.query();
  const conditions = [isNull(schema.tasks.deletedAt)];

  if (!isSuperadmin) {
    conditions.push(eq(schema.tasks.assigneeId, caller.userId));
  }
  if (assigneeId) conditions.push(eq(schema.tasks.assigneeId, assigneeId));
  if (contactId) conditions.push(eq(schema.tasks.contactId, contactId));
  if (companyId) conditions.push(eq(schema.tasks.companyId, companyId));
  if (opportunityId) conditions.push(eq(schema.tasks.opportunityId, opportunityId));
  if (priority) conditions.push(eq(schema.tasks.priority, priority));
  if (completed === "true") conditions.push(sql`${schema.tasks.completedAt} IS NOT NULL`);
  if (completed === "false") conditions.push(sql`${schema.tasks.completedAt} IS NULL`);

  const rows = await db.select().from(schema.tasks)
    .where(and(...conditions))
    .orderBy(asc(schema.tasks.dueDate))
    .limit(100);

  return c.json({ tasks: rows });
});

app.post("/api/tasks", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const data = {
    title: body.title,
    description: body.description ?? null,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    assigneeId: body.assigneeId ?? caller.userId,
    contactId: body.contactId ?? null,
    companyId: body.companyId ?? null,
    opportunityId: body.opportunityId ?? null,
    priority: body.priority ?? "medium",
  };

  const [result] = await db.insert(schema.tasks).values(data).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "create",
    resourceType: "task",
    resourceId: result.id,
    after: data,
    app: "crm",
  });

  return c.json({ task: result }, 201);
});

app.get("/api/tasks/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [row] = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)));
  if (!row) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "view", { ownerId: row.assigneeId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  return c.json({ task: row });
});

app.put("/api/tasks/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.assigneeId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.dueDate !== undefined) update.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.assigneeId !== undefined) update.assigneeId = body.assigneeId;
  if (body.contactId !== undefined) update.contactId = body.contactId;
  if (body.companyId !== undefined) update.companyId = body.companyId;
  if (body.opportunityId !== undefined) update.opportunityId = body.opportunityId;
  if (body.priority !== undefined) update.priority = body.priority;
  update.updatedAt = new Date();

  const [result] = await db.update(schema.tasks).set(update)
    .where(eq(schema.tasks.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);
  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "edit",
    resourceType: "task",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ task: result });
});

app.put("/api/tasks/:id/complete", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.assigneeId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const [result] = await db.update(schema.tasks).set({
    completedAt: new Date(),
    completedBy: caller.userId,
    updatedAt: new Date(),
  }).where(eq(schema.tasks.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "complete",
    resourceType: "task",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ task: result });
});

app.put("/api/tasks/:id/reopen", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "edit", { ownerId: existing.assigneeId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const [result] = await db.update(schema.tasks).set({
    completedAt: null,
    completedBy: null,
    updatedAt: new Date(),
  }).where(eq(schema.tasks.id, id)).returning();
  if (!result) return c.json({ error: "Internal error" }, 500);

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "reopen",
    resourceType: "task",
    resourceId: id,
    before: existing,
    after: result,
    app: "crm",
  });

  return c.json({ task: result });
});

app.delete("/api/tasks/:id", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const id = c.req.param("id");
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };

  const [existing] = await db.select().from(schema.tasks)
    .where(and(eq(schema.tasks.id, id), isNull(schema.tasks.deletedAt)));
  if (!existing) return c.json({ error: "Not found." }, 404);
  if (!can(isSuperadmin, role, "delete", { ownerId: existing.assigneeId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.update(schema.tasks).set({
    deletedAt: new Date(),
    deletedBy: caller.userId,
  }).where(eq(schema.tasks.id, id));

  await withAudit(db, schema.auditLog, {
    actorUserId: caller.userId,
    action: "delete",
    resourceType: "task",
    resourceId: id,
    before: existing,
    app: "crm",
  });

  return c.json({ success: true });
});

// --- IMPORT ---

app.post("/api/import/companies", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const csvText = body.csv;
  if (!csvText || typeof csvText !== "string") {
    return c.json({ error: "Missing or invalid 'csv' field." }, 400);
  }

  const parsed = parseCompaniesCsv(csvText);
  const created: typeof schema.companies.$inferInsert[] = [];
  for (const row of parsed.success) {
    const [result] = await db.insert(schema.companies).values({
      name: row.name,
      domain: row.domain ?? null,
      industry: row.industry ?? null,
      size: row.size ?? null,
      ownerId: caller.userId,
    }).returning();
    if (!result) return c.json({ error: "Internal error" }, 500);
    created.push(result);
  }

  return c.json({ imported: created.length, errors: parsed.errors, duplicates: parsed.duplicates });
});

app.post("/api/import/contacts", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const csvText = body.csv;
  if (!csvText || typeof csvText !== "string") {
    return c.json({ error: "Missing or invalid 'csv' field." }, 400);
  }

  const parsed = parseContactsCsv(csvText);
  const created: typeof schema.contacts.$inferInsert[] = [];
  for (const row of parsed.success) {
    let companyId: string | null = null;
    if (row.companyName) {
      const [company] = await db.select().from(schema.companies)
        .where(and(
          like(sql`lower(${schema.companies.name})`, `%${row.companyName.toLowerCase()}%`),
          isNull(schema.companies.deletedAt)
        ));
      if (company) companyId = company.id;
    }
    const [result] = await db.insert(schema.contacts).values({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone ?? null,
      title: row.title ?? null,
      companyId,
      ownerId: caller.userId,
    }).returning();
    if (!result) return c.json({ error: "Internal error" }, 500);
    created.push(result);
  }

  return c.json({ imported: created.length, errors: parsed.errors, duplicates: parsed.duplicates });
});

app.post("/api/import/leads", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const role = getRole(c);
  const isSuperadmin = c.get("isSuperadmin");
  const caller = { userId: c.get("userId"), isSuperadmin };
  if (!can(isSuperadmin, role, "create", { ownerId: caller.userId }, caller)) {
    return c.json({ error: "Forbidden." }, 403);
  }

  const body = await c.req.json();
  const csvText = body.csv;
  if (!csvText || typeof csvText !== "string") {
    return c.json({ error: "Missing or invalid 'csv' field." }, 400);
  }

  const parsed = parseLeadsCsv(csvText);
  const created: typeof schema.leads.$inferInsert[] = [];
  for (const row of parsed.success) {
    const [result] = await db.insert(schema.leads).values({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone ?? null,
      companyName: row.companyName ?? null,
      companyDomain: row.companyDomain ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source: (row.source ?? "other") as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: "new" as any,
      ownerId: caller.userId,
    }).returning();
    if (!result) return c.json({ error: "Internal error" }, 500);
    created.push(result);
  }

  return c.json({ imported: created.length, errors: parsed.errors, duplicates: parsed.duplicates });
});

// --- ADMIN ---

app.get("/api/admin/audit-log", async (c) => {
  const db = getDb(c.env, schema) as CrmDb;
  const rows = await db.select().from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(200);
  return c.json({ auditLog: rows });
});

export default app;
