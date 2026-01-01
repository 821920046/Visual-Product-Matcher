export interface Env {
  API_KEY: string;
}

const MODEL = "gemini-3-flash-preview";
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const jsonHeaders = {
  "Content-Type": "application/json",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function callGemini(apiKey: string, payload: any) {
  const res = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstream error ${res.status}: ${text}`);
  }
  return res.json();
}

function extractTextFromResponse(resp: any): string {
  const c = resp?.candidates?.[0];
  const parts = c?.content?.parts;
  if (Array.isArray(parts)) {
    const textPart = parts.find((p: any) => typeof p.text === "string");
    if (textPart?.text) return textPart.text;
  }
  if (typeof c?.output_text === "string") return c.output_text;
  const alt = resp?.text || "";
  return String(alt);
}

function sanitizeToJson(text: string): any {
  let t = text || "";
  t = t.replace(/```json\s*|\s*```/g, "");
  t = t.replace(/\[\d+\]/g, "");
  try {
    return JSON.parse(t.trim());
  } catch {
    throw new Error("Parse JSON failed");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/scan" && request.method === "POST") {
        const { targetUrl } = await request.json();
        if (!env.API_KEY) return new Response("API key not configured", { status: 500 });
        if (!targetUrl) return new Response("Missing targetUrl", { status: 400 });

        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert shop scanner.
1) Search for products on this website: ${targetUrl}
2) Return a list of up to 12 products.
3) Format the result strictly as JSON:
{
  "products": [{"name": string, "description": string, "price": string, "numericPrice": number, "category": string, "imageUrl": string}],
  "siteCategory": string
}
IMPORTANT: Output ONLY pure JSON.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
          tools: [{ googleSearch: {} }],
        };

        const resp = await callGemini(env.API_KEY, payload);
        const text = extractTextFromResponse(resp);
        const data = sanitizeToJson(text);

        const products = (data.products || []).map((p: any, idx: number) => ({
          ...p,
          id: p.id || `p-${idx}-${Date.now()}`,
          sourceUrl: targetUrl,
          numericPrice:
            typeof p.numericPrice === "number"
              ? p.numericPrice
              : Number(String(p.price || "").replace(/[^\d.]/g, "")) || NaN,
        }));

        const groundingChunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources =
          groundingChunks
            .map((chunk: any) => ({ title: chunk?.web?.title || "Source", uri: chunk?.web?.uri }))
            .filter((x: any) => x?.uri) || [];

        const result = {
          products,
          stats: {
            totalCount: products.length,
            category: data.siteCategory || "Shop",
            scanDuration: "", // duration measured client-side if needed
            sources,
          },
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/match" && request.method === "POST") {
        const { imageBase64, list } = await request.json();
        if (!env.API_KEY) return new Response("API key not configured", { status: 500 });
        if (!imageBase64 || !list) return new Response("Missing imageBase64 or list", { status: 400 });

        const payload = {
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
                {
                  text: `Match image to ID from list. Return JSON only: {productId, confidence, reasoning}

List:
${list}`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        };

        const resp = await callGemini(env.API_KEY, payload);
        const text = extractTextFromResponse(resp);
        const clean = String(text || "").replace(/```json\s*|\s*```/g, "").replace(/\[\d+\]/g, "");
        const json = sanitizeToJson(clean);

        return new Response(JSON.stringify(json), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (e: any) {
      const msg = e?.message || String(e);
      const code = /429/.test(msg) ? 429 : 500;
      return new Response(msg, { status: code, headers: corsHeaders });
    }
  },
};

