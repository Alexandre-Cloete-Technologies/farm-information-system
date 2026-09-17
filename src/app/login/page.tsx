import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

/**
 * Bounces an already-signed-in visitor straight to their dashboard.
 *
 * This used to live in Next middleware, but @netlify/plugin-nextjs can't bundle
 * a Next 16 middleware into an edge function, so every route now gates itself.
 * See the README's "No middleware" note.
 */
export default async function LoginPage() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  } catch (error) {
    // `redirect()` throws by design — let that through. Anything else means we
    // couldn't reach Supabase, in which case showing the form is the right call.
    if (error && typeof error === "object" && "digest" in error) throw error;
  }

  return <LoginForm />;
}
