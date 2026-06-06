import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  storeId: z.string().uuid(),
  ownerId: z.string().uuid(),
  storeName: z.string().min(1).max(120),
  businessType: z.string().min(1).max(80),
  vibe: z.string().max(200).optional(),
  primary: z.string().max(20).optional(),
});

export const Route = createFileRoute("/api/generate-banner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: unknown;
        try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) return new Response(parsed.error.message, { status: 400 });
        const { storeId, ownerId, storeName, businessType, vibe, primary } = parsed.data;

        // Verify caller owns the store
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, owner_id")
          .eq("id", storeId)
          .maybeSingle();
        if (!store || store.owner_id !== ownerId) {
          return new Response("Forbidden", { status: 403 });
        }

        const prompt = `Wide cinematic e-commerce hero banner for a ${businessType} business called "${storeName}". ${vibe ? `Mood/style: ${vibe}.` : ""} ${primary ? `Use ${primary} as a key accent color.` : ""} Editorial product photography, dramatic studio lighting, bold but elegant composition, lots of negative space on the left for headline text overlay, ultra high quality, photorealistic, 16:9.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            prompt,
            n: 1,
          }),
        });
        if (!upstream.ok) {
          const txt = await upstream.text().catch(() => "");
          return new Response(txt || "Image generation failed", { status: upstream.status });
        }
        const json: any = await upstream.json();
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) return new Response("No image returned", { status: 502 });

        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const path = `${ownerId}/banner-${Date.now()}.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("store-assets")
          .upload(path, bytes, { contentType: "image/png", upsert: false });
        if (upErr) return new Response(upErr.message, { status: 500 });

        const { data: pub } = supabaseAdmin.storage.from("store-assets").getPublicUrl(path);
        return Response.json({ url: pub.publicUrl });
      },
    },
  },
});
