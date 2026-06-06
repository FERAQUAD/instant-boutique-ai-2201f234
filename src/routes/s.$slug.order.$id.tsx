import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { getPublicStore } from "@/lib/stores.functions";
import { StoreShell } from "@/components/store-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$slug/order/$id")({
  loader: async ({ params }) => {
    const store = await getPublicStore({ data: { slug: params.slug } });
    if (!store) throw notFound();
    return { store };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `Order confirmed — ${loaderData?.store?.store_name ?? ""}` }],
  }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { store } = Route.useLoaderData();
  const { slug, id } = Route.useParams();
  const primary = (store.theme_settings as any)?.primary ?? "#ea580c";
  return (
    <StoreShell store={store}>
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: primary }} />
          <h1 className="mt-4 font-display text-2xl font-bold">Order placed!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you for your order. The seller will reach out shortly to confirm payment and delivery details.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Reference: <span className="font-mono">{id.slice(0, 8).toUpperCase()}</span>
          </p>
          <Button asChild className="mt-6" style={{ background: primary }}>
            <Link to="/s/$slug" params={{ slug }}>Continue shopping</Link>
          </Button>
        </Card>
      </div>
    </StoreShell>
  );
}
