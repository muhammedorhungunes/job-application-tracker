import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

export default function ApplicationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">{children}</main>
    </div>
  );
}
