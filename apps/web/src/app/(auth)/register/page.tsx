import { AuthForm } from "@/components/auth-form";
import { register } from "../actions";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <AuthForm mode="register" action={register} />
    </main>
  );
}
