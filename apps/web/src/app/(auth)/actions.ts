"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginInputSchema, RegisterInputSchema } from "@job-tracker/types";
import { ApiError, apiFetch, apiFetchWithCookies } from "@/lib/api-client";
import { buildAuthCookieHeader } from "@/lib/auth-cookies";
import type { FormState } from "@/lib/form-state";
import { clearAuthCookies, storeAuthCookies } from "@/lib/session";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { setCookies } = await apiFetchWithCookies<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    await storeAuthCookies(setCookies);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { error: "Invalid email or password" };
    }
    return { error: GENERIC_ERROR };
  }

  redirect("/applications");
}

export async function register(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = RegisterInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { setCookies } = await apiFetchWithCookies<unknown>("/auth/register", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    await storeAuthCookies(setCookies);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { error: "Email already registered" };
    }
    return { error: GENERIC_ERROR };
  }

  redirect("/applications");
}

export async function logout(): Promise<void> {
  // Not serverApiFetch: its 401 -> /login redirect would skip clearing the
  // local cookies below. The local session is cleared whatever the API says.
  const store = await cookies();
  const cookieHeader = buildAuthCookieHeader((name) => store.get(name)?.value);
  if (cookieHeader) {
    await apiFetch("/auth/logout", { method: "POST", headers: { Cookie: cookieHeader } }).catch(() => undefined);
  }
  await clearAuthCookies();
  redirect("/login");
}
