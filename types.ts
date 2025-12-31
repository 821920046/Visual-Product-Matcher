
export interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  numericPrice: number;
  category: string;
  imageUrl: string;
  sourceUrl: string;
}

export interface ScanStats {
  totalCount: number;
  category: string;
  scanDuration: string;
  sources?: { title: string; uri: string }[];
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  CATALOG = 'CATALOG',
  SEARCHING = 'SEARCHING',
  RESULT = 'RESULT'
}

export interface MatchResult {
  productId: string;
  confidence: number;
  reasoning: string;
}
