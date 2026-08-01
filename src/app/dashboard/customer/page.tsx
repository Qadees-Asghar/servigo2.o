import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/ui";
import CustomerDashboard from "./CustomerDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = (await getSession())!;

  return (
    <>
      <TopBar
        name={session.fullName}
        role="Customer"
        links={[
          { href: "#browse", label: "Browse services" },
          { href: "#bookings", label: "My bookings" },
          { href: "#alerts", label: "Notifications" },
        ]}
      />
      <CustomerDashboard />
    </>
  );
}
