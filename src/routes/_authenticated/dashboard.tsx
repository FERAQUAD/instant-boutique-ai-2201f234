import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Package, ShoppingBag, DollarSign, Clock, ArrowRight, Plus } from "lucide-react";
import { getMyStore, getDashboardStats } from "@/lib/stores.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StoreGen" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const getStore = useServerFn(getMyStore);
  const getStats = useServerFn(getDashboardStats);

  const storeQ = useQuery({ queryKey: ["my-store"], queryFn: () => getStore({}) });
  const statsQ = useQuery({
    queryKey: ["dash-stats"],
    queryFn: () => getStats({}),
    enabled: !!storeQ.data,
  });

  useEffect(() => {
    if (storeQ.isSuccess && !storeQ.data) navigate({ to: "/onboarding" });
  }, [storeQ.isSuccess, storeQ.data]);

  if (storeQ.isLoading || !storeQ.data) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const s = statsQ.data;
  const stats = [
    { label: "Products", value: s?.products ?? 0, icon: Package, color: "text-primary" },
    { label: "Total Orders", value: s?.orders ?? 0, icon: ShoppingBag, color: "text-blue-600" },
    { label: "Revenue", value: formatNaira(s?.revenue ?? 0), icon: DollarSign, color: "text-success" },
    { label: "Pending", value: s?.pending ?? 0, icon: Clock, color: "text-warning" },
  ];

  return (
    <DashboardShell storeSlug={storeQ.data.store_slug} storeName={storeQ.data.store_name}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Welcome back 👋</h2>
            <p className="text-sm text-muted-foreground">Here's what's happening with your store.</p>
          </div>
          <Button asChild>
            <Link to="/products" search={{ new: "1" }}><Plus className="mr-1 h-4 w-4" /> Add product</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((st) => (
            <Card key={st.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{st.label}</span>
                <st.icon className={`h-4 w-4 ${st.color}`} />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{st.value}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="font-display text-lg font-bold">Your storefront is live</h3>
          <p className="mt-1 text-sm text-muted-foreground">Share this link with your customers.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
            <code className="flex-1 truncate text-sm">{typeof window !== "undefined" ? window.location.origin : ""}/s/{storeQ.data.store_slug}</code>
            <Button asChild variant="outline" size="sm">
              <a href={`/s/${storeQ.data.store_slug}`} target="_blank" rel="noreferrer">
                Open <ArrowRight className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
