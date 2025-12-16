// // src/modules/catalog-processing/services/google-vision.service.ts
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { ImageAnnotatorClient } from '@google-cloud/vision';
// import {
//   OcrResult,
//   TextRegion,
// } from '../../../common/interfaces/catalog-processing.interface';
// import * as path from 'path';
// import * as fs from 'fs';

// @Injectable()
// export class GoogleVisionService implements OnModuleInit {
//   private readonly logger = new Logger(GoogleVisionService.name);
//   private client: ImageAnnotatorClient;

//   constructor(private configService: ConfigService) {}

//   onModuleInit() {
//     this.initializeGoogleVision();
//   }

//   private initializeGoogleVision() {
//     try {
//       const credentialsPath = this.configService.get(
//         'GOOGLE_APPLICATION_CREDENTIALS',
//       );

//       if (credentialsPath) {
//         if (fs.existsSync(credentialsPath)) {
//           this.logger.log(
//             `✅ Google Vision credentials found at: ${credentialsPath}`,
//           );
//           this.client = new ImageAnnotatorClient({
//             keyFilename: credentialsPath,
//           });
//         } else {
//           this.logger.warn(
//             `❌ Google Vision credentials file not found at: ${credentialsPath}`,
//           );
//           this.initializeWithAPIKey();
//         }
//       } else {
//         this.logger.warn(
//           'ℹ️  GOOGLE_APPLICATION_CREDENTIALS not set, trying API key...',
//         );
//         this.initializeWithAPIKey();
//       }
//     } catch (error) {
//       this.logger.error('❌ Error initializing Google Vision:', error);
//       throw new Error('Failed to initialize Google Vision client');
//     }
//   }

//   private initializeWithAPIKey() {
//     const apiKey = this.configService.get('GOOGLE_VISION_API_KEY');
//     if (apiKey) {
//       this.logger.log('✅ Using Google Vision with API Key');
//     } else {
//       this.logger.error('❌ No Google Vision credentials available');
//       throw new Error('Google Vision credentials not configured');
//     }
//   }

//   async extractTextFromImage(imageBuffer: Buffer): Promise<OcrResult[] | any> {
//     if (!this.client) {
//       throw new Error('Google Vision client not initialized');
//     }

//     try {
//       this.logger.log('🔍 Extracting text from image with Google Vision...');

//       const [result] = await this.client.textDetection(imageBuffer);
//       const detections = result.textAnnotations;

//       if (!detections || detections.length === 0) {
//         this.logger.warn('⚠️  No text detected in image');
//         return [];
//       }

//       const textBlocks = detections.slice(1).map((detection) => ({
//         text: detection.description || '',
//         boundingBox: detection.boundingPoly,
//         confidence: detection.confidence || 0,
//       }));

//       this.logger.log(`✅ Extracted ${textBlocks.length} text blocks`);
//       return textBlocks;
//     } catch (error) {
//       this.logger.error('❌ Error in Google Vision OCR:', error);
//       throw new Error(`Google Vision OCR failed: ${error.message}`);
//     }
//   }

//   async extractStructuredData(imageBuffer: Buffer): Promise<TextRegion[]> {
//     const textBlocks = await this.extractTextFromImage(imageBuffer);
//     return this.groupTextIntoProductRegions(textBlocks);
//   }

//   /**
//    * NUEVO: Agrupa bloques de texto en regiones de productos completos
//    */
//   private groupTextIntoProductRegions(textBlocks: OcrResult[]): TextRegion[] {
//     if (textBlocks.length === 0) return [];

//     // Ordenar bloques por posición Y (de arriba a abajo)
//     const sortedBlocks = this.sortBlocksByPosition(textBlocks);

//     const productRegions: TextRegion[] = [];
//     let currentProduct: OcrResult[] = [];
//     let currentGroupY = sortedBlocks[0]?.boundingBox?.vertices[0]?.y || 0;

//     for (let i = 0; i < sortedBlocks.length; i++) {
//       const block = sortedBlocks[i];
//       const blockY = block.boundingBox?.vertices[0]?.y || 0;

//       // Si hay un salto vertical significativo, es un nuevo producto
//       const verticalGap = Math.abs(blockY - currentGroupY);
//       if (verticalGap > 50 && currentProduct.length > 0) {
//         // 50px de tolerancia
//         const productText = this.buildProductText(currentProduct);
//         if (this.isLikelyProduct(productText)) {
//           productRegions.push({
//             text: productText,
//             regionType: 'product',
//             boundingBox: currentProduct[0].boundingBox,
//           });
//         }
//         currentProduct = [];
//       }

