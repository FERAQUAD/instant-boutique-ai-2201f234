import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Sparkles } from "lucide-react";
import { listMyProducts, createProduct, updateProduct, deleteProduct } from "@/lib/products.functions";
import { generateProductDescription } from "@/lib/ai.functions";
import { getMyStore } from "@/lib/stores.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/products")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === "1" ? "1" : undefined,
  }),
  head: () => ({ meta: [{ title: "Products — StoreGen" }] }),
  component: ProductsPage,
});

type Product = {
  id: string; name: string; description: string | null; price: number;
  compare_at_price: number | null; inventory_count: number; category: string | null;
  images: string[]; is_published: boolean;
};

function ProductsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getStore = useServerFn(getMyStore);
  const list = useServerFn(listMyProducts);
  const create = useServerFn(createProduct);
  const update = useServerFn(updateProduct);
  const del = useServerFn(deleteProduct);

  const storeQ = useQuery({ queryKey: ["my-store"], queryFn: () => getStore({}) });
  const productsQ = useQuery({ queryKey: ["my-products"], queryFn: () => list({}), enabled: !!storeQ.data });

  const search = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    if (search.new === "1") {
      setEditing(null);
      setOpen(true);
      navigate({ to: "/products", search: {}, replace: true });
    }
  }, [search.new]);

  if (storeQ.isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  if (storeQ.isSuccess && !storeQ.data) { navigate({ to: "/onboarding" }); return null; }

  async function handleSave(data: Omit<Product, "id"> & { id?: string }) {
    try {
      if (data.id) {
        const { id, ...patch } = data;
        await update({ data: { id, patch } });
      } else {
        await create({ data });
      }
      qc.invalidateQueries({ queryKey: ["my-products"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
      setOpen(false); setEditing(null);
      toast.success(data.id ? "Updated" : "Product added");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["my-products"] });
      toast.success("Deleted");
    } catch (e) { toast.error((e as Error).message); }
  }

  const products = (productsQ.data ?? []) as Product[];

  return (
    <DashboardShell storeSlug={storeQ.data?.store_slug} storeName={storeQ.data?.store_name}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Products</h2>
            <p className="text-sm text-muted-foreground">{products.length} item{products.length === 1 ? "" : "s"}</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add product
          </Button>
        </div>

        {productsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading products…</p>
        ) : products.length === 0 ? (
          <Card className="flex flex-col items-center p-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-bold">No products yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add your first product to start selling.</p>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="mt-4">
              <Plus className="mr-1 h-4 w-4" /> Add product
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-semibold">{p.name}</h3>
                  <p className="mt-1 font-display text-lg font-bold text-primary">{formatNaira(Number(p.price))}</p>
                  <p className="text-xs text-muted-foreground">{p.inventory_count} in stock</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <ProductForm initial={editing} onSubmit={handleSave} />
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function ProductForm({
  initial,
  onSubmit,
}: {
  initial: Product | null;
  onSubmit: (d: Omit<Product, "id"> & { id?: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [compare, setCompare] = useState(initial?.compare_at_price ? String(initial.compare_at_price) : "");
  const [inventory, setInventory] = useState(String(initial?.inventory_count ?? 0));
  const [category, setCategory] = useState(initial?.category ?? "");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [published, setPublished] = useState<boolean>(initial ? initial.is_published : true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [genDesc, setGenDesc] = useState(false);
  const genDescription = useServerFn(generateProductDescription);

  const invNum = Number(inventory) || 0;
  const effectivePublished = published && invNum > 0;

  async function aiWriteDescription() {
    if (!name.trim()) { toast.error("Add a product name first"); return; }
    setGenDesc(true);
    try {
      const { description: text } = await genDescription({
        data: { name, category: category || undefined },
      });
      setDescription(text);
      toast.success("Description written");
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    } finally {
      setGenDesc(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/products/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("store-assets").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...urls].slice(0, 10));
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id,
        name,
        description: description || null,
        price: Number(price),
        compare_at_price: compare ? Number(compare) : null,
        inventory_count: Number(inventory),
        category: category || null,
        images,
        is_published: effectivePublished,
      });
    } finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={3} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Price (₦)</Label>
          <Input required type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Compare at (₦)</Label>
          <Input type="number" min={0} value={compare} onChange={(e) => setCompare(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Inventory</Label>
          <Input type="number" min={0} value={inventory} onChange={(e) => setInventory(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Input value={category ?? ""} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Shoes" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Images (up to 10)</Label>
        <Input type="file" multiple accept="image/*" onChange={(e) => uploadFiles(e.target.files)} disabled={uploading} />
        {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded border border-border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  className="absolute right-0 top-0 bg-destructive px-1 text-xs text-destructive-foreground"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label className="text-sm">Publish to storefront</Label>
          <p className="text-xs text-muted-foreground">
            {invNum === 0
              ? "Inventory is 0 — product will stay hidden until you add stock."
              : "Customers can see and order this product."}
          </p>
        </div>
        <Switch checked={effectivePublished} disabled={invNum === 0} onCheckedChange={setPublished} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting || uploading}>
        {submitting ? "Saving…" : "Save product"}
      </Button>
    </form>
  );
}
