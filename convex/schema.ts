import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),

  users: defineTable({
    tokenIdentifier: v.string(),
    theme: v.union(
      v.literal("system"),
      v.literal("light"),
      v.literal("dark"),
    ),
    onboardingComplete: v.boolean(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});