//       currentProduct.push(block);
//       currentGroupY = blockY;
//     }

//     // Procesar el último grupo
//     if (currentProduct.length > 0) {
//       const productText = this.buildProductText(currentProduct);
//       if (this.isLikelyProduct(productText)) {
//         productRegions.push({
//           text: productText,
//           regionType: 'product',
//           boundingBox: currentProduct[0].boundingBox,
//         });
//       }
//     }

//     this.logger.log(`🔄 Grouped into ${productRegions.length} product regions`);
//     return productRegions;
//   }

//   /**
//    * Ordena bloques por posición vertical y horizontal
//    */
//   private sortBlocksByPosition(textBlocks: OcrResult[]): OcrResult[] {
//     return [...textBlocks].sort((a, b) => {
//       const aY = a.boundingBox?.vertices[0]?.y || 0;
//       const bY = b.boundingBox?.vertices[0]?.y || 0;
//       const aX = a.boundingBox?.vertices[0]?.x || 0;
//       const bX = b.boundingBox?.vertices[0]?.x || 0;

//       // Primero por Y (vertical), luego por X (horizontal)
//       if (Math.abs(aY - bY) < 20) {
//         // Misma línea
//         return aX - bX;
//       }
//       return aY - bY;
//     });
//   }

//   /**
//    * Construye el texto completo del producto uniendo bloques relevantes
//    */
//   private buildProductText(blocks: OcrResult[]): string {
//     const relevantTexts = blocks
//       .map((block) => block.text.trim())
//       .filter((text) => {
//         // Filtrar textos que no son productos
//         return !this.isNonProductText(text);
//       })
//       .join(' ');

//     return relevantTexts;
//   }

//   /**
//    * Determina si un texto es probablemente un producto completo
//    */
//   private isLikelyProduct(text: string): boolean {
//     if (!text || text.length < 5) return false;

//     const lowerText = text.toLowerCase();

//     // Excluir textos que definitivamente NO son productos
//     if (this.isNonProductText(text)) {
//       return false;
//     }

//     // Debe contener al menos un indicador de producto
//     const productIndicators = [
//       // Precios
//       /\$(?:\d+[,.]?)+\d*/,
//       /s(?:\d+[,.]?)+\d*/,
//       // Unidades de medida
//       /\d+\s*(?:kg|gr|ml|lt|unidad|pack|x\d)/i,
//       // Productos comunes
//       /aceite|shampoo|queso|papa|arroz|fideo|mozzarella|jabón|lavavajillas|higienol|cerveza/i,
//       // Marcas comunes en tu catálogo
//       /mccain|suave|cucint|ala|higienol|plus|prestobarba|ultragrip|clight|corona/i,
//     ];

//     return productIndicators.some((indicator) => indicator.test(lowerText));
//   }

//   /**
//    * Identifica textos que NO son productos
//    */
//   private isNonProductText(text: string): boolean {
//     const lowerText = text.toLowerCase();

//     const nonProductKeywords = [
//       'mayorista',
//       'ahorro',
//       'supermayorista',
//       'vigencia',
//       'abasto',
//       'ortúzar',
//       'nuestras',
//       'marcas',
//       'clasicas',
//       'pureza',
//       'domino',
//       'fiesta',
//       'cocinero',
//       'llebas',
//       'varios',
//       'sabores',
//       'varlas',
//       'fragancias',
//       'máquina',
//     ];

//     return nonProductKeywords.some((keyword) => lowerText.includes(keyword));
//   }

//   /**
//    * MÉTODO NUEVO: Extraer solo regiones de productos (más preciso)
//    */
//   async extractProductRegions(imageBuffer: Buffer): Promise<TextRegion[]> {
//     const textBlocks = await this.extractTextFromImage(imageBuffer);
//     const productRegions = this.groupTextIntoProductRegions(textBlocks);

//     // Filtrar solo las regiones que son productos probables
//     const filteredRegions = productRegions.filter((region) =>
//       this.isLikelyProduct(region.text),
//     );

//     this.logger.log(
//       `🎯 Found ${filteredRegions.length} likely product regions`,
//     );

//     return filteredRegions;
//   }

//   private classifyTextRegion(text: string): TextRegion['regionType'] {
//     const lowerText = text.toLowerCase();

//     if (/\$\d+[,.]?\d*/.test(text) || /s\d+[,.]?\d*/.test(text)) {
//       return 'price';
//     }

//     if (lowerText.includes('precio') || lowerText.includes('xl1')) {
//       return 'price';
//     }

//     if (this.isLikelyProduct(text)) {
//       return 'product';
//     }

//     return 'unknown';
//   }
// }
