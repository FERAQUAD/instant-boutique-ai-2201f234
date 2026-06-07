import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { getMyStore, updateMyStore } from "@/lib/stores.functions";
import { generateStoreBanner, generateStoreLogo } from "@/lib/ai.functions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const BUSINESS_TYPES = [
  "Fashion & Apparel", "Beauty & Cosmetics", "Electronics & Gadgets",
  "Food & Groceries", "Home & Furniture", "Health & Wellness",
  "Jewelry & Accessories", "Baby & Kids", "Sports & Outdoors",
  "Books & Stationery", "Art & Crafts", "Other",
];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — StoreGen" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getStore = useServerFn(getMyStore);
  const update = useServerFn(updateMyStore);
  const genBanner = useServerFn(generateStoreBanner);
  const genLogo = useServerFn(generateStoreLogo);
  const storeQ = useQuery({ queryKey: ["my-store"], queryFn: () => getStore({}) });

  const [form, setForm] = useState<any>(null);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusiness, setAiBusiness] = useState<string>("Fashion & Apparel");
  const [aiVibe, setAiVibe] = useState<string>("");
  const [aiLogoStyle, setAiLogoStyle] = useState<string>("");
  const [generating, setGenerating] = useState<"banner" | "logo" | null>(null);

  useEffect(() => {
    if (storeQ.isSuccess && !storeQ.data) navigate({ to: "/onboarding" });
    if (storeQ.data && !form) setForm({ ...storeQ.data });
  }, [storeQ.data, storeQ.isSuccess]);

  async function uploadImage(file: File, kind: "logo" | "banner") {
    setUploading(kind);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
      setForm((f: any) => ({ ...f, [kind === "logo" ? "store_logo" : "hero_banner"]: data.publicUrl }));
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(null); }
  }

  async function save() {
    setSaving(true);
    try {
      await update({
        data: {
          store_name: form.store_name,
          store_logo: form.store_logo,
          hero_banner: form.hero_banner,
          theme_settings: form.theme_settings,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          whatsapp_number: form.whatsapp_number,
          instagram_url: form.instagram_url,
          facebook_url: form.facebook_url,
          twitter_url: form.twitter_url,
          is_active: form.is_active,
        },
      });
      qc.invalidateQueries({ queryKey: ["my-store"] });
      toast.success("Saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function generateBanner() {
    if (!form?.id) return;
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const res = await fetch("/api/generate-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: form.id,
          ownerId: user.id,
          storeName: form.store_name,
          businessType: aiBusiness,
          vibe: aiVibe || undefined,
          primary: form.theme_settings?.primary,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 429) throw new Error("AI is busy. Please try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
        throw new Error(txt || "Generation failed");
      }
      const json = await res.json();
      setForm((f: any) => ({ ...f, hero_banner: json.url }));
      toast.success("Banner generated! Click Save to publish.");
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    } finally {
      setGenerating(false);
    }
  }

  if (!form) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <DashboardShell storeSlug={form.store_slug} storeName={form.store_name}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your store appearance and contact details.</p>
        </div>

        <Card className="space-y-4 p-6">
          <h3 className="font-display font-bold">Branding</h3>
          <div className="space-y-1.5">
            <Label>Store name</Label>
            <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Logo</Label>
              {form.store_logo && <img src={form.store_logo} className="mb-2 h-16 w-16 rounded object-cover" />}
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} disabled={uploading === "logo"} />
            </div>
            <div className="space-y-1.5">
              <Label>Hero banner</Label>
              {form.hero_banner && <img src={form.hero_banner} className="mb-2 h-16 w-full rounded object-cover" />}
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} disabled={uploading === "banner"} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Primary color</Label>
              <Input type="color" value={form.theme_settings?.primary ?? "#ea580c"} onChange={(e) => setForm({ ...form, theme_settings: { ...form.theme_settings, primary: e.target.value } })} />
            </div>
            <div className="space-y-1.5">
              <Label>Secondary color</Label>
              <Input type="color" value={form.theme_settings?.secondary ?? "#0f172a"} onChange={(e) => setForm({ ...form, theme_settings: { ...form.theme_settings, secondary: e.target.value } })} />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display font-bold">AI banner generator</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Let Lovable AI design a hero banner for your storefront based on your business type and style.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Business type</Label>
              <Select value={aiBusiness} onValueChange={setAiBusiness}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Style / vibe (optional)</Label>
              <Input value={aiVibe} onChange={(e) => setAiVibe(e.target.value)} placeholder="e.g. luxury, minimalist, vibrant…" />
            </div>
          </div>
          {form.hero_banner && (
            <div>
              <Label className="text-xs">Current banner preview</Label>
              <img src={form.hero_banner} className="mt-1 h-32 w-full rounded-md object-cover" alt="banner preview" />
            </div>
          )}
          <Button onClick={generateBanner} disabled={generating} variant="outline" className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? "Generating banner… (10-20s)" : "Generate banner with AI"}
          </Button>
          <p className="text-xs text-muted-foreground">After generating, click <strong>Save changes</strong> below to publish to your storefront.</p>
        </Card>

        <Card className="space-y-4 p-6">
          <h3 className="font-display font-bold">Contact & Social</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Email</Label><Input value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp_number ?? ""} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Instagram URL</Label><Input value={form.instagram_url ?? ""} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Facebook URL</Label><Input value={form.facebook_url ?? ""} onChange={(e) => setForm({ ...form, facebook_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Twitter URL</Label><Input value={form.twitter_url ?? ""} onChange={(e) => setForm({ ...form, twitter_url: e.target.value })} /></div>
          </div>
        </Card>

        <Card className="flex items-center justify-between p-6">
          <div>
            <h3 className="font-display font-bold">Store visibility</h3>
            <p className="text-sm text-muted-foreground">Toggle off to hide your store from the public.</p>
          </div>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        </Card>

        <Button onClick={save} disabled={saving} className="h-12 px-8">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </DashboardShell>
  );
}
