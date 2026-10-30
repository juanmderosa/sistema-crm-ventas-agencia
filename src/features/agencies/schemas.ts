import { z } from "zod";

export const createAgencySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre.")
    .max(160, "Usá hasta 160 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Ingresá el identificador.")
    .max(80, "Usá hasta 80 caracteres.")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Usá letras sin tildes, números y guiones entre palabras.",
    ),
  arsPerUsd: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(
      z
        .string()
        .regex(
          /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/,
          "Ingresá un valor positivo con hasta 12 enteros y 6 decimales.",
        )
        .refine(
          (value) => /[1-9]/.test(value),
          "La cotización debe ser mayor que cero.",
        ),
    ),
});
export type CreateAgencyInput = z.input<typeof createAgencySchema>;
export type CreateAgencyValues = z.output<typeof createAgencySchema>;

export const agencyListSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
    is_active: z.boolean(),
    status_version: z.uuid(),
    ars_per_usd: z.string().regex(/^\d+(\.\d+)?$/),
    created_at: z.iso.datetime({ offset: true }),
  }),
);
export const agencyPageSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,5}$/)
  .transform(Number)
  .optional()
  .transform((value) => value ?? 1);
