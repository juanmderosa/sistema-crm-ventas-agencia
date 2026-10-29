"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import {
  recoveryPasswordSchema,
  type RecoveryPasswordInput,
} from "@/features/auth/schemas";
import { acceptInvitationWithPassword } from "../server/actions";

export function AcceptInvitationForm({
  invitationId,
  token,
  kind = "superadmin",
}: {
  invitationId: string;
  token: string;
  kind?: "superadmin" | "agency-user";
}) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryPasswordInput>({
    resolver: zodResolver(recoveryPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });
  async function handleAccept(values: RecoveryPasswordInput) {
    setError(undefined);
    try {
      const result = await acceptInvitationWithPassword({
        ...values,
        invitationId,
        token,
        kind,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.replace("/login?invited=1");
    } catch {
      setError(
        "No se pudo confirmar la aceptación. Si ya definiste contraseña, ingresá y completá desde este enlace.",
      );
    }
  }
  const onSubmit = handleSubmit(handleAccept);
  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Input
        id="password"
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={1024}
        error={errors.password?.message}
        {...register("password")}
      />
      <Input
        id="confirmation"
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={1024}
        error={errors.confirmation?.message}
        {...register("confirmation")}
      />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button className="auth-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Aceptando…" : "Definir contraseña y aceptar"}
      </button>
    </Form>
  );
}
