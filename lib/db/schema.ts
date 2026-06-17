import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, numeric, smallint, varchar
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const ceremonyTypeEnum = pgEnum("ceremony_type", [
  "catholic", "civil", "christian", "garden", "beach",
]);

export const collaboratorRoleEnum = pgEnum("collaborator_role", ["partner", "viewer"]);

export const rsvpStatusEnum = pgEnum("rsvp_status", ["pending", "attending", "declined"]);

export const vendorStatusEnum = pgEnum("vendor_status", [
  "interested", "shortlisted", "booked", "declined",
]);

export const vendorCategoryEnum = pgEnum("vendor_category", [
  "venue", "catering", "photography", "videography", "flowers",
  "hair_makeup", "styling", "sounds_lights", "cake", "transportation", "other",
]);

export const sponsorRoleEnum = pgEnum("sponsor_role", [
  "principal", "cord", "veil", "arrhae", "candle", "secondary",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const weddings = pgTable("weddings", {
  id:               uuid("id").primaryKey().defaultRandom(),
  ownerId:          uuid("owner_id").notNull(),
  coupleName1:      text("couple_name_1").notNull(),
  coupleName2:      text("couple_name_2").notNull(),
  weddingDate:      date("wedding_date"),
  ceremonyVenue:    text("ceremony_venue"),
  receptionVenue:   text("reception_venue"),
  budgetTotal:      numeric("budget_total", { precision: 12, scale: 2 }),
  createdAt:        timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const weddingSetup = pgTable("wedding_setup", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  weddingId:             uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  ceremonyType:          ceremonyTypeEnum("ceremony_type").notNull().default("catholic"),
  hasCoordinator:        boolean("has_coordinator").notNull().default(false),
  hasCotillion:          boolean("has_cotillion").notNull().default(false),
  hasCivilRegistration:  boolean("has_civil_registration").notNull().default(true),
  hasSecondarySponsors:  boolean("has_secondary_sponsors").notNull().default(true),
  entourageSize:         smallint("entourage_size").default(10),
});

export const checklistTemplates = pgTable("checklist_templates", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  title:               text("title").notNull(),
  category:            text("category").notNull(),
  monthsBefore:        numeric("months_before", { precision: 4, scale: 2 }).notNull(),
  ceremonyTypes:       text("ceremony_types").array().notNull().default(["catholic", "civil", "christian", "garden", "beach"]),
  requiresCoordinator: boolean("requires_coordinator"),
  requiresCotillion:   boolean("requires_cotillion"),
  isOptional:          boolean("is_optional").notNull().default(false),
  description:         text("description"),
  sortOrder:           integer("sort_order").default(0),
});

export const checklistItems = pgTable("checklist_items", {
  id:           uuid("id").primaryKey().defaultRandom(),
  weddingId:    uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  templateId:   uuid("template_id").references(() => checklistTemplates.id),
  title:        text("title").notNull(),
  category:     text("category").notNull(),
  monthsBefore: numeric("months_before", { precision: 4, scale: 2 }).notNull(),
  assignedTo:   uuid("assigned_to"),
  completed:    boolean("completed").notNull().default(false),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
  notes:        text("notes"),
  isCustom:     boolean("is_custom").notNull().default(false),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const budgetItems = pgTable("budget_items", {
  id:              uuid("id").primaryKey().defaultRandom(),
  weddingId:       uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  category:        text("category").notNull(),
  label:           text("label").notNull(),
  estimatedAmount: numeric("estimated_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount:      numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vendorId:        uuid("vendor_id"),
  dueDate:         date("due_date"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const guests = pgTable("guests", {
  id:          uuid("id").primaryKey().defaultRandom(),
  weddingId:   uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  name:        text("name").notNull(),
  email:       text("email"),
  phone:       text("phone"),
  rsvpStatus:  rsvpStatusEnum("rsvp_status").notNull().default("pending"),
  mealChoice:  text("meal_choice"),
  tableNumber: smallint("table_number"),
  plusOne:     boolean("plus_one").notNull().default(false),
  notes:       text("notes"),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vendors = pgTable("vendors", {
  id:            uuid("id").primaryKey().defaultRandom(),
  weddingId:     uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  category:      vendorCategoryEnum("category").notNull(),
  name:          text("name").notNull(),
  contact:       text("contact"),
  priceRangeMin: numeric("price_range_min", { precision: 12, scale: 2 }),
  priceRangeMax: numeric("price_range_max", { precision: 12, scale: 2 }),
  status:        vendorStatusEnum("status").notNull().default("interested"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sponsors = pgTable("sponsors", {
  id:        uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  phone:     text("phone"),
  email:     text("email"),
  role:      sponsorRoleEnum("role").notNull().default("principal"),
  confirmed: boolean("confirmed").notNull().default(false),
  notes:     text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const collaborators = pgTable("collaborators", {
  id:          uuid("id").primaryKey().defaultRandom(),
  weddingId:   uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  userId:      uuid("user_id").notNull(),
  role:        collaboratorRoleEnum("role").notNull(),
  invitedAt:   timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
  acceptedAt:  timestamp("accepted_at", { withTimezone: true }),
});

export const shareTokens = pgTable("share_tokens", {
  id:        uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
  token:     uuid("token").notNull().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type Wedding = typeof weddings.$inferSelect;
export type WeddingSetup = typeof weddingSetup.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Sponsor = typeof sponsors.$inferSelect;
export type Collaborator = typeof collaborators.$inferSelect;
export type ShareToken = typeof shareTokens.$inferSelect;
