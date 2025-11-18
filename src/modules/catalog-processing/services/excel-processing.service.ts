// src/modules/catalog-processing/services/excel-processing.service.ts

import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from './qdrant.service';
import { ProductVector } from '@/common/interfaces/catalog-processing.interface';

export interface ExcelProduct {
  codigo: number;
  rubro: string;
  marca: string;
  descripcion: string;
  peso: string;
  precio: number;
}

@Injectable()
export class ExcelProcessingService {
  private readonly logger = new Logger(ExcelProcessingService.name);

  constructor(
    private embeddingService: EmbeddingService,
    private qdrantService: QdrantService,
  ) {}

  async checkServicesReady(): Promise<{ embedding: boolean; qdrant: boolean }> {
    return {
      embedding: this.embeddingService.isConfigured,
      qdrant: this.qdrantService.getStatus().initialized,
    };
  }

  async processExcelFromBuffer(
    buffer: Buffer,
  ): Promise<{ processed: number; total: number }> {
    try {
      const servicesStatus = await this.checkServicesReady();
      this.logger.debug('Services status:', servicesStatus);

      if (!servicesStatus.embedding) {
        throw new Error('Embedding service not configured.');
      }

      if (!servicesStatus.qdrant) {
        throw new Error('Qdrant service not initialized.');
      }

      // Leer Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convertir a JSON - mapear las columnas correctas
      const products: ExcelProduct[] = XLSX.utils.sheet_to_json(worksheet);
      console.log(products);

      this.logger.log(`📊 Found ${products.length} products in Excel`);

      // Debug: mostrar estructura de datos
      if (products.length > 0) {
        this.logger.debug('First product structure:', {
          codigo: products[0].codigo,
          rubro: products[0].rubro,
          marca: products[0].marca,
          descripcion: products[0].descripcion,
          peso: products[0].peso,
          precio: products[0].precio,
        });
      }

      const processedCount = await this.processProducts(products);

      return {
        processed: processedCount,
        total: products.length,
      };
    } catch (error) {
      this.logger.error('❌ Error processing Excel file:', error.message);
      throw error;
    }
  }

  private normalizeUnitForFilter(unit: string): string {
    if (!unit) return '';

    let normalizedUnit = unit;

    // 1. Unificar a mayúsculas y quitar espacios
    normalizedUnit = normalizedUnit
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/,/g, '.');

    // 2. Estandarización de unidades (HACER ESTO IDÉNTICO AL CONTROLLER)
    normalizedUnit = normalizedUnit
      // Liquidos
      .replace(/LITRO|LITROS|LT/, 'L')
      .replace('CC', 'ML')
      // Sólidos
      .replace(/KILOS/, 'KG')
      .replace(/K$/, 'KG') // Asegura que '1K' se convierta en '1KG'
      .replace(/GRAMOS/, 'G')
      .replace(/GR/, 'G'); // Convierte '400GR' o '400gr' a '400G'

    return normalizedUnit.trim();
  }

  async processProducts(products: ExcelProduct[]): Promise<number> {
    try {
      // Preparar textos para embeddings
      const textsForEmbedding = products.map((product) =>
        this.buildTextForEmbedding(product),
      );

      this.logger.log('Generating embeddings...');
      const embeddings =
        await this.embeddingService.generateEmbeddings(textsForEmbedding);

      // Verificar que los embeddings sean válidos
      if (!embeddings || embeddings.length === 0) {
        throw new Error('No embeddings generated');
      }

      // DEBUG: información sobre los embeddings
      this.logger.debug(`Generated ${embeddings.length} embeddings`);
      this.logger.debug(`First embedding length: ${embeddings[0].length}`);
      this.logger.debug(
        `First embedding sample: [${embeddings[0].slice(0, 3).join(', ')}...]`,
      );

      // Preparar productos para Qdrant - convertir código a número
      const productVectors: ProductVector[] = products.map((product, index) => {
        if (!embeddings[index]) {
          throw new Error(`No embedding for product at index ${index}`);
        }

        // Convertir código de string a número
        const codigoNumerico = Number(product.codigo);
        if (isNaN(codigoNumerico)) {
          this.logger.warn(
            `Invalid code format: ${product.codigo}, using hash instead`,
          );
          // Usar hash como fallback
          const hash = this.stringToHash(JSON.stringify(product.codigo));

          return {
            id: hash,
            vector: embeddings[index],
            payload: {
              codigo: codigoNumerico,
              rubro: product.rubro,
              marca: product.marca.toUpperCase().trim(),
              descripcion: product.descripcion,
              peso: this.normalizeUnitForFilter(product.peso),
              precio: product.precio,
              texto_para_embedding: textsForEmbedding[index],
            },
          };
        }

        return {
          id: codigoNumerico,
          vector: embeddings[index],
          payload: {
            codigo: codigoNumerico,
            rubro: product.rubro,
            marca: product.marca.toUpperCase().trim(),
            descripcion: product.descripcion,
            peso: this.normalizeUnitForFilter(product.peso),
            precio: product.precio,
            texto_para_embedding: textsForEmbedding[index],
          },
        };
      });

      // Subir a Qdrant
      await this.qdrantService.upsertProducts(productVectors);

      return products.length;
    } catch (error) {
      this.logger.error('❌ Error processing products:', error.message);
      throw error;
    }
  }

  // Agregar este método helper para generar hashes
  private stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private buildTextForEmbedding(product: ExcelProduct): string {
    return `
      Código: ${product.codigo};
      Rubro: ${product.rubro};
      Marca: ${product.marca};
      Descripción: ${product.descripcion};
      Peso: ${product.peso};
      Precio: $${product.precio};
    `
      .replace(/\s+/g, ' ')
      .trim();
  }

  async searchSimilarProducts(
    productText: string,
    limit: number = 5,
    scoreThreshold: number = 0.9,
    filters: Record<string, any> = {},
  ): Promise<any[]> {
    const embedding =
      await this.embeddingService.generateEmbedding(productText);
    return await this.qdrantService.searchSimilar(
      embedding,
      limit,
      scoreThreshold,
      filters,
    );
  }

  // Método para limpiar y reiniciar (útil para testing)
  async clearAndReprocess(
    buffer: Buffer,
  ): Promise<{ processed: number; total: number }> {
    await this.qdrantService.clearCollection();
    return this.processExcelFromBuffer(buffer);
  }
}
