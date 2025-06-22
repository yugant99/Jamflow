import { z } from "zod";

const strongPasswordValidation = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .max(128, "Password must not exceed 128 characters")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Password must contain at least one number",
  })
  .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
    message: "Password must contain at least one special character",
  });

export const signUpSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email format"),
  password: strongPasswordValidation,
});

export const signInSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: strongPasswordValidation,
});

export const changePasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(6, "Old password must be at least 6 characters long")
    .max(128, "Old password must not exceed 128 characters")
    .refine((val) => /[A-Z]/.test(val), {
      message: "Old password must contain at least one uppercase letter",
    })
    .refine((val) => /[a-z]/.test(val), {
      message: "Old password must contain at least one lowercase letter",
    })
    .refine((val) => /[0-9]/.test(val), {
      message: "Old password must contain at least one number",
    })
    .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
      message: "Old password must contain at least one special character",
    }),

  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters long")
    .max(128, "New password must not exceed 128 characters")
    .refine((val) => /[A-Z]/.test(val), {
      message: "New password must contain at least one uppercase letter",
    })
    .refine((val) => /[a-z]/.test(val), {
      message: "New password must contain at least one lowercase letter",
    })
    .refine((val) => /[0-9]/.test(val), {
      message: "New password must contain at least one number",
    })
    .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
      message: "New password must contain at least one special character",
    }),
});
