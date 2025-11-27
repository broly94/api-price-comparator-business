// src/modules/catalog-processing/catalog-processing.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagePreprocessorService } from '@/modules/catalog-processing/services/image-preprocessor.service';
import { GeminiMultimodalService } from '@/modules/catalog-processing/services/gemini-multimodal.service';
import {
  ProcessCatalogImageDto,
  ProcessImageAndSearchDto,
} from '@/modules/catalog-processing/dtos/catalog-processing.dto';
import {
  ImageSearchResult,
  NormalizedProduct,
  ProcessCatalogData,
  ProcessCatalogResponse,
} from '@/common/interfaces/catalog-processing.interface';
import { ExcelProcessingService } from '@/modules/catalog-processing/services/excel-processing.service';
import { EmbeddingService } from './services/embedding.service';
import { QdrantService } from './services/qdrant.service';
import { EtlProxyService } from './services/etl-proxy.service';
import { multerOptions } from '@/common/multer.options';

@Controller('catalog-processing')
export class CatalogProcessingController {
  private readonly logger = new Logger(CatalogProcessingController.name);

  constructor(
    private imagePreprocessor: ImagePreprocessorService,
    private geminiMultimodalService: GeminiMultimodalService,
    private excelProcessingService: ExcelProcessingService,
    private etlProxyService: EtlProxyService,
    private embeddingService: EmbeddingService,
    private qdrantService: QdrantService,
  ) {}

  @Get('debug-products')
  async debugProducts(): Promise<any> {
    try {
      // Buscar productos COCINERO para ver qué hay en la base de datos
      const embedding = await this.embeddingService.generateEmbedding(
        'aceite cocinero girasol',
      );

      const results = await this.qdrantService.searchSimilar(
        embedding,
        10,
        0.1, // Threshold bajo para ver todo
        {}, // Sin filtros
      );

      // Filtrar solo productos COCINERO manualmente
      const cocineroProducts = results.filter((item) =>
        item.payload.marca?.toUpperCase().includes('COCINERO'),
      );

      return {
        totalResults: results.length,
        cocineroProducts: cocineroProducts.map((p) => ({
          id: p.id,
          score: p.score,
          marca: p.payload.marca,
          peso: p.payload.peso,
          descripcion: p.payload.descripcion,
          precio: p.payload.precio,
        })),
      };
    } catch (error) {
      this.logger.error('Debug error:', error);
      throw error;
    }
  }

