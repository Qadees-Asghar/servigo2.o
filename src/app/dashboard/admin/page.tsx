import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/ui";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = (await getSession())!;

  return (
    <>
      <TopBar
        name={session.fullName}
        role="Administrator"
        links={[
          { href: "#providers", label: "Providers" },
          { href: "#users", label: "Users" },
          { href: "#reports", label: "Reports" },
          { href: "#audit", label: "Audit log" },
        ]}
      />
      <AdminDashboard />
    </>
  );
}
