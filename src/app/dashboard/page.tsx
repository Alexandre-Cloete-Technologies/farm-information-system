import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardHeader, VendorStrip } from "@/components/DashboardHeader";
import { AgronomistView } from "@/components/views/AgronomistView";
import { BankView } from "@/components/views/BankView";
import { FarmerView } from "@/components/views/FarmerView";
import { getFarmSnapshot } from "@/lib/data/getFarmSnapshot";
import { createClient } from "@/lib/supabase/server";
import {
  LAST_ROLE_COOKIE,
  hasSessionCookie,
  isAuthUnreachable,
  parseRole,
} from "@/lib/supabase/offline";
import type { Profile } from "@/lib/data/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();

  let user = null;
  let unreachable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    unreachable = isAuthUnreachable(error);
  } catch {
    unreachable = true;
  }

  const carriesSession = hasSessionCookie(cookieStore.getAll());
  if (!user && !(unreachable && carriesSession)) redirect("/login");

  const { data: profileRow } = user
    ? await supabase
        .from("profiles")
        .select("id, display_name, role, organisation")
        .eq("id", user.id)
        .single()
    : { data: null };

  // Two degraded paths, both of which keep the demo on screen: a signed-in user
  // with no profile row, and a session we can't currently verify because
  // Supabase is unreachable. In the second case the role comes from the cookie
  // the login page wrote, so the presenter keeps the view they signed in for.
  const profile: Profile = profileRow ?? {
    id: user?.id ?? "offline",
    display_name: user?.email ?? "Demo user",
    role: parseRole(cookieStore.get(LAST_ROLE_COOKIE)?.value),
    organisation: null,
  };

  const snapshot = await getFarmSnapshot();

  return (
    <>
      <DashboardHeader profile={profile} snapshot={snapshot} />
      <VendorStrip snapshot={snapshot} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {profile.role === "agronomist" ? (
          <AgronomistView snapshot={snapshot} />
        ) : profile.role === "bank_officer" ? (
          <BankView snapshot={snapshot} />
        ) : (
          <FarmerView snapshot={snapshot} />
        )}
      </main>
    </>
  );
}
