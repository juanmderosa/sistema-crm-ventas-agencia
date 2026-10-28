"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Input } from "@/components/forms/input";
import { loginSchema, type LoginInput } from "../schemas";
import { login } from "../server/actions";

export function LoginForm() {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function handleLogin(values: LoginInput) {
    setError(undefined);
    try {
      const result = await login(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // A full navigation discards any previous in-memory private state.
      window.location.replace("/panel");
    } catch {
      setError("No pudimos conectar. Revisá tu conexión y volvé a intentar.");
    }
  }

  const onSubmit = handleSubmit(handleLogin);

  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Input
        id="email"
        label="Correo electrónico"
        type="email"
        autoComplete="username"
        maxLength={254}
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        id="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        maxLength={1024}
        error={errors.password?.message}
        {...register("password")}
      />
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button type="submit" className="auth-button" disabled={isSubmitting}>
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </button>
    </Form>
  );
}
