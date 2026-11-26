import { z } from "zod";
import { PLATFORMS, POST_STATUSES, POST_TYPES } from "./types";

export const platformSchema = z.enum(PLATFORMS);

export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Il titolo è obbligatorio").max(200),
  type: z.enum(POST_TYPES),
  platforms: z.array(platformSchema).min(1, "Scegli almeno un social"),
  captions: z.partialRecord(platformSchema, z.string().max(5000)),
  hashtags: z.array(z.string().max(100)).max(60),
  scheduledAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data non valida")
    .nullable(),
  status: z.enum(POST_STATUSES),
  imageIdea: z.string().max(5000),
  media: z.array(z.string().regex(/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/)).max(20).default([]),
  videoScript: z.string().max(10000),
  notes: z.string().max(5000),
});

export const profileSchema = z.object({
  businessName: z.string().max(200),
  businessType: z.string().max(200),
  city: z.string().max(200),
  description: z.string().max(3000),
  products: z.string().max(3000),
  audience: z.string().max(2000),
  tone: z.string().max(2000),
  hashtags: z.string().max(1000),
});
