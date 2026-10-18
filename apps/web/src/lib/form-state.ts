import type { ZodError } from "zod";

/** Shape returned by server actions driven through `useActionState`. */
export interface FormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  message?: string;
  /**
   * The submitted values, echoed back on a validation error: React 19 resets
   * uncontrolled form fields after an action, which would otherwise wipe
   * what the user typed.
   */
  values?: Record<string, string>;
}

export const initialFormState: FormState = {};

export function formStateFromZodError(error: ZodError, formData?: FormData): FormState {
  const { fieldErrors, formErrors } = error.flatten();
  return {
    fieldErrors,
    error: formErrors[0],
    values: formData ? formDataToValues(formData) : undefined,
  };
}

function formDataToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") values[key] = value;
  });
  return values;
}
