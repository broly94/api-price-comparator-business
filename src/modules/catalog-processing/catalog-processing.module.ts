// src/modules/catalog-processing/catalog-processing.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogProcessingController } from './catalog-processing.controller';
import { ImagePreprocessorService } from './services/image-preprocessor.service';
import { GeminiMultimodalService } from './services/gemini-multimodal.service';
import { EmbeddingService } from './services/embedding.service';
import { QdrantService } from './services/qdrant.service';
import { ExcelProcessingService } from './services/excel-processing.service';
//import { Gpt4Service } from './services/gpt4.service';
//import { GoogleVisionService } from './services/google-vision.service';
//import { GeminiService } from './services/gemini.service';
import { ProductNormalizationService } from './services/product-normalization.service';
import { QdrantController } from './qdrant.controller';
import { EtlProxyService } from './services/etl-proxy.service';

@Module({
  imports: [ConfigModule],
  controllers: [CatalogProcessingController, QdrantController],
  providers: [
    //GoogleVisionService,
    //Gpt4Service,
    //GeminiService,
    ImagePreprocessorService,
    GeminiMultimodalService,
    EmbeddingService,
    QdrantService,
    ExcelProcessingService,
    ProductNormalizationService,
    EtlProxyService,
  ],
  exports: [],
})
export class CatalogProcessingModule {}
