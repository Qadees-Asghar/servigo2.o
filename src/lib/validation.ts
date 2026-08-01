import { z } from "zod";

/**
 * Validation rules ported one-for-one from Helpers/ValidationHelper.cs
 * so that SERVIGO 2.0 accepts exactly the same data as the desktop app.
 */

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, "Full name must be at least 3 characters.")
  .max(100, "Full name is too long.")
  .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Enter a valid email address.");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^0[0-9]{10}$/, "Phone must be 11 digits and start with 0.");

export const cnicSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{13}$/, "CNIC must be exactly 13 digits.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.")
  .regex(/[a-zA-Z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one digit.");

export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    cnic: cnicSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(["customer", "provider"]),
    categoryId: z.coerce.number().int().positive().optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((d) => d.role !== "provider" || typeof d.categoryId === "number", {
    message: "Service providers must pick a category.",
    path: ["categoryId"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const adminSetupSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    cnic: cnicSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    setupToken: z.string().min(16, "Setup token looks invalid."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const serviceSchema = z.object({
  serviceName: z.string().trim().min(3).max(150),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().nonnegative().max(9_999_999),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
});

export const slotSchema = z
  .object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid end time."),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export const bookingSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
});

export const ratingSchema = z.object({
  bookingId: z.coerce.number().int().positive(),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const feedbackSchema = z.object({
  reportType: z.enum(["Complaint", "Feedback", "Bug", "Other"]),
  targetUserId: z.string().trim().max(20).optional(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(1000),
});

/** Turns a ZodError into a flat { field: message } map for the UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
