
import { GoogleGenAI, Type } from "@google/genai";
import { Product, MatchResult, ScanStats } from "../types";

/**
 * Uses Gemini with Google Search to "scan" a website for products.
 * Returns a list of products and statistical data, including search grounding sources.
 */
export const scanWebsite = async (url: string): Promise<{ products: Product[], stats: ScanStats }> => {
  // Create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const startTime = Date.now();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Thoroughly scan the website: ${url}. 
               1. Identify as many specific products as possible (up to 20).
               2. Provide a total count of unique products visible or identifiable on the landing page/catalog.
               3. Determine the primary shopping category of this site.
               
               For each product in the list, provide: name, image URL, short description, price, and a specific sub-category (e.g., 'Shirts', 'Shoes', 'Electronics'). 
               Also provide a 'numericPrice' field which is the price as a pure number (float).
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
                numericPrice: { type: Type.NUMBER },
                category: { type: Type.STRING },
                imageUrl: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
              },
              required: ["name", "description", "price", "numericPrice", "category", "imageUrl"],
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

  // Extract grounding sources as required by Google Search grounding guidelines.
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const sources = groundingChunks?.map((chunk: any) => ({
    title: chunk.web?.title || 'Search Source',
    uri: chunk.web?.uri
  })).filter((s: any) => s.uri) || [];

  try {
    // When Google Search is used, the response might contain grounding tokens (e.g., [1]).
    // We clean these up to ensure JSON parsing succeeds.
    const text = (response.text || "{}").replace(/\[\d+\]/g, "");
    const data = JSON.parse(text);
    
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
        scanDuration: `${duration}s`,
        sources
      }
    };
  } catch (error) {
    console.error("Failed to parse scan results:", error);
    return { 
      products: [], 
      stats: { totalCount: 0, category: "Unknown", scanDuration: "0s", sources } 
    };
  }
};

/**
 * Matches an uploaded image against the catalog of scanned products.
 */
export const matchProductByImage = async (
  imageBase64: string,
  catalog: Product[]
): Promise<MatchResult | null> => {
  // Create a new GoogleGenAI instance right before making an API call.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
