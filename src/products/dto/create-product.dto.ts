// create-product.dto.ts
export class CreateProductDto {
  article_code: string;
  article_description: string;
  article_series: string;
  type_origin: string;
  manufacturing_cost: number;
  unit_price: number;
  brand_name?: string;
  model_code?: string;
  category?: string;
  material_type?: string;
  color?: string;
  stock_minimum?: number;
  product_image?: string;
}

