
import { GoogleGenAI, Type } from "@google/genai";
import { Product, MatchResult, ScanStats } from "../types";

/**
 * Initialize Gemini client using the mandatory named parameter and direct process.env.API_KEY access.
 */
const getClient = () => {
  // Directly use process.env.API_KEY as per the library initialization guidelines.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * 扫描网站并提取商品
 * This implementation complies with Search Grounding rules by separating the search phase 
 * from the structured data extraction phase.
 */
export const scanWebsite = async (url: string): Promise<{ products: Product[], stats: ScanStats }> => {
  const ai = getClient();
  const startTime = Date.now();
  
  try {
    // Phase 1: Search grounding to gather raw information.
    // Rule: "The output response.text may not be in JSON format; do not attempt to parse it as JSON."
    const searchResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an e-commerce data extractor. Visit and analyze the website: ${url}. 
                 Find and list the products including their name, description, image URL, and price.
                 Limit results to 15 items. Identify the general category of this shop.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Extract grounding sources to satisfy "MUST ALWAYS extract URLs" requirement.
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || 'Verified Source',
      uri: chunk.web?.uri
    })).filter((s: any) => s.uri) || [];

    // Phase 2: Extract structured data from the search result.
    // We pass the raw text from the previous response to a fresh call without tools.
    // This complies with the rule of not parsing search grounding results directly as JSON.
    const structureResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract product data from the provided text into the specified JSON format.
                 
                 SOURCE TEXT:
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
                  sourceUrl: { type: Type.STRING },
                },
                required: ["name", "description", "price", "numericPrice", "category", "imageUrl"],
              },
            },
            totalCount: { type: Type.INTEGER },
            siteCategory: { type: Type.STRING },
          },
          required: ["products", "totalCount", "siteCategory"],
        },
      }
    });

    // Access .text property directly.
    const cleanJson = structureResponse.text || "{}";
    const data = JSON.parse(cleanJson);
    
    const products = (data.products || []).map((p: any, idx: number) => ({
      ...p,
      id: p.id || `p-${idx}-${Date.now()}`,
      sourceUrl: p.sourceUrl || url
    }));

    return {
      products,
      stats: {
        totalCount: data.totalCount || products.length,
        category: data.siteCategory || "Shop",
        scanDuration: `${duration}s`,
        sources
      }
    };
  } catch (error: any) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
};

/**
 * 图像匹配逻辑
 */
export const matchProductByImage = async (
  imageBase64: string,
  catalog: Product[]
): Promise<MatchResult | null> => {
  const ai = getClient();
  
  const catalogContext = catalog.map(p => 
    `ID: ${p.id}, Name: ${p.name}, Price: ${p.price}`
  ).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          text: `Match this image against the following product list. Return only the ID of the best match and reasoning.
                 
                 INVENTORY:
                 ${catalogContext}`,
        },
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
    // Directly use the .text property getter.
    const text = response.text || "null";
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};
