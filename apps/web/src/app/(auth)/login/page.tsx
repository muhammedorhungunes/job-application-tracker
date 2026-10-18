import { AuthForm } from "@/components/auth-form";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" action={login} />
    </main>
  );
}
