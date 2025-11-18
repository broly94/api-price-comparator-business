// src/modules/catalog-processing/services/embedding.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private genAI: GoogleGenAI;
  public isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeGemini();
  }

  private initializeGemini() {
    try {
      const apiKey = this.configService.get('GOOGLE_GEMINI_API_KEY');

      if (!apiKey) {
        this.logger.warn('GOOGLE_GEMINI_API_KEY not found for embeddings');
        return;
      }

      this.genAI = new GoogleGenAI({ apiKey });
      this.isConfigured = true;
      this.logger.log('✅ Embedding service configured successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Embedding service:', error);
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) {
      throw new Error('Embedding service not configured');
    }

    try {
      this.logger.log(`Generating embeddings for ${texts.length} texts...`);

      const result = await this.genAI.models.embedContent({
        model: 'gemini-embedding-001',
        contents: texts,
      });

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error('No embeddings received from API');
      }

      const numericEmbeddings = result.embeddings
        .map((embedding) => embedding.values) // ✅ FIX: Filtra los valores undefined y usa un type guard
        .filter((values): values is number[] => values !== undefined);

      this.logger.debug('🔍 Processed embeddings:', {
        count: numericEmbeddings.length,
        firstLength: numericEmbeddings[0]?.length, // Esto DEBE ser 3072
        firstSample: numericEmbeddings[0]?.slice(0, 3),
      });

      this.logger.log(
        `✅ Successfully generated ${numericEmbeddings.length} embeddings`,
      );

      return numericEmbeddings;
    } catch (error) {
      this.logger.error(`❌ Embedding generation error: ${error.message}`);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  getEmbeddingDimensions(): number {
    return 3072;
  }
}
