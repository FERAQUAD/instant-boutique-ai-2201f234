import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const productSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).optional().nullable(),
  price: z.number().min(0),
  compare_at_price: z.number().min(0).nullable().optional(),
  sku: z.string().max(64).nullable().optional(),
  inventory_count: z.number().int().min(0).default(0),
  images: z.array(z.string().url()).max(10).default([]),
  category: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  is_published: z.boolean().default(true),
  sizes: z.array(z.string().max(20)).max(30).default([]),
  colors: z.array(z.string().max(30)).max(30).default([]),
  weight_grams: z.number().int().min(0).max(1000000).nullable().optional(),
});

async function getOwnStoreId(supabase: ReturnType<typeof getSupabase>, userId: string) {
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No store found");
  return data.id;
}
function getSupabase(s: unknown) { return s as any; }

export const listMyProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const storeId = await getOwnStoreId(supabase, userId);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeId = await getOwnStoreId(supabase, userId);
    const { data: row, error } = await supabase
      .from("products")
      .insert({ ...data, store_id: storeId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), patch: productSchema.partial() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeId = await getOwnStoreId(supabase, userId);
    const { data: row, error } = await supabase
      .from("products")
      .update(data.patch)
      .eq("id", data.id)
      .eq("store_id", storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeId = await getOwnStoreId(supabase, userId);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
