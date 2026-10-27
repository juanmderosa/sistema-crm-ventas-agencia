"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import { recoveryEmailSchema, type RecoveryEmailInput } from "../schemas";
import { requestPasswordRecovery } from "../server/recovery-actions";

export function RecoveryEmailForm() {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoveryEmailInput>({
    resolver: zodResolver(recoveryEmailSchema),
    defaultValues: { email: "" },
  });

  async function handleRecovery(values: RecoveryEmailInput) {
    setError(undefined);
    try {
      const result = await requestPasswordRecovery(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    } catch {
      setError("No pudimos conectar. Revisá tu conexión y volvé a intentar.");
    }
  }
  const onSubmit = handleSubmit(handleRecovery);

  if (sent)
    return (
      <p role="status">
        Si existe una cuenta con ese correo, recibirás un enlace para cambiar la
        contraseña. Revisá también el correo no deseado.
      </p>
    );

  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Input
        id="email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        maxLength={254}
        error={errors.email?.message}
        {...register("email")}
      />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button className="auth-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Solicitando…" : "Enviar enlace"}
      </button>
    </Form>
  );
}
