// create-product.dto.ts
export class CreateProductDto {
  article_code: string;              // Código del artículo
  article_description: string;       // Descripción del artículo
  article_series: string;            // Serie del artículo (relación con la serie)
  type_origin: string;               // Origen del tipo de producto
  manufacturing_cost: number;        // Costo de fabricación
  unit_price: number;                // Precio unitario
  selling_price: number;             // Precio de venta
  brand_name?: string;               // Nombre de la marca
  model_code?: string;               // Código del modelo
  category?: string;                 // Categoría del producto
  material_type?: string;            // Tipo de material del producto
  color?: string;                    // Color del producto
  stock_minimum?: number;            // Stock mínimo para control
  product_image?: string;            // Imagen del producto
  
  sizes: string[];                   // Lista de tallas disponibles (como 38, 39, 40, etc.)
  lot_pair?: number;                 // Pares por lote (solo si aplica, como en calzado)
}
