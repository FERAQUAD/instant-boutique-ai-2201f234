import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  maxQuantity?: number;
};

type CartState = {
  itemsBySlug: Record<string, CartItem[]>;
  add: (slug: string, item: CartItem) => { ok: boolean; reason?: string };
  remove: (slug: string, productId: string) => void;
  setQty: (slug: string, productId: string, qty: number) => { ok: boolean; reason?: string };
  clear: (slug: string) => void;
};

function clampQty(qty: number, max?: number) {
  const q = Math.max(1, Math.floor(qty));
  if (typeof max === "number") return Math.min(q, Math.max(1, max));
  return q;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      itemsBySlug: {},
      add: (slug, item) => {
        const existing = get().itemsBySlug[slug] ?? [];
        const found = existing.find((i) => i.productId === item.productId);
        const max = item.maxQuantity ?? found?.maxQuantity;
        const desired = (found?.quantity ?? 0) + item.quantity;
        if (typeof max === "number" && max <= 0) {
          return { ok: false, reason: "Out of stock" };
        }
        if (typeof max === "number" && desired > max) {
          set((s) => ({
            itemsBySlug: {
              ...s.itemsBySlug,
              [slug]: found
                ? existing.map((i) => i.productId === item.productId ? { ...i, quantity: max, maxQuantity: max } : i)
                : [...existing, { ...item, quantity: max }],
            },
          }));
          return { ok: false, reason: `Only ${max} in stock` };
        }
        set((s) => {
          const e = s.itemsBySlug[slug] ?? [];
          const f = e.find((i) => i.productId === item.productId);
          const next = f
            ? e.map((i) => i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity, maxQuantity: max ?? i.maxQuantity } : i)
            : [...e, item];
          return { itemsBySlug: { ...s.itemsBySlug, [slug]: next } };
        });
        return { ok: true };
      },
      remove: (slug, productId) =>
        set((s) => ({
          itemsBySlug: {
            ...s.itemsBySlug,
            [slug]: (s.itemsBySlug[slug] ?? []).filter((i) => i.productId !== productId),
          },
        })),
      setQty: (slug, productId, qty) => {
        const item = (get().itemsBySlug[slug] ?? []).find((i) => i.productId === productId);
        const max = item?.maxQuantity;
        const clamped = clampQty(qty, max);
        const hit = typeof max === "number" && qty > max;
        set((s) => ({
          itemsBySlug: {
            ...s.itemsBySlug,
            [slug]: (s.itemsBySlug[slug] ?? [])
              .map((i) => (i.productId === productId ? { ...i, quantity: clamped } : i))
              .filter((i) => i.quantity > 0),
          },
        }));
        return hit ? { ok: false, reason: `Only ${max} in stock` } : { ok: true };
      },
      clear: (slug) =>
        set((s) => ({ itemsBySlug: { ...s.itemsBySlug, [slug]: [] } })),
    }),
    { name: "storegen-cart-v1" },
  ),
);

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function cartCount(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
