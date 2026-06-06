import { useState, useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart } from "lucide-react";
import { getPublicStore, getPublicProducts } from "@/lib/stores.functions";
import { StoreShell } from "@/components/store-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$slug/")({
  loader: async ({ params }) => {
    const [store, products] = await Promise.all([
      getPublicStore({ data: { slug: params.slug } }),
      getPublicProducts({ data: { slug: params.slug } }),
    ]);
    if (!store) throw notFound();
    return { store, products };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.store?.store_name ?? "Store"} — StoreGen` },
      { name: "description", content: `Shop online at ${loaderData?.store?.store_name}` },
    ],
  }),
  component: StorePage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-center">
      <div>
        <h1 className="font-display text-2xl font-bold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This store doesn't exist or is inactive.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">Go to StoreGen</Link>
      </div>
    </div>
  ),
});

function StorePage() {
  const { store, products: ssrProducts } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const getProducts = useServerFn(getPublicProducts);
  const productsQ = useQuery({
    queryKey: ["public-products", slug],
    queryFn: () => getProducts({ data: { slug } }),
    initialData: ssrProducts,
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const add = useCart((s) => s.add);
  const primary = (store.theme_settings as any)?.primary ?? "#ea580c";

  const products = (productsQ.data ?? []) as any[];
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))), [products]);
  const filtered = products.filter((p) =>
    (!cat || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <StoreShell store={store}>
      {store.hero_banner ? (
        <div className="relative h-56 sm:h-72 md:h-80">
          <img src={store.hero_banner} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-0 right-0 mx-auto max-w-6xl px-4 text-white">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{store.store_name}</h1>
          </div>
        </div>
      ) : (
        <div className="px-4 py-10 text-center" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, color: "white" }}>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{store.store_name}</h1>
          <p className="mt-2 text-sm opacity-90">Quality products, fair prices.</p>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="pl-9" />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCat("")}
                className={`rounded-full border px-3 py-1 text-xs ${!cat ? "bg-foreground text-background" : "border-border"}`}
              >All</button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c as string)}
                  className={`rounded-full border px-3 py-1 text-xs ${cat === c ? "bg-foreground text-background" : "border-border"}`}
                >{c}</button>
              ))}
            </div>
          )}
        </div>

        {productsQ.isLoading ? (
          <p className="text-center text-sm text-muted-foreground">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <Card key={p.id} className="group overflow-hidden transition hover:shadow-lg">
                <Link to="/s/$slug/product/$id" params={{ slug, id: p.id }} className="block">
                  <div className="aspect-square bg-muted">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : <div className="flex h-full items-center justify-center text-muted-foreground text-xs">No image</div>}
                  </div>
                </Link>
                <div className="p-3">
                  <Link to="/s/$slug/product/$id" params={{ slug, id: p.id }} className="line-clamp-2 text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-base font-bold" style={{ color: primary }}>{formatNaira(Number(p.price))}</span>
                    {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
                      <span className="text-xs text-muted-foreground line-through">{formatNaira(Number(p.compare_at_price))}</span>
                    )}
                  </div>
                  {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      -{Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100)}%
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    style={{ background: primary }}
                    disabled={Number(p.inventory_count) <= 0}
                    onClick={() => {
                      const r = add(slug, {
                        productId: p.id, name: p.name, price: Number(p.price),
                        image: p.images?.[0], quantity: 1,
                        maxQuantity: Number(p.inventory_count) || 0,
                      });
                      if (r.ok) toast.success("Added to cart");
                      else toast.error(r.reason ?? "Couldn't add");
                    }}
                  >
                    <ShoppingCart className="mr-1 h-3 w-3" /> {Number(p.inventory_count) <= 0 ? "Sold out" : "Add"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StoreShell>
  );
}
