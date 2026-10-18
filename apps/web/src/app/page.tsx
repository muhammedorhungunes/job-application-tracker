import { redirect } from "next/navigation";

// Middleware on /applications sends logged-out users on to /login.
export default function HomePage() {
  redirect("/applications");
}
