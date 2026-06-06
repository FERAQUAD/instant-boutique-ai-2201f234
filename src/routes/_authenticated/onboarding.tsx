import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Store, Check } from "lucide-react";
import { createStore, checkSlugAvailable, getMyStore } from "@/lib/stores.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your store — StoreGen" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const checkSlug = useServerFn(checkSlugAvailable);
  const create = useServerFn(createStore);
  const getStore = useServerFn(getMyStore);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStore({}).then((s) => { if (s) navigate({ to: "/dashboard" }); });
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!slug || slug.length < 2) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const r = await checkSlug({ data: { slug } });
        setSlugStatus(r.available ? "ok" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (slugStatus !== "ok") { toast.error("Pick an available store URL"); return; }
    setLoading(true);
    try {
      await create({
        data: {
          store_name: name,
          store_slug: slug,
          theme_settings: {
            primary: "#ea580c",
            secondary: "#0f172a",
            font: "Inter",
            showSearch: true,
            showCategoryFilter: true,
          },
          contact_email: email || null,
          contact_phone: phone || null,
          whatsapp_number: whatsapp || null,
        },
      });
      toast.success("Store created!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg p-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">StoreGen</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">Set up your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">A few quick details and you're ready to sell.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Store name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Lagos Fashion Hub" />
          </div>
          <div className="space-y-1.5">
            <Label>Store URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">storegen.app/s/</span>
              <Input
                required
                value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                placeholder="your-store"
              />
            </div>
            <p className="text-xs">
              {slugStatus === "checking" && <span className="text-muted-foreground">Checking…</span>}
              {slugStatus === "ok" && <span className="text-success">✓ Available</span>}
              {slugStatus === "taken" && <span className="text-destructive">Already taken</span>}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Contact email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp number (optional)</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+234..." />
          </div>

          <Button type="submit" disabled={loading || slugStatus !== "ok"} className="h-12 w-full text-base">
            {loading ? "Creating store…" : (<><Check className="mr-2 h-4 w-4" /> Create my store</>)}
          </Button>
        </form>
      </Card>
    </div>
  );
}
