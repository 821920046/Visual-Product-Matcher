
import { GoogleGenAI, Type } from "@google/genai";
import { Product, MatchResult, ScanStats } from "../types";

/**
 * 核心：直接从环境读取 API_KEY。
 * 注意：在本地开发时需要 .env 文件，在 Cloudflare 部署时需要在后台配置。
 */
const getClient = () => {
  const key = process.env.API_KEY;
  if (!key || key.length < 10) {
    throw new Error("API_KEY_NOT_CONFIGURED");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const scanWebsite = async (url: string): Promise<{ products: Product[], stats: ScanStats }> => {
  const startTime = Date.now();
  
  try {
    const ai = getClient();
    
    // 阶段 1：使用 Google Search Grounding 获取网页实时数据
    // Flash 模型在免费层级支持此功能，非常强大
    const searchResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a detailed analysis of the shop website: ${url}. 
                 Extract a list of available products with their:
                 - Name
                 - Price (e.g., "¥299")
                 - Brief description
                 - Image URL (direct link to the product photo)
                 
                 Also identify the overall store category. If the site is protected by anti-bot, try to summarize based on public index.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'Shop Source',
      uri: chunk.web?.uri
    })).filter((s: any) => s.uri) || [];

    // 阶段 2：结构化数据转换
    const structureResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Convert the following text into a valid JSON product catalog.
                 
                 TEXT TO CONVERT:
                 ${searchResponse.text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            products: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  price: { type: Type.STRING },
                  numericPrice: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  imageUrl: { type: Type.STRING },
                },
                required: ["name", "description", "price", "numericPrice", "category", "imageUrl"],
              },
            },
            siteCategory: { type: Type.STRING },
          },
          required: ["products", "siteCategory"],
        },
      }
    });

    const data = JSON.parse(structureResponse.text || "{}");
    const products = (data.products || []).map((p: any, idx: number) => ({
      ...p,
      id: p.id || `prod-${idx}-${Date.now()}`,
      sourceUrl: url
    }));

    return {
      products,
      stats: {
        totalCount: products.length,
        category: data.siteCategory || "General Store",
        scanDuration: `${duration}s`,
        sources
      }
    };
  } catch (error: any) {
    // 捕获特定 API 错误
    const errMsg = error.message || "";
    if (errMsg.includes("API_KEY_NOT_CONFIGURED")) {
      throw new Error("未检测到 API Key。请在部署平台的『环境变量』中添加名为 API_KEY 的变量。");
    }
    if (errMsg.includes("API key not valid")) {
      throw new Error("API Key 无效。请确认你从 Google AI Studio 复制的是最新生成的 Key。");
    }
    if (errMsg.includes("429")) {
      throw new Error("请求太频繁了。免费层级有每分钟限制，请稍后再试。");
    }
    throw error;
  }
};

export const matchProductByImage = async (
  imageBase64: string,
  catalog: Product[]
): Promise<MatchResult | null> => {
  const ai = getClient();
  const catalogContext = catalog.map(p => `ID:${p.id} Name:${p.name}`).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        { text: `Which item from this list matches the image best? Return JSON.\n\n${catalogContext}` },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["productId", "confidence", "reasoning"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "null");
  } catch (e) {
    return null;
  }
};
