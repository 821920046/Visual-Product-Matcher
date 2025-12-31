
import { GoogleGenAI, Type } from "@google/genai";
import { Product, MatchResult, ScanStats } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini with Google Search to "scan" a website for products.
 * Returns a list of products and statistical data.
 */
export const scanWebsite = async (url: string): Promise<{ products: Product[], stats: ScanStats }> => {
  const startTime = Date.now();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Thoroughly scan the website: ${url}. 
               1. Identify as many specific products as possible (up to 20).
               2. Provide a total count of unique products visible or identifiable on the landing page/catalog.
               3. Determine the primary shopping category of this site.
               
               For each product in the list, provide: name, image URL (real or high-quality placeholder), short description, and price. 
               Return the data in valid JSON format.`,
    config: {
      tools: [{ googleSearch: {} }],
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
                imageUrl: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
              },
              required: ["name", "description", "price", "imageUrl"],
            },
          },
          totalIdentifiedCount: { type: Type.INTEGER },
          siteCategory: { type: Type.STRING },
        },
        required: ["products", "totalIdentifiedCount", "siteCategory"],
      },
    },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  try {
    const data = JSON.parse(response.text || "{}");
    const products = (data.products || []).map((p: any, idx: number) => ({
      ...p,
      id: p.id || `prod-${idx}-${Date.now()}`,
      sourceUrl: p.sourceUrl || url
    }));

    return {
      products,
      stats: {
        totalCount: data.totalIdentifiedCount || products.length,
        category: data.siteCategory || "General Merchandise",
        scanDuration: `${duration}s`
      }
    };
  } catch (error) {
    console.error("Failed to parse scan results:", error);
    return { products: [], stats: { totalCount: 0, category: "Unknown", scanDuration: "0s" } };
  }
};

/**
 * Matches an uploaded image against the catalog of scanned products.
 */
export const matchProductByImage = async (
  imageBase64: string,
  catalog: Product[]
): Promise<MatchResult | null> => {
  const catalogContext = catalog.map(p => 
    `ID: ${p.id}, Name: ${p.name}, Description: ${p.description}`
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
          text: `You are a visual search expert. Look at this image and find the best match from the following product catalog:
                 
                 CATALOG:
                 ${catalogContext}
                 
                 Return the ID of the matching product, a confidence score (0-1), and a short reason why it matches.`,
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
    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Failed to match product:", error);
    return null;
  }
};
