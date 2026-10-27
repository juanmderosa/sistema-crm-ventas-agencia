import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email("Ingresá un correo válido.")),
  password: z
    .string()
    .min(1, "Ingresá tu contraseña.")
    .max(1024, "La contraseña es demasiado larga."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const recoveryEmailSchema = loginSchema.pick({ email: true });
export const recoveryTokenSchema = z.string().regex(/^[a-f0-9]{56}$/);
export const recoveryOriginSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    value === url.origin &&
    !url.username &&
    !url.password &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)))
  );
});
export const recoveryPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Usá al menos ocho caracteres.")
      .max(1024, "La contraseña es demasiado larga."),
    confirmation: z.string().max(1024),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Las contraseñas no coinciden.",
  });
export const recoverySubmissionSchema = recoveryPasswordSchema.safeExtend({
  token: recoveryTokenSchema,
});
export type RecoveryEmailInput = z.infer<typeof recoveryEmailSchema>;
export type RecoveryPasswordInput = z.infer<typeof recoveryPasswordSchema>;
