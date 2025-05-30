import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  vendorId: text("vendor_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  materials: text("materials").array().notNull(), // ["cement", "tmt"]
  lastQuoted: timestamp("last_quoted"),
  isActive: boolean("is_active").default(true),
  responseCount: integer("response_count").default(0),
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }).default("0"),
  rank: integer("rank").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  inquiryId: text("inquiry_id").notNull().unique(),
  userName: text("user_name").notNull(),
  userPhone: text("user_phone"),
  city: text("city").notNull(),
  material: text("material").notNull(), // "cement" | "tmt"
  brand: text("brand"),
  quantity: text("quantity"),
  vendorsContacted: text("vendors_contacted").array().notNull(),
  responseCount: integer("response_count").default(0),
  status: text("status").notNull().default("pending"), // "pending" | "responded" | "completed"
  timestamp: timestamp("timestamp").defaultNow(),
});

export const priceResponses = pgTable("price_responses", {
  id: serial("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  inquiryId: text("inquiry_id").notNull(),
  material: text("material").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  gst: decimal("gst", { precision: 5, scale: 2 }).notNull(),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).default("0"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  messageTemplate: text("message_template").notNull(),
  maxVendorsPerInquiry: integer("max_vendors_per_inquiry").default(3),
  messagesPerMinute: integer("messages_per_minute").default(20),
  autoResponseEnabled: boolean("auto_response_enabled").default(true),
  botActive: boolean("bot_active").default(true),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  keyName: text("key_name").notNull(),
  keyValue: text("key_value").notNull().unique(),
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
});

export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true,
  timestamp: true,
});

export const insertPriceResponseSchema = createInsertSchema(priceResponses).omit({
  id: true,
  timestamp: true,
});

export const insertBotConfigSchema = createInsertSchema(botConfig).omit({
  id: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
});

// Types
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type PriceResponse = typeof priceResponses.$inferSelect;
export type InsertPriceResponse = z.infer<typeof insertPriceResponseSchema>;
export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
