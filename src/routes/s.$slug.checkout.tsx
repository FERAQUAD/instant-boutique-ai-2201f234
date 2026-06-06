import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { getPublicStore } from "@/lib/stores.functions";
import { createGuestOrder } from "@/lib/orders.functions";
import { StoreShell } from "@/components/store-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { useCart, cartTotal } from "@/lib/cart";

export const Route = createFileRoute("/s/$slug/checkout")({
  loader: async ({ params }) => {
    const store = await getPublicStore({ data: { slug: params.slug } });
    if (!store) throw notFound();
    return { store };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Checkout — ${loaderData?.store?.store_name}` }] }),
  component: Checkout,
});

function Checkout() {
  const { store } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const placeOrder = useServerFn(createGuestOrder);
  const items = useCart((s) => s.itemsBySlug[slug]) ?? [];
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const primary = (store.theme_settings as any)?.primary ?? "#ea580c";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const total = cartTotal(items);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    setSubmitting(true);
    try {
      const res = await placeOrder({
        data: {
          store_slug: slug,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          shipping_address: { line1, city, state, country: "Nigeria" },
          notes,
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        },
      });
      clear(slug);
      toast.success("Order placed!");
      navigate({ to: "/s/$slug/order/$id", params: { slug, id: res.orderId } });
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    }
    finally { setSubmitting(false); }
  }

  if (items.length === 0) {
    return (
      <StoreShell store={store}>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-3 font-display text-2xl font-bold">Your cart is empty</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add products to get started.</p>
          <Button asChild className="mt-6" style={{ background: primary }}>
            <Link to="/s/$slug" params={{ slug }}>Browse products</Link>
          </Button>
        </div>
      </StoreShell>
    );
  }

  return (
    <StoreShell store={store}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold">Checkout</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="space-y-4 p-6 lg:col-span-2">
            <h2 className="font-display font-bold">Your items</h2>
            {items.map((it) => (
              <div key={it.productId} className="flex gap-4 border-b border-border pb-4 last:border-0">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                  {it.image && <img src={it.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{it.name}</p>
                  <p className="text-sm" style={{ color: primary }}>{formatNaira(it.price)}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-border">
                      <button onClick={() => setQty(slug, it.productId, it.quantity - 1)} className="px-2 py-1"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-xs">{it.quantity}</span>
                      <button
                        onClick={() => {
                          const r = setQty(slug, it.productId, it.quantity + 1);
                          if (!r.ok) toast.error(r.reason ?? "Limit reached");
                        }}
                        className="px-2 py-1"
                      ><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => remove(slug, it.productId)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="font-display font-bold">{formatNaira(it.price * it.quantity)}</p>
              </div>
            ))}

            <form onSubmit={submit} id="checkout-form" className="space-y-4 pt-2">
              <h2 className="font-display font-bold">Delivery details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2"><Label>Full name *</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Email *</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Address *</Label><Input required value={line1} onChange={(e) => setLine1(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>City *</Label><Input required value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>State *</Label><Input required value={state} onChange={(e) => setState(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Notes (optional)</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
            </form>
          </Card>

          <Card className="h-fit space-y-3 p-6">
            <h2 className="font-display font-bold">Order summary</h2>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatNaira(total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span>Calculated by seller</span></div>
            <div className="flex justify-between border-t border-border pt-3 font-display text-lg font-bold">
              <span>Total</span><span>{formatNaira(total)}</span>
            </div>
            <Button
              type="submit"
              form="checkout-form"
              className="h-12 w-full"
              style={{ background: primary }}
              disabled={submitting}
            >
              {submitting ? "Placing order…" : "Place order"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              The seller will contact you to confirm payment & delivery.
            </p>
          </Card>
        </div>
      </div>
    </StoreShell>
  );
}
