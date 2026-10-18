import type { ReactNode } from "react";

/** Label + control + first validation error. Native `<label>` instead of shadcn's Radix-based Label (no extra dependency). */
export function FormField({
  id,
  label,
  errors,
  children,
}: {
  id: string;
  label: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {errors?.[0] && <p className="text-sm text-red-600">{errors[0]}</p>}
    </div>
  );
}
