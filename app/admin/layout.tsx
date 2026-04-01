import type { ReactNode } from "react";
import { AdminProvider } from "./admin-provider";
import { AdminShell } from "./admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
