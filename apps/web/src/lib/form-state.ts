/** Shape returned by server actions driven through `useActionState`. */
export interface FormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
}

export const initialFormState: FormState = {};
