import { createFileRoute, redirect } from "@tanstack/react-router";

import { DashboardPanel } from "../components/DashboardPanel";

function DashboardRoute() {
  return <DashboardPanel />;
}

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context, location }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: DashboardRoute,
});