  /**
   * ENDPOINT PRINCIPAL - PROCESAMIENTO MULTIMODAL
   * Envía la imagen directamente a Gemini para análisis visual completo
   */
  @Post('process-image')
  @UseInterceptors(FileInterceptor('image'))
  async processCatalogImage(
    @UploadedFile() image: Express.Multer.File,
    @Body() body: ProcessCatalogImageDto,
  ): Promise<ProcessCatalogResponse | any> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `🖼️ MULTIMODAL Processing for company: ${body.company || 'unknown'} `,
      );

      if (!image) {
        throw new BadRequestException('Image file is required');
      }

      this.logger.log(
        `📊 Image size: ${image.size} bytes, mimetype: ${image.mimetype}`,
      );

      // 1. Pre-procesar imagen (mejora calidad para OCR visual)
      this.logger.log('Preprocessing image for better visual analysis...');
      const processedImage = await this.imagePreprocessor.preprocessImage(
        image.buffer,
      );

      // 2. Procesar con Gemini Multimodal (ANÁLISIS VISUAL DIRECTO)
      this.logger.log('Sending to Gemini Multimodal for visual analysis...');
      const products = await this.geminiMultimodalService.processCatalogImage(
        processedImage,
        body.company,
      );

      const processingTime = (Date.now() - startTime) / 1000;

      this.logger.log(
        `🎉 MULTIMODAL Complete: ${products.length} products found in ${processingTime}ms`,
      );

      return {
        success: true,
        data: products,
        metadata: {
          totalProductsFound: products.length,
          processingTime,
          company: body.company,
          method: 'multimodal_visual_analysis',
          model: 'gemini-2.0-flash',
        },
      };
    } catch (error) {
      this.logger.error('Error in multimodal processing:', error);
      throw new HttpException(
        `Multimodal processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * NUEVO ENDPOINT - SUBIR EXCEL A VECTOR DB (PROXY)
   */
  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('excel'))
  async uploadExcel(@UploadedFile() excelFile: Express.Multer.File): Promise<{
    success: boolean;
    processed: number;
    total: number;
    message: string;
  }> {
    console.log(excelFile);
    try {
      if (!excelFile) {
        console.log(excelFile);
        throw new BadRequestException('Excel file is required');
      }

      this.logger.log(`📤 Proxying Excel uploading: ${excelFile.originalname}`);

      if (!excelFile) {
        throw new BadRequestException('Excel file is required');
      }

      // Validar que sea un archivo Excel
      if (
        !excelFile.mimetype.includes('spreadsheet') &&
        !excelFile.originalname.match(/\.(xlsx|xls)$/)
      ) {
        throw new BadRequestException(
          'File must be an Excel document (.xlsx or .xls)',
        );
      }

      // 🎯 NUEVO PASO: Llamar al servicio proxy que enviará el archivo a FastAPI
      const result =
        await this.etlProxyService.sendExcelToEtlService(excelFile);

      return {
        success: true,
        processed: result.processed,
        total: result.total,
        message: `Successfully processed ${result.processed} products into vector database via ETL Service`,
      };
    } catch (error) {
      this.logger.error(
        'Error processing Excel upload (PROXY failed):',
        error.message,
      );

      // Re-lanzar la excepción. Si viene del proxy, ya es una HttpException con el status correcto
      throw error;
    }
  }

  /**
   * NUEVO ENDPOINT - PROCESAR IMAGEN Y BUSCAR SIMILARES EN QDRANT
   * Combina: procesamiento de imagen + generación de embeddings + búsqueda en vector DB
   */

  /**
   * Construye texto para embedding a partir de un producto normalizado
   */

  @Post('process-image-preview')
  @UseInterceptors(FileInterceptor('image'))
  async processImagePreview(
    @UploadedFile() image: Express.Multer.File,
    @Body() body: ProcessImageAndSearchDto,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      if (!image) throw new BadRequestException('Image file required');

      const mayorista = this.extractMayoristaName(image.originalname);

      // 1. Procesar imagen
      const processedImage = await this.imagePreprocessor.preprocessImage(
        image.buffer,
      );
      const productosExtraidos =
        await this.geminiMultimodalService.processCatalogImage(
          processedImage,
          body.company,
        );

      // 2. Normalizar productos extraídos (calcular precio unitario)
      const productosNormalizados = productosExtraidos.map((p) =>
        this.normalizeExtractedProduct(p),
      );

      const productosConMayorista = productosNormalizados.map((p) => ({
        ...p,
        mayorista,
      }));

      // 2. Para cada producto, buscar con filtros EXACTOS
      const resultadosPreview: any = [];

      for (const producto of productosConMayorista) {
        try {
          // 🎯 CAMBIO AQUÍ: Usamos el nuevo método para crear el texto de consulta
          const textoParaEmbedding = this.buildQueryTextForEmbedding(producto); // buildExactFilters debe filtrar SÓLO por peso, como lo tienes.

          // FILTROS EXACTOS: solo unidad (peso)
          const filters = this.buildExactFilters(producto);

          const coincidencias =
            await this.excelProcessingService.searchSimilarProducts(
              textoParaEmbedding,
              10,
              0.65,
              filters,
            );

          // 🎯 PASO DE INTEGRACIÓN: APLICAR EL BOOST Y FILTRAR
          const coincidenciasConBoost = this.aplicarBoostYFiltroScore(
            producto,
            coincidencias,
          );

          resultadosPreview.push({
            producto_extraido: producto,
            coincidencias: coincidenciasConBoost,
            total_coincidencias: coincidenciasConBoost.length,
          });
        } catch (error) {
          resultadosPreview.push({
            producto_extraido: producto,
            coincidencias: [],
            total_coincidencias: 0,
            error: error.message,
          });
        }
      }

      const dataParaLLM: ProcessCatalogData = {
        productos_procesados: productosConMayorista.length,
        preview: resultadosPreview, // Usamos los datos ya con score_ajustado
      };

      this.logger.log(
        `🤖 Enviando ${dataParaLLM.preview.length} productos al LLM para Re-ranking y Filtro Fino...`,
      );

      // 🎯 PASO FINAL: LLAMADA AL LLM RE-RANKER
      const dataFiltradaPorLLM =
        await this.geminiMultimodalService.processAllReRanking(
          dataParaLLM, // Se envía la estructura completa
        );

      // La respuesta del LLM ya tiene los arrays 'coincidencias' filtrados (o vacíos)
      const finalProcessingTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          productos_procesados: productosConMayorista.length,
          preview: dataFiltradaPorLLM.preview,
        },
        metadata: {
          processingTime: finalProcessingTime,
          mayorista,
          method: 'multimodal_re_ranking',
          model: 'gemini-2.5-pro',
        },
      };
    } catch (error) {
      throw new HttpException(
        `Processing failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeExtractedProduct(producto: any): any {
    const pack = producto.cantidad_pack_venta || 1;
    const precioCatalogo = producto.precio_final_catalogo;

    // Calcula el precio unitario para la consulta
    const precioUnitarioNormalizado = precioCatalogo / pack;

    return {
      ...producto,
      // Nuevo campo para el precio unitario calculado que se usará para matching
      precio_unitario_normalizado: parseFloat(
        precioUnitarioNormalizado.toFixed(4),
      ),
    };
  }

  private aplicarBoostYFiltroScore(
    productoExtraido: any,
    coincidencias: any[], // El resultado crudo de Qdrant
  ): any[] {
    const BOOST_VALUE = 0.1;
    // Umbral de score base para limpiar el ruido bajo, ya que el LLM hará la discriminación fina
    const MIN_SCORE_THRESHOLD = 0.65;

    // 1. Calcular el score_ajustado para cada coincidencia
    const coincidenciasConBoost = coincidencias.map((c) => {
      let scoreAjustado = c.score;

      // Se asume que c.payload.marca y productoExtraido.marca existen
      if (
        productoExtraido.marca &&
        c.payload.marca &&
        c.payload.marca.toUpperCase() === productoExtraido.marca.toUpperCase()
      ) {
        // Aplicar el BOOST si la marca coincide
        scoreAjustado += BOOST_VALUE;
      }

      return {
        ...c,
        score_ajustado: parseFloat(scoreAjustado.toFixed(5)), // Asegurar formato de punto flotante
      };
    });

    // 2. Aplicar un filtro de score base para no pasar a Gemini coincidencias muy irrelevantes (ej: < 0.65)
    return coincidenciasConBoost.filter((c) => c.score >= MIN_SCORE_THRESHOLD);
  }

  /**
   * Arma el texto de consulta (query) para el embedding de Qdrant.
   * Incluye tipo_producto y marca para alta precisión semántica.
   */
  private buildQueryTextForEmbedding(producto: NormalizedProduct): string {
    const parts: string[] = [];

    if (producto.categoria_inferida) {
      parts.push(producto.categoria_inferida);
    }

    //2. Marca (Ej. "COCINERO")
    if (producto.marca) {
      parts.push(producto.marca);
    }

    // 1. Producto Normalizado (Ej. "ACEITE GIRASOL COCINERO")
    if (producto.producto_normalizado) {
      parts.push(producto.producto_normalizado);
    }

    if (producto.unidad_count != null) {
      parts.push(producto.unidad_count.toString());
    }

    // Unimos los componentes, limpiando espacios redundantes.
    const queryText = parts.join(' ');

    this.logger.debug(`Texto de Consulta para Embedding: ${queryText}`);

    return queryText.replace(/\s+/g, ' ').trim();
  }

  private buildExactFilters(producto: NormalizedProduct): Record<string, any> {
    const filters: Record<string, any> = {};

    // =========================================================================
    // 🎯 FILTRO ESTRICTO 0: MARCA (si la confianza es alta)
    // =========================================================================
    // Aplicamos el filtro de marca si la extracción de Gemini fue con alta confianza (ej: >= 0.90)
    // Esto es crucial para reducir el espacio de búsqueda.
    if (producto.marca && producto.confidence && producto.confidence >= 0.9) {
      // Se asume que en Qdrant el campo se llama 'marca' y es case-insensitive (o se normaliza a mayúsculas)
      filters.marca = producto.marca.toUpperCase();
      // Nota: Si usas GESCOM, este filtro puede ser por 'codigo_proveedor' o 'rubro' si la marca es inconsistente.
    }

    // --- FILTRO 1: Conteo de Unidades Exacto (Pack) ---
    // Si la extracción nos da un pack (ej: 6 botellas, pack de 100 sobres).
    if (
      producto.cantidad_pack &&
      typeof producto.cantidad_pack === 'number' &&
      producto.cantidad_pack > 1
    ) {
      // Aplicamos filtro de conteo y TERMINAMOS la función.
      filters.unidad_count = producto.cantidad_pack;
      this.logger.debug(
        `Filtro Exacto: Agregando Conteo de Unidades (Pack): ${producto.cantidad_pack}`,
      );
      return filters;
    }

    // --- FILTRO 2: Unidad exacta (Peso/Volumen) ---
    // Este bloque solo se ejecuta para UNIDADES SIMPLES (cantidad_pack = 1 o null).
    if (producto.unidad_medida) {
      let normalizedUnit = producto.unidad_medida;

      // 🚨 PASO CRÍTICO: IDENTIFICAR Y OMITIR UNIDADES DE CONTEO
      const countKeywords = [
        'SOBRE',
        'UNIDAD',
        'PAR',
        'PAQUETE',
        'PACK',
        'TABLETA',
        'BLISTER',
        'FRASCO',
      ];
      const isCountUnit = countKeywords.some((keyword) =>
        normalizedUnit.toUpperCase().includes(keyword),
      );

      if (isCountUnit) {
        // Si es una unidad de conteo (ej: "100 sobres", "1 par", "1 unidad"), NO APLICAMOS FILTRO EXACTO DE PESO.
        // La búsqueda debe depender solo del embedding vectorial.
        this.logger.debug(
          `Filtro Exacto: Omitiendo filtro de Peso/Volumen: La unidad es de conteo (${normalizedUnit})`,
        );
        return filters; // Terminamos sin aplicar filtro exacto.
      }

      // 1. Unificar a mayúsculas y quitar espacios
      // ... (TU LÓGICA DE NORMALIZACIÓN DE UNIDADES DE PESO/VOLUMEN) ...
      normalizedUnit = normalizedUnit
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/,/g, '.');

      // 2. Estandarización de unidades (CRÍTICA)
      normalizedUnit = normalizedUnit
        // Liquidos
        .replace(/LITRO|LITROS|LT/, 'L')
        .replace('CC', 'ML')
        // Sólidos
        .replace(/KILOS/, 'KG')
        .replace(/K$/, 'KG')
        .replace(/GRAMOS/, 'G')
        .replace(/GR/, 'G');

      // ... (Tu lógica adicional de normalización) ...

      filters.peso = normalizedUnit.trim();
      this.logger.debug(
        `Filtro Exacto: Agregando Peso Normalizado: ${filters.peso}`,
      );
    }

    return filters;
  }

  private extractMayoristaName(filename: string): string {
    const withoutExtension = filename.replace(/\.[^/.]+$/, '');
    return (
      withoutExtension.split(/[_\-\s]+/)[0]?.toUpperCase() || 'DESCONOCIDO'
    );
  }

  /**
   * ENDPOINT PARA BUSCAR PRODUCTOS SIMILARES
   */
  @Post('search-similar')
  async searchSimilarProducts(
    @Body() body: { text: string; limit?: number },
  ): Promise<{ success: boolean; results: any[] }> {
    try {
      const results = await this.excelProcessingService.searchSimilarProducts(
        body.text,
        body.limit || 5,
      );

      return {
        success: true,
        results,
      };
    } catch (error) {
      this.logger.error('Error searching similar products:', error);
      throw new HttpException(
        `Search failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('recreate-collection')
  async recreateCollection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.qdrantService.clearCollection();

      // Volver a subir los datos del Excel
      // (necesitarías tener el archivo Excel disponible)

      return {
        success: true,
        message: 'Collection recreated. Please re-upload Excel data.',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to recreate collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('collection-qdrant')
  async getQdrantCollectionInfo(): Promise<any> {
    try {
      const info = await this.qdrantService.getCollectionInfo();
      return info;
    } catch (error) {
      this.logger.error('Error getting Qdrant collection info:', error);
      throw new HttpException(
        `Failed to get collection info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
