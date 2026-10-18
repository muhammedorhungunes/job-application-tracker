"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialFormState, type FormState } from "@/lib/form-state";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {isRegister && (
        <FormField id="name" label="Name" errors={state.fieldErrors?.name}>
          <Input id="name" name="name" autoComplete="name" required />
        </FormField>
      )}
      <FormField id="email" label="Email" errors={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField id="password" label="Password" errors={state.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={isRegister ? 8 : undefined}
          required
        />
      </FormField>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Please wait..." : isRegister ? "Create account" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? "Already have an account? " : "No account yet? "}
        <Link href={isRegister ? "/login" : "/register"} className="underline">
          {isRegister ? "Log in" : "Register"}
        </Link>
      </p>
    </form>
  );
}
