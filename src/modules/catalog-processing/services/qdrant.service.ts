// src/modules/catalog-processing/services/qdrant.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  ProductVector,
  VectorSearchResult,
  VectorDbService,
} from '@/common/interfaces/catalog-processing.interface';

@Injectable()
export class QdrantService implements VectorDbService, OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private collectionName = 'supermarket_products';
  private vectorSize = 768;
  private isInitialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    try {
      const url = this.configService.get('QDRANT_URL');
      const apiKey = this.configService.get('QDRANT_API_KEY');

      if (!url) {
        this.logger.error('QDRANT_URL is not defined in environment variables');
        return;
      }

      if (!apiKey) {
        this.logger.error(
          'QDRANT_API_KEY is not defined in environment variables',
        );
        return;
      }

      this.client = new QdrantClient({
        url,
        apiKey,
      });

      // Verificar conexión
      await this.client.getCollections();
      this.isInitialized = true;
      this.logger.log('✅ Qdrant client initialized successfully');

      // Crear colección si no existe
      await this.createCollectionIfNotExists();
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Qdrant client:',
        error.message,
      );
      this.isInitialized = false;
    }
  }

  private async createCollectionIfNotExists(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.find(
        (col) => col.name === this.collectionName,
      );

      if (!exists) {
        // Crear colección
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });

        this.logger.log(`✅ Collection '${this.collectionName}' created`);

        // CREAR ÍNDICES para los campos que vamos a filtrar
        await this.createIndexes();
      } else {
        this.logger.log(
          `✅ Collection '${this.collectionName}' already exists`,
        );

        // Verificar si los índices existen, si no crearlos
        try {
          await this.createIndexes();
        } catch (error) {
          this.logger.warn(
            'Could not create indexes, they might already exist:',
            error.message,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error creating/checking collection:', error.message);
      throw error;
    }
  }

  /**
   * Crear índices para los campos de filtro
   */
  private async createIndexes(): Promise<void> {
    try {
      // Índice para marca (keyword - búsqueda exacta)
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'marca',
        field_schema: 'keyword',
      });

      // Índice para peso (keyword - búsqueda exacta)
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'peso',
        field_schema: 'keyword',
      });

      this.logger.log('✅ Indexes created for "marca" and "peso" fields');
    } catch (error) {
      this.logger.error('Error creating indexes:', error.message);
      throw error;
    }
  }

  /**
   * Convierte cualquier ID a un formato válido para Qdrant
   */
  private normalizeId(id: number | string): number {
    if (typeof id === 'string') {
      const num = Number(id);
      if (!isNaN(num) && Number.isInteger(num) && num >= 0) {
        return num;
      }
      return this.stringToHash(id);
    }

    if (typeof id === 'number') {
      if (id >= 0) {
        return id;
      }
      return this.stringToHash(id.toString());
    }

    return this.stringToHash(String(id));
  }

  private stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async upsertProducts(products: ProductVector[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Qdrant client not initialized.');
    }

    try {
      await this.ensureIndexes();

      const points = products.map((product) => {
        const normalizedId = this.normalizeId(product.id);

        // DEBUG: Verificar el vector
        if (!product.vector || !Array.isArray(product.vector)) {
          this.logger.error(
            `Invalid vector for product ${product.id}:`,
            product.vector,
          );
          throw new Error(`Invalid vector for product ${product.id}`);
        }

        if (product.vector.length !== this.vectorSize) {
          this.logger.warn(
            `Vector size mismatch for product ${product.id}: expected ${this.vectorSize}, got ${product.vector.length}`,
          );
        }

        return {
          id: normalizedId,
          vector: product.vector,
          payload: product.payload,
        };
      });

      this.logger.log(`Upserting ${points.length} points to Qdrant...`);

      // Usar el método correcto para upsert
      const result = await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });

      this.logger.log(
        `✅ Successfully upserted ${products.length} products to Qdrant`,
      );
      this.logger.debug(`Upsert result:`, result);
    } catch (error) {
      this.logger.error(
        '❌ Error upserting products to Qdrant:',
        error.message,
      );
      if (error.data) {
        this.logger.error(
          'Error details:',
          JSON.stringify(error.data, null, 2),
        );
      }
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    try {
      // Verificar si los índices existen
      const collectionInfo = await this.client.getCollection(
        this.collectionName,
      );
      const existingIndexes = collectionInfo.payload_schema || {};

      if (!existingIndexes.marca || !existingIndexes.peso) {
        this.logger.log('Creating missing indexes...');
        await this.createIndexes();
      }
    } catch (error) {
      this.logger.warn('Could not check indexes, creating them...');
      await this.createIndexes();
    }
  }

  async searchSimilar(
    vector: number[],
    limit: number = 5,
    scoreThreshold: number = 0.7,
    filters: Record<string, any> = {},
  ): Promise<VectorSearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      // Construir filtros CORREGIDOS para Qdrant
      let qdrantFilter = {};

      if (Object.keys(filters).length > 0) {
        const mustConditions = Object.keys(filters).map((key) => ({
          key: key,
          match: {
            value: filters[key],
          },
        }));

        qdrantFilter = {
          filter: {
            must: mustConditions,
          },
        };
      }

      const result = await this.client.search(this.collectionName, {
        vector,
        limit,
        score_threshold: scoreThreshold,
        ...qdrantFilter, // ← APLICAR FILTROS
      });

      return result.map((item) => ({
        id: item.id as number,
        score: item.score,
        payload: item.payload as any,
      }));
    } catch (error) {
      this.logger.error('❌ Error searching similar products:', error.message);
      if (error.data) {
        this.logger.error(
          'Qdrant error details:',
          JSON.stringify(error.data, null, 2),
        );
      }
      throw error;
    }
  }

  async getCollection() {
    const { points } = await this.client.scroll(this.collectionName, {
      limit: 50,
      with_payload: true,
      with_vector: false,
    });

    return points;
  }

  async getCollectionInfo() {
    if (!this.isInitialized) {
      throw new Error('Qdrant client not initialized');
    }

    return await this.client.getCollection(this.collectionName);
  }

  getStatus(): { initialized: boolean; collection: string } {
    return {
      initialized: this.isInitialized,
      collection: this.collectionName,
    };
  }

  // Método para limpiar la colección (útil para testing)
  async clearCollection(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Qdrant client not initialized');
    }

    try {
      await this.client.deleteCollection(this.collectionName);
      this.logger.log(`✅ Collection '${this.collectionName}' deleted`);
      await this.createCollectionIfNotExists();
    } catch (error) {
      this.logger.error('Error clearing collection:', error.message);
      throw error;
    }
  }
}
