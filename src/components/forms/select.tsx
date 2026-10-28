import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

type SelectProps = ComponentPropsWithRef<"select"> & {
  id: string;
  label: string;
  error?: string;
};

export function Select({
  id,
  label,
  error,
  className,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: SelectProps) {
  const errorId = `${id}-error`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <select
        {...props}
        id={id}
        className={cn("form-input", className)}
        aria-invalid={error ? true : invalid}
        aria-describedby={
          [describedBy, error ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
