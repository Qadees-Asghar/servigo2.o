import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/ui";
import ProviderDashboard from "./ProviderDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = (await getSession())!;

  return (
    <>
      <TopBar
        name={session.fullName}
        role="Service provider"
        links={[
          { href: "#requests", label: "Requests" },
          { href: "#services", label: "My services" },
          { href: "#slots", label: "Availability" },
        ]}
      />
      <ProviderDashboard />
    </>
  );
}
