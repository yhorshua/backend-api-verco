export interface ImportStockResult {
  updated: number;
  inserted: number;
  productsNotFound: string[];
  sizesNotFound: {
    articleCode: string;
    size: string;
  }[];
}