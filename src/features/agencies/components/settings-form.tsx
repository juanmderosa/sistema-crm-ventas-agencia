"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import {
  agencySettingsSchema,
  type AgencySettingsInput,
  type AgencySettingsValues,
} from "../settings-schemas";
import { saveAgencySettings } from "../server/settings-actions";
export function AgencySettingsForm({
  values,
}: {
  values: AgencySettingsInput;
}) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AgencySettingsInput, unknown, AgencySettingsValues>({
    resolver: zodResolver(agencySettingsSchema),
    defaultValues: values,
  });
  async function handleSave(input: AgencySettingsValues) {
    setError(undefined);
    try {
      const result = await saveAgencySettings(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    } catch {
      setError(
        "No pudimos confirmar el cambio. Recargá para revisar los datos antes de reintentar.",
      );
    }
  }
  const onSubmit = handleSubmit(handleSave);
  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Input
        id="name"
        label="Nombre de la agencia"
        autoComplete="organization"
        maxLength={160}
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        id="arsPerUsd"
        label="Cotización ARS por USD"
        inputMode="decimal"
        maxLength={19}
        aria-describedby="settings-rate-help"
        error={errors.arsPerUsd?.message}
        {...register("arsPerUsd")}
      />
      <p id="settings-rate-help" className="field-help">
        Pesos por un dólar. Mayor que cero, hasta doce enteros y seis decimales.
      </p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button
        className="auth-button"
        type="submit"
        disabled={!isDirty || isSubmitting}
      >
        {isSubmitting ? "Guardando…" : "Guardar configuración"}
      </button>
    </Form>
  );
}
