"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import { inviteSuperadminSchema, type InviteSuperadminInput } from "../schemas";
import { inviteSuperadmin } from "../server/actions";

export function InviteForm({ agencyId }: { agencyId: string }) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteSuperadminInput>({
    resolver: zodResolver(inviteSuperadminSchema),
    defaultValues: { agencyId, email: "", displayName: "" },
  });
  async function handleInvite(values: InviteSuperadminInput) {
    setError(undefined);
    try {
      const result = await inviteSuperadmin(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.replace(`/plataforma/agencias/${agencyId}/invitar`);
    } catch {
      setError(
        "No pudimos confirmar el envío. Recargá el estado de la invitación antes de reintentar.",
      );
    }
  }
  const onSubmit = handleSubmit(handleInvite);
  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Input
        id="displayName"
        label="Nombre del invitado"
        autoComplete="name"
        maxLength={160}
        error={errors.displayName?.message}
        {...register("displayName")}
      />
      <Input
        id="email"
        label="Correo del invitado"
        type="email"
        autoComplete="email"
        maxLength={254}
        error={errors.email?.message}
        {...register("email")}
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="auth-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar invitación"}
      </button>
    </Form>
  );
}
