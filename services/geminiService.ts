
import { GoogleGenAI, Type } from "@google/genai";
import { Product, MatchResult, ScanStats } from "../types";

/**
 * 每次调用都重新实例化以确保使用最新的 API KEY
 */
const getClient = () => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY_NOT_CONFIGURED");
  return new GoogleGenAI({ apiKey: key });
};

/**
 * 合并后的扫描逻辑：一次调用完成搜索 + 结构化提取
 */
export const scanWebsite = async (url: string): Promise<{ products: Product[], stats: ScanStats }> => {
  const startTime = Date.now();
  const ai = getClient();
  
  try {
    // 将搜索和 JSON 提取合并为一个 Prompt，减少 50% 配额消耗
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert shop scanner. 
                 1. Search for products on this website: ${url}
                 2. Return a list of up to 12 products.
                 3. Format the result strictly as JSON with this structure:
                 {
                   "products": [{"name": string, "description": string, "price": string, "numericPrice": number, "category": string, "imageUrl": string}],
                   "siteCategory": string
                 }
                 IMPORTANT: Output ONLY pure JSON. Do not include any citations like [1], [2] or explanations.`,
      config: {
        tools: [{ googleSearch: {} }],
        // 虽然有工具，我们依然请求 JSON
        responseMimeType: "application/json",
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 关键步骤：清洗 JSON 中可能存在的搜索引用标记（如 [1], [2]）
    // 因为 Search Grounding 会强行插入这些标记导致 JSON.parse 崩溃
    let rawText = response.text || "";
    const cleanJsonText = rawText.replace(/\[\d+\]/g, "").trim();
    
    const data = JSON.parse(cleanJsonText);
    
    const products = (data.products || []).map((p: any, idx: number) => ({
      ...p,
      id: p.id || `p-${idx}-${Date.now()}`,
      sourceUrl: url
    }));

    // 获取来源链接
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'Source',
      uri: chunk.web?.uri
    })).filter((s: any) => s.uri) || [];

    return {
      products,
      stats: {
        totalCount: products.length,
        category: data.siteCategory || "Shop",
        scanDuration: `${duration}s`,
        sources
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
  const ai = getClient();
  // 移除 .slice(0, 20) 限制，利用 Gemini 3 的长上下文能力
  const context = catalog.map(p => `ID:${p.id} Name:${p.name}`).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
          { text: `Match image to ID from list. Return JSON only: {productId, confidence, reasoning}\n\nList:\n${context}` },
        ],
      },
      config: { responseMimeType: "application/json" },
    });
    
    let text = response.text || "";
    text = text.replace(/```json\s*|\s*```/g, "").replace(/\[\d+\]/g, "");
    return JSON.parse(text);
  } catch (e) {
    console.error("Match Error:", e);
    return null;
  }
};
