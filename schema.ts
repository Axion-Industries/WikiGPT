import { pgTable, text, serial, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // For storing additional data like sources, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Browser fingerprint or session ID
  autoScroll: boolean("auto_scroll").default(true),
  typingIndicators: boolean("typing_indicators").default(true),
  saveHistory: boolean("save_history").default(true),
  responseStyle: text("response_style").default("balanced"), // 'concise' | 'balanced' | 'detailed'
  darkMode: boolean("dark_mode").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;

// Client-side types for local storage
export interface LocalChatSession {
  id: string;
  title: string;
  messages: LocalChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    sources?: string[];
    searchQuery?: string;
    processingTime?: number;
  };
  timestamp: string;
}

export interface WikipediaSearchResult {
  title: string;
  snippet: string;
  pageid: number;
  size: number;
  wordcount: number;
  timestamp: string;
}

export interface WikipediaArticle {
  title: string;
  extract: string;
  url: string;
  categories?: string[];
  wordCount: number;
}
