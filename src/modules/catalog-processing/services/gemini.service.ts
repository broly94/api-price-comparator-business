// // src/modules/catalog-processing/services/gemini.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
// import { NormalizedProduct } from '../../../common/interfaces/catalog-processing.interface';

// @Injectable()
// export class GeminiService {
//   private readonly logger = new Logger(GeminiService.name);
//   private genAI: GoogleGenAI;
//   private isConfigured = false;

//   constructor(private configService: ConfigService) {
//     this.initializeGemini();
//   }

//   private initializeGemini() {
//     try {
//       const apiKey = this.configService.get('GOOGLE_GEMINI_API_KEY');

//       if (!apiKey) {
//         this.logger.warn(
//           'GOOGLE_GEMINI_API_KEY not found, Gemini service will be disabled',
//         );
//         return;
//       }

//       this.genAI = new GoogleGenAI({ apiKey: apiKey });

//       this.isConfigured = true;

//       this.logger.log(
//         '✅ Gemini service configured successfully with gemini-1.5-flash model',
//       );
//     } catch (error) {
//       this.logger.error('❌ Failed to initialize Gemini:', error);
//     }
//   }

//   // Mantener tu servicio Gemini actual, pero agregar este método adicional:
//   async normalizeProductData(
//     ocrText: string,
//     company?: string,
//   ): Promise<NormalizedProduct | null> {
//     if (!this.isConfigured) {
//       this.logger.warn('Gemini service not configured');
//       return null;
//     }

//     try {
//       this.logger.log(`🤖 Gemini processing: ${ocrText.substring(0, 100)}...`);

//       const prompt = this.buildNormalizationPrompt(ocrText, company);
//       const result: GenerateContentResponse =
//         await this.genAI.models.generateContent({
//           model: 'gemini-2.5-flash',
//           contents: prompt,
//           config: {
//             responseMimeType: 'application/json',
//             responseSchema: {
//               type: 'object',
//               properties: {
//                 es_producto: { type: 'boolean' },
//                 producto_normalizado: { type: 'string' },
//                 precio_normalizado: { type: 'number' },
//                 precio_xl1: { type: ['number', 'null'] },
//                 marca: { type: ['string', 'null'] },
//                 unidad: { type: ['string', 'null'] },
//                 categoria_inferida: { type: ['string', 'null'] },
//               },
//               required: ['es_producto'],
//             },
//           },
//         });

//       const text = result.text;

//       if (!text) {
//         this.logger.warn('Empty response from Gemini');
//         return null;
//       }

//       this.logger.log(`📨 Raw Gemini response: ${text.substring(0, 150)}...`);

//       const normalizedProduct = this.parseGeminiResponse(text, ocrText);

//       if (normalizedProduct) {
//         this.logger.log(
//           `🎉 SUCCESS: ${normalizedProduct.producto_normalizado} - $${normalizedProduct.precio_normalizado}`,
//         );
//       } else {
//         this.logger.log(`⏩ Not a product or parsing failed`);
//       }

//       return normalizedProduct;
//     } catch (error: any) {
//       this.logger.error(`❌ Gemini API error: ${error.message}`);
//       return null;
//     }
//   }

//   private looksLikeProduct(text: string): boolean {
//     const lowerText = text.toLowerCase();

//     // Filtrar textos que NO son productos
//     if (text.length < 5) return false;
//     if (lowerText.includes('vigencia')) return false;
//     if (lowerText.includes('abasto')) return false;
//     if (lowerText.includes('mayorista')) return false;
//     if (lowerText.includes('ahorro')) return false;

//     // Textos que SÍ parecen productos
//     const productIndicators = [
//       '$',
//       'precio',
//       'kg',
//       'gr',
//       'ml',
//       'unidad',
//       'pack',
//       'x',
//       'queso',
//       'papa',
//       'shampoo',
//       'jabón',
//       'aceite',
//       'arroz',
//     ];

//     return productIndicators.some((indicator) => lowerText.includes(indicator));
//   }

//   private buildNormalizationPrompt(ocrText: string, company?: string): string {
//     return `
// Eres un especialista en procesar catálogos de supermercados${company ? ` ${company}` : ''}.

// TEXTO EXTRAÍDO DE CATÁLOGO (puede tener errores de OCR):
// "${ocrText}"

// INSTRUCCIONES CRÍTICAS:
// 1. **precio_normalizado es OBLIGATORIO** - SIEMPRE debe estar presente
// 2. Si no hay precio explícito, INFIÉRELO de patrones como:
//    - "s6.999" → 6999
//    - "$3.499" → 3499
//    - "PRECIO XL1: $1.299" → precio_normalizado: 1299, precio_xl1: 1299
// 3. Si realmente NO puedes inferir un precio, usa 0 pero marca como producto

// RESPONDER EXCLUSIVAMENTE con JSON:

