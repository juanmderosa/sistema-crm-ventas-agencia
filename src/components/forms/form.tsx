"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

type FormProps = ComponentPropsWithoutRef<"form"> & { disabled?: boolean };

export function Form({
  className,
  children,
  disabled = false,
  ...props
}: FormProps) {
  const hydrated = useHydrated();
  return (
    <form {...props} className={cn("form", className)}>
      <fieldset className="form-fields" disabled={!hydrated || disabled}>
        {children}
      </fieldset>
    </form>
  );
}
