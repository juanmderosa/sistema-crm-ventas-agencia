"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/forms/form";
import { Select } from "@/components/forms/select";
import { memberRoleSchema } from "../schemas";
import { changeMemberRole } from "../server/actions";

export function MemberRoleForm({
  agencyId,
  membershipId,
  role,
  isActive,
}: {
  agencyId: string;
  membershipId: string;
  role: "admin" | "seller";
  isActive: boolean;
}) {
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<z.infer<typeof memberRoleSchema>>({
    resolver: zodResolver(memberRoleSchema),
    defaultValues: {
      agencyId,
      membershipId,
      role,
      expectedRole: role,
      expectedIsActive: isActive,
    },
  });
  async function handleChange(values: z.infer<typeof memberRoleSchema>) {
    setError(undefined);
    try {
      const result = await changeMemberRole(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.reload();
    } catch {
      setError("No pudimos confirmar el rol. Recargá para comprobarlo.");
    }
  }
  const onSubmit = handleSubmit(handleChange);
  return (
    <div className="agency-actions">
      <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
        <Select
          id={`role-${membershipId}`}
          label="Nuevo rol"
          error={errors.role?.message}
          {...register("role")}
        >
          <option value="seller">Vendedor</option>
          <option value="admin">Administrador</option>
        </Select>
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
          {isSubmitting ? "Guardando…" : "Guardar rol"}
        </button>
      </Form>
    </div>
  );
}
