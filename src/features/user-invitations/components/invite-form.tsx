"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { inviteAgencyUserSchema, type InviteAgencyUserInput } from "../schemas";
import { inviteAgencyUser } from "../server/actions";

export function AgencyUserInviteForm({
  agencyId,
  canInviteAdmins,
}: {
  agencyId: string;
  canInviteAdmins: boolean;
}) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteAgencyUserInput>({
    resolver: zodResolver(inviteAgencyUserSchema),
    defaultValues: { agencyId, role: "seller", displayName: "", email: "" },
  });

  async function handleInvite(values: InviteAgencyUserInput) {
    setError(undefined);
    try {
      const result = await inviteAgencyUser(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.replace(`/panel/usuarios?agency=${agencyId}`);
    } catch {
      setError(
        "No pudimos confirmar el envío. Recargá el estado antes de reintentar.",
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
      <Select
        id="role"
        label="Rol"
        error={errors.role?.message}
        {...register("role")}
      >
        <option value="seller">Vendedor</option>
        {canInviteAdmins && <option value="admin">Administrador</option>}
      </Select>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button className="auth-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar invitación"}
      </button>
    </Form>
  );
}
