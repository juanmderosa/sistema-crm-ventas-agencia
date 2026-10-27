import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email("Ingresá un correo válido.")),
  password: z
    .string()
    .min(1, "Ingresá tu contraseña.")
    .max(1024, "La contraseña es demasiado larga."),
});

export type LoginInput = z.infer<typeof loginSchema>;
