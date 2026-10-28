"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import {
  createAgencySchema,
  type CreateAgencyInput,
  type CreateAgencyValues,
} from "../schemas";
import { createAgency } from "../server/actions";

export function CreateAgencyForm() {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAgencyInput, unknown, CreateAgencyValues>({
    resolver: zodResolver(createAgencySchema),
    defaultValues: { name: "", slug: "", arsPerUsd: "" },
  });
  async function handleCreate(values: CreateAgencyValues) {
    setError(undefined);
    try {
      const result = await createAgency(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.replace("/plataforma/agencias");
    } catch {
      setError(
        "No pudimos confirmar el alta. Revisá tu conexión y recargá el listado antes de reintentar.",
      );
    }
  }
  const onSubmit = handleSubmit(handleCreate);
  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Input
        id="name"
        label="Nombre de la agencia"
        maxLength={160}
        autoComplete="organization"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        id="slug"
        label="Identificador (slug)"
        maxLength={80}
        autoComplete="off"
        aria-describedby="slug-help"
        error={errors.slug?.message}
        {...register("slug")}
      />
      <p id="slug-help" className="field-help">
        Ejemplo: agencia-centro. Es único y se usará en la dirección pública de
        la agencia.
      </p>
      <Input
        id="arsPerUsd"
        label="Cotización ARS por USD"
        inputMode="decimal"
        maxLength={19}
        aria-describedby="rate-help"
        error={errors.arsPerUsd?.message}
        {...register("arsPerUsd")}
      />
      <p id="rate-help" className="field-help">
        Cuántos pesos equivalen a un dólar. Mayor que cero, con hasta seis
        decimales.
      </p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button type="submit" className="auth-button" disabled={isSubmitting}>
        {isSubmitting ? "Creando…" : "Crear agencia"}
      </button>
    </Form>
  );
}
