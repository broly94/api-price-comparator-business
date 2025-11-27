export interface NormalizedProduct {
  producto_normalizado: string;
  tipo_producto?: string | null; // Tipo específico (girasol, 000, cola, entera, etc.)
  precio_final_catalogo: number; // Precio que se ve en imagen
  porcentaje_descuento?: number | null; // % de descuento si se indica
  marca?: string | null;
  cantidad_pack: number; // Cantidad en el pack (1 si es individual)
  unidad_medida: string; // Unidad por cada item
  descripcion_cantidad: string; // Descripción completa "12 x 250g"
  categoria_inferida?: string | null;
  unidad_count?: number | null; // Cantidad de unidades, sobres, packs o cápsulas
  confidence?: number;
  rawText?: string;
  mayorista?: string;
}

export interface ProcessCatalogResponse {
  success: boolean;
  data: NormalizedProduct[];
  metadata: {
    totalRegions: number;
    successfulNormalizations: number;
    processingTime: number;
    company?: string;
  };
}

export interface ProductVector {
  id: number | string;
  vector: number[];
  payload: {
    codigo: number;
    rubro: string;
    marca: string;
    descripcion: string;
    peso: string;
    precio: number;
    texto_para_embedding?: string;
  };
}

export interface VectorSearchResult {
  id: number | string;
  score: number;
  payload: ProductVector['payload'];
  score_ajustado?: number;
}

export interface VectorDbService {
  initialize(): Promise<void>;
  upsertProducts(products: ProductVector[]): Promise<void>;
  searchSimilar(
    vector: number[],
    limit?: number,
    scoreThreshold?: number,
    filters?: Record<string, any>,
  ): Promise<VectorSearchResult[]>;
}

export interface ImageSearchResult {
  producto_original: NormalizedProduct;
  productos_similares: Array<{
    id: number;
    score: number;
    producto: any; // Producto de Qdrant
  }>;
}

export interface ProcessImageAndSearchResponse {
  success: boolean;
  data: {
    productos_procesados: number;
    productos_con_matches: number;
    resultados: ImageSearchResult[];
  };
  metadata: {
    processingTime: number;
    company?: string;
    maxResults: number | undefined;
    similarityThreshold: number | undefined;
    mayorista: string;
  };
}

export interface ProcessCatalogData {
  productos_procesados: number;
  preview: Array<{
    producto_extraido: NormalizedProduct;
    coincidencias: VectorSearchResult[];
    total_coincidencias: number;
  }>;
}
