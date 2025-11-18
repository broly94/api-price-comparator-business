// // src/modules/catalog-processing/services/gpt4.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { OpenAI } from 'openai';
// import { NormalizedProduct } from '../../../common/interfaces/catalog-processing.interface';

// @Injectable()
// export class Gpt4Service {
//   private readonly logger = new Logger(Gpt4Service.name);
//   private openai: OpenAI;

//   constructor(private configService: ConfigService) {
//     this.openai = new OpenAI({
//       apiKey: this.configService.get('OPENAI_API_KEY'),
//     });
//   }

//   async normalizeProductData(
//     ocrText: string,
//     company?: string,
//   ): Promise<NormalizedProduct | null> {
//     try {
//       this.logger.log(
//         `Normalizing product data for company: ${company || 'unknown'}`,
//       );

//       const prompt = this.buildNormalizationPrompt(ocrText, company);

//       const response = await this.openai.chat.completions.create({
//         model: 'gpt-4o-mini',
//         messages: [{ role: 'user', content: prompt }],
//         temperature: 0.1,
//         max_tokens: 500,
//       });

//       const content = response.choices[0].message?.content;
//       if (!content) {
//         throw new Error('Empty response from GPT-4');
//       }

//       const normalizedProduct = this.parseGptResponse(content);
//       normalizedProduct.rawText = ocrText; // Guardar texto original para debugging

//       this.logger.log(
//         `Successfully normalized: ${normalizedProduct.producto_normalizado}`,
//       );
//       return normalizedProduct;
//     } catch (error) {
//       this.logger.error(
//         `Error normalizing product data: ${error.message}`,
//         error.stack,
//       );
//       return null;
//     }
//   }

//   private buildNormalizationPrompt(ocrText: string, company?: string): string {
//     return `
// Eres un especialista en procesar catálogos de supermercados${company ? ` ${company}` : ''}.

// TEXTO OCR (puede tener errores de reconocimiento):
// "${ocrText}"

// INSTRUCCIONES:
// 1. Corrige errores comunes de OCR
// 2. Extrae la información en formato JSON válido
// 3. Normaliza nombres de productos y marcas
// 4. Convierte precios a formato numérico

// CAMPOS REQUERIDOS:
// - producto_normalizado (string): nombre del producto corregido y normalizado
// - precio_normalizado (number): precio como número (sin símbolos de moneda)
// - precio_xl1 (number|null): precio por mayor si está disponible
// - marca (string|null): marca del producto
// - unidad (string|null): unidad de medida (kg, ml, gr, unidades, etc.)
// - categoria_inferida (string|null): categoría que mejor describa el producto

// REGLAS DE NORMALIZACIÓN:
// - "sX.XXX" → error OCR de "$X.XXX" → convertir a número: XXXX
// - "PRECIO XL1" → precio por mayor
// - Corregir: "Shamco/"→"Shampoo", "Lavayillas"→"Lavavajillas"
// - Normalizar unidades: "x1.4kg" → "1.4kg", "350ml" → "350ml"
// - Si no hay información para un campo, usar null

// RESPONDER SOLAMENTE con JSON válido, sin texto adicional.
// `;
//   }

//   private parseGptResponse(content: string): NormalizedProduct {
//     try {
//       // Limpiar respuesta y extraer JSON
//       const jsonMatch = content.match(/\{[\s\S]*\}/);
//       if (!jsonMatch) {
//         throw new Error('No JSON found in GPT response');
//       }

//       const parsed = JSON.parse(jsonMatch[0]);

//       // Validar campos requeridos
//       if (!parsed.producto_normalizado || !parsed.precio_normalizado) {
//         throw new Error('Missing required fields in normalized product');
//       }

//       return {
//         producto_normalizado: parsed.producto_normalizado,
//         precio_normalizado: Number(parsed.precio_normalizado),
//         precio_xl1: parsed.precio_xl1 ? Number(parsed.precio_xl1) : null,
//         marca: parsed.marca || null,
//         unidad: parsed.unidad || null,
//         categoria_inferida: parsed.categoria_inferida || null,
//         confidence: 0.9, // Podríamos calcular esto basado en la respuesta
//       };
//     } catch (error) {
//       this.logger.error(`Error parsing GPT response: ${error.message}`);
//       throw new Error(`Failed to parse GPT-4 response: ${error.message}`);
//     }
//   }
// }
