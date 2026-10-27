"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import { recoveryPasswordSchema, type RecoveryPasswordInput } from "../schemas";
import { recoverPassword } from "../server/recovery-actions";

export function RecoveryPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryPasswordInput>({
    resolver: zodResolver(recoveryPasswordSchema),
    defaultValues: { password: "", confirmation: "" },
  });
  async function handlePassword(values: RecoveryPasswordInput) {
    setError(undefined);
    try {
      const result = await recoverPassword({ ...values, token });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.replace("/login?recovered=1");
    } catch {
      setError(
        "No pudimos completar la solicitud. Si el enlace ya se utilizó, solicitá uno nuevo.",
      );
    }
  }
  const onSubmit = handleSubmit(handlePassword);
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
        {isSubmitting ? "Guardando…" : "Guardar contraseña"}
      </button>
    </Form>
  );
}
