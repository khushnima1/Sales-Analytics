import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const salesData = pgTable("sales_data", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  maker: text("maker").notNull().default(''),
  rto: text("rto").notNull().default(''),
  district: text("district").notNull().default(''),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  sales2022: integer("sales2022").notNull().default(0),
  sales2023: integer("sales2023").notNull().default(0),
  sales2024: integer("sales2024").notNull().default(0),
  sales2025: integer("sales2025").notNull().default(0),
  total: integer("total").notNull().default(0),
});

export const insertSalesDataSchema = createInsertSchema(salesData).omit({
  id: true,
});

export type InsertSalesData = z.infer<typeof insertSalesDataSchema>;
export type SalesData = typeof salesData.$inferSelect;

// File upload schema
export const fileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  size: z.number(),
});

export type FileUpload = z.infer<typeof fileUploadSchema>;
