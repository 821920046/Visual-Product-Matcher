
import { Product, MatchResult, ScanStats } from "../types";

const getApiBase = () => process.env.API_BASE || "/api";
const sanitizeText = (text: string) =>
  String(text || "").replace(/```json\s*|\s*```/g, "").replace(/\[\d+\]/g, "").trim();

/**
 * 合并后的扫描逻辑：一次调用完成搜索 + 结构化提取
 */
export const scanWebsite = async (url: string): Promise<{ products: Product[], stats: ScanStats }> => {
  const startTime = Date.now();
  try {
    const res = await fetch(`${getApiBase()}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl: url }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("QUOTA_EXCEEDED");
      if (res.status === 400 || /API key/i.test(text)) throw new Error("INVALID_KEY");
      throw new Error(text || "请求失败");
    }
    const payload = await res.json();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const parseNum = (price: string, numericPrice: any) => {
      const candidate = typeof numericPrice === 'number' ? numericPrice : parseFloat(String(price || '').replace(/[^\d.]/g, ''));
      return isNaN(candidate) ? NaN : candidate;
    };
    const products: Product[] = (payload.products || []).map((p: any, idx: number) => ({
      ...p,
      id: p.id || `p-${idx}-${Date.now()}`,
      sourceUrl: url,
      numericPrice: parseNum(p.price, p.numericPrice),
    }));

    return {
      products,
      stats: {
        totalCount: products.length,
        category: payload.stats?.category || "Shop",
        scanDuration: `${duration}s`,
        sources: payload.stats?.sources || []
      }
    };
  } catch (error: any) {
    console.error("Scan Error:", error);
    const msg = error.message || "";
    if (msg.includes("429")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (msg.includes("400") || msg.includes("API key")) {
      throw new Error("INVALID_KEY");
    }
    throw error;
  }
};

export const matchProductByImage = async (
  imageBase64: string,
  catalog: Product[]
): Promise<MatchResult | null> => {
  const context = catalog.map(p => `ID:${p.id} Name:${p.name}`).join("\n");

  try {
    const res = await fetch(`${getApiBase()}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, list: context }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "匹配失败");
    }
    const t = await res.text();
    const clean = sanitizeText(t);
    return JSON.parse(clean);
  } catch (e) {
    console.error("Match Error:", e);
    return null;
  }
};
