import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = ComponentPropsWithRef<"input"> & {
  id: string;
  label: string;
  error?: string;
};

export function Input({
  id,
  label,
  error,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: InputProps) {
  const errorId = `${id}-error`;
  const descriptionIds =
    [describedBy, error ? errorId : undefined].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        className={cn("form-input", className)}
        aria-invalid={error ? true : invalid}
        aria-describedby={descriptionIds}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
