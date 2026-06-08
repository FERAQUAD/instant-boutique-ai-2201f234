import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ShoppingCart, ChevronLeft, Minus, Plus } from "lucide-react";
import { getPublicProduct, getPublicStore } from "@/lib/stores.functions";
import { StoreShell } from "@/components/store-shell";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/s/$slug/product/$id")({
  loader: async ({ params }) => {
    const [store, product] = await Promise.all([
      getPublicStore({ data: { slug: params.slug } }),
      getPublicProduct({ data: { slug: params.slug, productId: params.id } }),
    ]);
    if (!store || !product) throw notFound();
    return { store, product };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.product?.name ?? "Product"} — ${loaderData?.store?.store_name ?? "Store"}` }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { store, product } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const primary = (store.theme_settings as any)?.primary ?? "#ea580c";
  const images: string[] = product.images ?? [];
  const sizes: string[] = (product as any).sizes ?? [];
  const colors: string[] = (product as any).colors ?? [];
  const [size, setSize] = useState<string>(sizes[0] ?? "");
  const [color, setColor] = useState<string>(colors[0] ?? "");

  return (
    <StoreShell store={store}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link to="/s/$slug" params={{ slug }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to store
        </Link>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-lg bg-muted">
              {images[imgIdx] ? (
                <img src={images[imgIdx]} alt={product.name} loading="eager" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={img}
                    onClick={() => setImgIdx(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 ${i === imgIdx ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{product.name}</h1>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-3xl font-bold" style={{ color: primary }}>{formatNaira(Number(product.price))}</span>
              {product.compare_at_price && Number(product.compare_at_price) > Number(product.price) && (
                <span className="text-lg text-muted-foreground line-through">{formatNaira(Number(product.compare_at_price))}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {product.inventory_count > 0 ? `${product.inventory_count} in stock` : "Out of stock"}
            </p>

            {product.description && (
              <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {product.description}
              </div>
            )}


            {sizes.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`min-w-10 rounded-md border px-3 py-1.5 text-sm transition ${size === s ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Color</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition ${color === c ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}
                    >{c}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center rounded-md border border-border">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2"><Minus className="h-3 w-3" /></button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-3 py-2"><Plus className="h-3 w-3" /></button>
              </div>
              <Button
                className="flex-1 h-12"
                style={{ background: primary }}
                disabled={product.inventory_count === 0}
                onClick={() => {
                  const variant = [size, color].filter(Boolean).join(" / ");
                  const r = add(slug, {
                    productId: product.id,
                    name: variant ? `${product.name} (${variant})` : product.name,
                    price: Number(product.price),
                    image: images[0], quantity: qty,
                    maxQuantity: Number(product.inventory_count) || 0,
                  });
                  if (r.ok) toast.success("Added to cart");
                  else toast.error(r.reason ?? "Couldn't add");
                }}
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> Add to cart
              </Button>
            </div>
          </div>
        </div>
      </div>
    </StoreShell>
  );
}
