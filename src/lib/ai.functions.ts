import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function gatewayError(status: number, body: string) {
  if (status === 429) return new Error("AI is busy. Please try again in a moment.");
  if (status === 402) return new Error("AI credits exhausted. Add credits in workspace settings.");
  return new Error(body || `AI request failed (${status})`);
}

/* ----------------------- Product description ----------------------- */

export const generateProductDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(120),
        category: z.string().max(80).optional(),
        keywords: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `Write a compelling e-commerce product description for the product below. 2-4 short sentences, persuasive, benefits-led, no emojis, no hype words like "revolutionary". End with a subtle call to action.

Product name: ${data.name}
${data.category ? `Category: ${data.category}` : ""}
${data.keywords ? `Highlights: ${data.keywords}` : ""}

Return ONLY the description text, no preface, no quotes.`;

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("No description returned");
    return { description: text };
  });

/* ----------------------- Image helpers ----------------------- */

async function generateImage(prompt: string): Promise<Uint8Array> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      prompt,
      n: 1,
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
  const json: any = await res.json();
  const b64: string | undefined = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function uploadStoreAsset(userId: string, bytes: Uint8Array, kind: string) {
  const path = `${userId}/${kind}-${Date.now()}.png`;
  const { error } = await supabaseAdmin.storage
    .from("store-assets")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabaseAdmin.storage.from("store-assets").getPublicUrl(path);
  return data.publicUrl;
}

async function assertStoreOwner(storeId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!data || data.owner_id !== userId) throw new Error("Forbidden");
}

/* ----------------------- Banner ----------------------- */

export const generateStoreBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        storeName: z.string().min(1).max(120),
        businessType: z.string().min(1).max(80),
        vibe: z.string().max(200).optional(),
        primary: z.string().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwner(data.storeId, context.userId);
    const prompt = `Wide cinematic 16:9 e-commerce hero banner for a ${data.businessType} business called "${data.storeName}". ${data.vibe ? `Mood: ${data.vibe}.` : ""} ${data.primary ? `Accent color: ${data.primary}.` : ""} Editorial product photography, dramatic studio lighting, generous negative space on the left for headline text overlay, ultra high quality, photorealistic. No text, no logos, no watermarks.`;
    const bytes = await generateImage(prompt);
    const url = await uploadStoreAsset(context.userId, bytes, "banner");
    return { url };
  });

/* ----------------------- Logo ----------------------- */

export const generateStoreLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.string().uuid(),
        storeName: z.string().min(1).max(120),
        businessType: z.string().min(1).max(80),
        style: z.string().max(200).optional(),
        primary: z.string().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStoreOwner(data.storeId, context.userId);
    const prompt = `Modern minimalist logo mark for "${data.storeName}", a ${data.businessType} brand. ${data.style ? `Style: ${data.style}.` : "Style: clean, geometric, memorable."} ${data.primary ? `Primary color: ${data.primary}.` : ""} Vector-style flat design, centered on a plain white background, no text, no letters, just an iconic symbol. High contrast, professional, suitable for a small storefront avatar. Square 1:1.`;
    const bytes = await generateImage(prompt);
    const url = await uploadStoreAsset(context.userId, bytes, "logo");
    return { url };
  });
