"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/forms/form";
import { Select } from "@/components/forms/select";
import {
  assignSuperadminSchema,
  type AssignSuperadminInput,
} from "../assignment-schemas";
import { assignAgencySuperadmin } from "../server/assignment-actions";

export function AssignSuperadminForm({
  agencyId,
  profiles,
}: {
  agencyId: string;
  profiles: { id: string; display_name: string }[];
}) {
  const [error, setError] = useState<string>();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AssignSuperadminInput>({
    resolver: zodResolver(assignSuperadminSchema),
    defaultValues: { agencyId, userId: "" },
  });
  const selectedUserId = useWatch({ control, name: "userId" });
  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedUserId,
  );

  async function handleAssignment(values: AssignSuperadminInput) {
    setError(undefined);
    try {
      const result = await assignAgencySuperadmin(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.replace(
        `/plataforma/agencias/${agencyId}/superadministrador`,
      );
    } catch {
      setError(
        "No pudimos confirmar la asignación. Revisá tu conexión y recargá la agencia antes de reintentar.",
      );
    }
  }

  const onSubmit = handleSubmit(handleAssignment);

  return (
    <Form noValidate onSubmit={onSubmit} disabled={isSubmitting}>
      <Select
        id="userId"
        label="Usuario existente"
        error={errors.userId?.message}
        aria-describedby="user-help"
        {...register("userId")}
      >
        <option value="">Seleccioná un usuario</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.display_name} — {profile.id}
          </option>
        ))}
      </Select>
      {selectedProfile && (
        <p className="access-identity" aria-live="polite">
          Usuario seleccionado: {selectedProfile.display_name}
          <br />
          ID: {selectedProfile.id}
        </p>
      )}
      <p id="user-help" className="field-help">
        Verificá el nombre y el ID: recibirá acceso de superadministrador a esta
        agencia. Se muestran usuarios con perfil registrado.
      </p>
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      <button className="auth-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Asignando…" : "Asignar superadministrador"}
      </button>
    </Form>
  );
}
