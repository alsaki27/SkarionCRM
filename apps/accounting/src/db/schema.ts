import { sql, relations } from "drizzle-orm";
import {
  pgSchema, text, timestamp, uuid, index, uniqueIndex, jsonb, inet,
  decimal, date,
} from "drizzle-orm/pg-core";

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  };
}

function softDelete() {
  return {
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  };
}

export const booksSchema = pgSchema("books");

export const accountTypeEnum = booksSchema.enum("account_type", [
  "asset", "liability", "equity", "revenue", "expense",
]);

export const transactionStatusEnum = booksSchema.enum("transaction_status", [
  "draft", "posted",
]);

export const invoiceStatusEnum = booksSchema.enum("invoice_status", [
  "draft", "sent", "paid", "overdue", "cancelled",
]);

export const accounts = booksSchema.table(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    type: accountTypeEnum("type").notNull(),
    description: text("description"),
    parentId: uuid("parent_id"), // Self-referencing FK added via migration to avoid circular type ref
    balance: decimal("balance", { precision: 14, scale: 2 }).default("0").notNull(),
    ownerId: uuid("owner_id").notNull(),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index("idx_accounts_name").on(table.name),
    index("idx_accounts_code").on(table.code),
    index("idx_accounts_type").on(table.type),
    index("idx_accounts_owner").on(table.ownerId),
    uniqueIndex("idx_accounts_name_lower").on(sql`lower(${table.name})`),
  ]
);

export const transactions = booksSchema.table(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    description: text("description"),
    reference: text("reference"),
    status: transactionStatusEnum("status").default("draft").notNull(),
    totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    ownerId: uuid("owner_id").notNull(),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index("idx_transactions_date").on(table.date),
    index("idx_transactions_status").on(table.status),
    index("idx_transactions_owner").on(table.ownerId),
  ]
);

export const transactionLines = booksSchema.table(
  "transaction_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
    debit: decimal("debit", { precision: 14, scale: 2 }),
    credit: decimal("credit", { precision: 14, scale: 2 }),
    description: text("description"),
    ...timestamps(),
  },
  (table) => [
    index("idx_transaction_lines_transaction").on(table.transactionId),
    index("idx_transaction_lines_account").on(table.accountId),
  ]
);

export const invoices = booksSchema.table(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: text("number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    subtotal: decimal("subtotal", { precision: 14, scale: 2 }).default("0").notNull(),
    taxTotal: decimal("tax_total", { precision: 14, scale: 2 }).default("0").notNull(),
    total: decimal("total", { precision: 14, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    ownerId: uuid("owner_id").notNull(),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index("idx_invoices_number").on(table.number),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_owner").on(table.ownerId),
    index("idx_invoices_due_date").on(table.dueDate),
  ]
);

export const invoiceItems = booksSchema.table(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
    description: text("description").notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
    unitPrice: decimal("unit_price", { precision: 14, scale: 2 }).notNull(),
    taxCodeId: uuid("tax_code_id").references(() => taxCodes.id, { onDelete: "set null" }),
    lineTotal: decimal("line_total", { precision: 14, scale: 2 }).default("0").notNull(),
    ...timestamps(),
  },
  (table) => [
    index("idx_invoice_items_invoice").on(table.invoiceId),
  ]
);

export const taxCodes = booksSchema.table(
  "tax_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    rate: decimal("rate", { precision: 5, scale: 4 }).notNull(),
    jurisdiction: text("jurisdiction"),
    description: text("description"),
    ...timestamps(),
    ...softDelete(),
  },
  (table) => [
    index("idx_tax_codes_name").on(table.name),
    index("idx_tax_codes_jurisdiction").on(table.jurisdiction),
    uniqueIndex("idx_tax_codes_name_lower").on(sql`lower(${table.name})`),
  ]
);

export const auditLog = booksSchema.table(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id"),
    app: text("app").default("books").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_actor").on(table.actorUserId),
    index("idx_audit_resource").on(table.resourceType, table.resourceId),
    index("idx_audit_created").on(table.createdAt),
  ]
);

// ─────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, { fields: [accounts.parentId], references: [accounts.id] }),
  children: many(accounts),
  transactionLines: many(transactionLines),
}));

export const transactionsRelations = relations(transactions, ({ many }) => ({
  lines: many(transactionLines),
}));

export const transactionLinesRelations = relations(transactionLines, ({ one }) => ({
  transaction: one(transactions, { fields: [transactionLines.transactionId], references: [transactions.id] }),
  account: one(accounts, { fields: [transactionLines.accountId], references: [accounts.id] }),
}));

export const invoicesRelations = relations(invoices, ({ many }) => ({
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  taxCode: one(taxCodes, { fields: [invoiceItems.taxCodeId], references: [taxCodes.id] }),
}));

export const taxCodesRelations = relations(taxCodes, ({ many }) => ({
  invoiceItems: many(invoiceItems),
}));