// SI ES PRODUCTO (aunque el precio no sea perfecto):
// {
//   "es_producto": true,
//   "producto_normalizado": "nombre completo corregido y normalizado",
//   "precio_normalizado": 6999,  // ← OBLIGATORIO - NUNCA omitir
//   "precio_xl1": null,          // solo si aparece "PRECIO XL1"
//   "marca": "marca si se identifica",
//   "unidad": "unidad si se identifica (kg, ml, etc.)",
//   "categoria_inferida": "categoría apropiada"
// }

// SI NO ES PRODUCTO (solo texto descriptivo o título):
// {
//   "es_producto": false
// }

// EJEMPLOS CORRECTOS:
// Texto: "s6.999 MCSAN Papas corte tradicional x1.4kg"
// → {"es_producto":true,"producto_normalizado":"Papas corte tradicional x1.4kg","precio_normalizado":6999,"marca":"MCSAN","unidad":"1.4kg","categoria_inferida":"Snacks"}

// Texto: "Queso Mozzarella $3.499"
// → {"es_producto":true,"producto_normalizado":"Queso Mozzarella","precio_normalizado":3499,"marca":null,"unidad":null,"categoria_inferida":"Lácteos"}

// Texto: "PRECIO XL1: $1.299 Shampoo x350ml"
// → {"es_producto":true,"producto_normalizado":"Shampoo x350ml","precio_normalizado":1299,"precio_xl1":1299,"unidad":"350ml","categoria_inferida":"Higiene"}

// NO PUEDES omitir "precio_normalizado". Si no hay precio claro, INFIERE o usa 0.
// `;
//   }

//   private parseGeminiResponse(
//     content: string,
//     originalText: string,
//   ): NormalizedProduct | null {
//     try {
//       // Limpiar y extraer JSON
//       const cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
//       const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);

//       if (!jsonMatch) {
//         this.logger.warn(
//           `❌ No JSON found in response: ${content.substring(0, 100)}...`,
//         );
//         return null;
//       }

//       const parsed = JSON.parse(jsonMatch[0]);

//       // Si no es producto, retornar null
//       if (parsed.es_producto === false) {
//         return null;
//       }

//       // VALIDACIÓN MÁS FLEXIBLE DEL PRECIO
//       let precioNormalizado = 0;

//       // Estrategia 1: Usar el precio del JSON si existe
//       if (
//         parsed.precio_normalizado !== undefined &&
//         parsed.precio_normalizado !== null
//       ) {
//         precioNormalizado = Number(parsed.precio_normalizado);
//       }
//       // Estrategia 2: Extraer precio del texto original OCR
//       else {
//         const priceMatches = [
//           // Patrón "s6.999"
//           ...originalText.matchAll(/(?:s|\$)(\d{1,3}(?:\.\d{3})*)/g),
//           // Patrón "$ 3.499"
//           ...originalText.matchAll(/(?:\$)\s*(\d{1,3}(?:\.\d{3})*)/g),
//           // Patrón numérico simple - CORREGIDO:
//           ...originalText.matchAll(/(\d{1,4}(?:\.\d{3}))/g),
//         ];

//         if (priceMatches.length > 0) {
//           const firstPrice = priceMatches[0][1];
//           precioNormalizado = parseInt(firstPrice.replace(/\./g, ''));
//           this.logger.log(
//             `💰 Extracted price from OCR text: ${precioNormalizado}`,
//           );
//         } else {
//           // Estrategia 3: Usar 0 como fallback pero permitir el producto
//           precioNormalizado = 0;
//           this.logger.warn(
//             `⚠️  No price found, using 0 for: ${parsed.producto_normalizado}`,
//           );
//         }
//       }

//       // Validación MÍNIMA: solo requerir nombre del producto
//       if (
//         !parsed.producto_normalizado ||
//         parsed.producto_normalizado.trim().length === 0
//       ) {
//         this.logger.warn(
//           `❌ Missing product name in: ${content.substring(0, 100)}...`,
//         );
//         return null;
//       }

//       // Construir producto normalizado
//       const normalizedProduct: NormalizedProduct = {
//         producto_normalizado: parsed.producto_normalizado.trim(),
//         precio_normalizado: precioNormalizado,
//         precio_xl1: parsed.precio_xl1 ? Number(parsed.precio_xl1) : null,
//         marca: parsed.marca || null,
//         unidad: parsed.unidad || null,
//         categoria_inferida: parsed.categoria_inferida || null,
//         confidence: 0.9,
//         rawText: originalText,
//       };

//       this.logger.log(
//         `✅ Successfully parsed: ${normalizedProduct.producto_normalizado} - $${normalizedProduct.precio_normalizado}`,
//       );
//       return normalizedProduct;
//     } catch (error) {
//       this.logger.error(
//         `❌ Parse error: ${error.message}. Content: ${content.substring(0, 100)}...`,
//       );
//       return null;
//     }
//   }
// }
