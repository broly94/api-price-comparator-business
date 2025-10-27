// src/modules/catalog-processing/services/gemini-multimodal.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { NormalizedProduct } from '../../../common/interfaces/catalog-processing.interface';

@Injectable()
export class GeminiMultimodalService {
  private readonly logger = new Logger(GeminiMultimodalService.name);
  private genAI: GoogleGenAI;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeGemini();
  }

  private initializeGemini() {
    try {
      const apiKey = this.configService.get('GOOGLE_GEMINI_API_KEY');

      if (apiKey) {
        this.logger.debug(
          `Gemini API Key (Length: ${apiKey.length}): "${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}"`,
        );
      }

      if (!apiKey) {
        this.logger.warn('GOOGLE_GEMINI_API_KEY not found');
        return;
      }

      this.genAI = new GoogleGenAI({ apiKey });
      this.isConfigured = true;
      this.logger.log('✅ Gemini Multimodal service configured successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Gemini Multimodal:', error);
    }
  }

  async processCatalogImage(
    imageBuffer: Buffer,
    company?: string,
  ): Promise<NormalizedProduct[]> {
    if (!this.isConfigured) {
      this.logger.warn('Gemini Multimodal service not configured');
      return [];
    }

    try {
      this.logger.log('🖼️ Processing catalog image with Gemini Multimodal...');

      // CONVERTIR a base64 correctamente
      const imageBase64 = imageBuffer.toString('base64');

      const prompt = this.buildMultimodalPrompt(company);

      // LLAMADA MULTIMODAL CORRECTA con base64
      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp', // Modelo multimodal
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      const text = result.text;

      if (!text) {
        this.logger.warn('Empty response from Gemini Multimodal');
        return [];
      }

      this.logger.log('📨 Raw multimodal response received');
      this.logger.debug(`Response: ${text.substring(0, 500)}...`);

      const products = this.parseMultimodalResponse(text);
      this.logger.log(
        `🎉 Multimodal processing complete: ${products.length} products found`,
      );

      return products;
    } catch (error: any) {
      this.logger.error(`❌ Gemini Multimodal error: ${error.message}`);
      if (error.details) {
        this.logger.error(`Error details: ${JSON.stringify(error.details)}`);
      }
      return [];
    }
  }

  private buildMultimodalPrompt(company?: string): string {
    return `
Eres un especialista en procesar catálogos de supermercados${company ? ` ${company}` : ''}.

ANÁLISIS DE LA IMAGEN DEL CATÁLOGO:

INSTRUCCIONES CRÍTICAS:
1. Analiza DETALLADAMENTE la imagen completa del catálogo
2. Identifica TODOS los productos visibles con sus precios
3. DETERMINA SI EL PRECIO ES POR PACK O POR UNIDAD:
   - Si dice "12 x 250 GR" y precio $646.78 → EL PRECIO ES POR EL PACK COMPLETO
   - El precio mostrado es el PRECIO FINAL CON DESCUENTO
4. Busca indicadores de descuento como "%", "OFF", "oferta"
5. EXTRACCIÓN DE MARCAS:
   - La marca debe ser el nombre COMPLETO.
   - Ejemplo: Si el producto es "HIGIENOL PLUS Papel...", la marca es "HIGIENOL PLUS".
   - Ejemplo: "MAYONESA CADA DIA" → marca: "CADA DIA"
   - Ejemplo: "AC.GIRASOL NATURA" → marca: "NATURA"
   - Ejemplo: "PURE DE TOMATE ARCOR" → marca: "ARCOR"
6. NORMALIZACIÓN DE UNIDADES:
   - "250 GR" → "250g"
   - "1,5 LT" → "1.5L"
   - "1KG" → "1kg"
   - "530 GR" → "530g"
7. **EXTRACCIÓN O INFERENCIA DEL TIPO ESPECÍFICO (CRÍTICO):**
   - **Es obligatorio** determinar el subtipo para aceites, harinas, lácteos, etc.
   - **Si el tipo no es visible, debes INFERIRLO** por el color, diseño, o el nombre más común del producto en Argentina/Latinoamérica.
   - **SOLO USA "standard" como último recurso** si la inferencia es imposible.
   - Para aceites: "girasol", "mezcla", "oliva", "girasol alto oleico"
   - Para harinas: "000", "0000", "integral", "leudante" 
   - Para lácteos: "entera", "descremada", "semidescremada"
   - Para bebidas: "cola", "naranja", "lima", "pomelo", "light", "zero"
   - Para yogures: "natural", "saborizado", "griego", "bebible"
   - Para arroz: "largo", "redondo", "integral", "yamaní"
   - Para fideos: "tallarines", "moños", "tirabuzones", "coditos"
   - Si no hay tipo específico, usar "standard"



EJEMPLOS ESPECÍFICOS DE ESTA IMAGEN:

FORMATO DE RESPUESTA - SOLO JSON:
[
  {
    "producto_normalizado": "nombre completo del producto",
    "tipo_producto": "tipo específico (girasol, 000, cola, entera, etc.)",
    "precio_final_con_descuento": 646.78,     // PRECIO QUE SE VE EN LA IMAGEN (CON DESCUENTO)
    "precio_sin_descuento": 760.92,           // PRECIO ORIGINAL ANTES DEL DESCUENTO (calcular)
    "precio_por_unidad": 53.90,               // PRECIO POR UNIDAD INDIVIDUAL (precio_final / cantidad)
    "porcentaje_descuento": 15,               // % DE DESCUENTO SI SE INDICA
    "marca": "marca si existe",
    "cantidad_pack": 12,                      // CANTIDAD DE UNIDADES EN EL PACK (número)
    "unidad_medida": "250g",                  // UNIDAD DE MEDIDA POR CADA UNIDAD CON PRECISIÓN (250g, 1.5L, 1kg, etc)
    "descripcion_cantidad": "12 x 250g",      // DESCRIPCIÓN COMPLETA DE LA CANTIDAD
    "categoria_inferida": "categoría apropiada"
  }
]

REGLAS DE CÁLCULO Y CONVERSIÓN:

1. PARA PACKS CON CANTIDAD:
   Ejemplo: "MAYONESA CADA DIA 12 x 250 GR" a $646.78
   - precio_final_con_descuento: 646.78 (precio que se ve)
   - precio_sin_descuento: 646.78 / 0.85 = 760.92 (asumiendo 15% descuento)
   - precio_por_unidad: 646.78 / 12 = 53.90
   - cantidad_pack: 12
   - unidad_medida: "250g"
   - descripcion_cantidad: "12 x 250g"

2. PARA PRODUCTOS INDIVIDUALES:
   Ejemplo: "LECHE ENTERA 1L" a $320
   - precio_final_con_descuento: 320
   - precio_sin_descuento: 320 (si no hay descuento)
   - precio_por_unidad: 320
   - cantidad_pack: 1
   - unidad_medida: "1L"
   - descripcion_cantidad: "1 unidad"

3. REGLAS DE DESCUENTO:
   - Si no se indica descuento, asumir precio_sin_descuento = precio_final_con_descuento
   - Si se indica "% OFF" o similar, calcular el precio original
   - Para el ejemplo de la imagen, asumir 15% de descuento típico en supermercados

4. NORMALIZACIÓN DE UNIDADES:
   - "250 GR" → "250g"
   - "1,5 LT" → "1.5L" 
   - "1KG" → "1kg"
   - "530 GR" → "530g"

5. EXTRACCIÓN DE MARCAS:
   - "MAYONESA CADA DIA" → marca: "Cada Día"
   - "AC.GIRASOL NATURA" → marca: "Natura"
   - "PURE DE TOMATE ARCOR" → marca: "Arcor"

REGLAS DE EXTRACCIÓN:
- Busca en el nombre palabras clave que indiquen el tipo
- Usa siempre minúsculas
- **Si el producto es un aceite y no dice tipo, asume "girasol"** (el más común).
- **Si el producto es leche y no dice tipo, asume "entera"** (la más común).
- **SOLO** usa "standard" si es genérico (ej. Sprite común) o si no puedes inferir nada.

6. EJEMPLOS DE TIPOS DE PRODUCTO:

1. "ACEITE GIRASOL COCINERO" → tipo_producto: "girasol"
2. "ACEITE MEZCLA COCINERO" → tipo_producto: "mezcla"
3. "ACEITE OLIVA COCINERO" → tipo_producto: "oliva"
4. "HARINA 000 PUREZA" → tipo_producto: "000"
5. "HARINA 0000 PUREZA" → tipo_producto: "0000" 
6. "HARINA INTEGRAL PUREZA" → tipo_producto: "integral"
7. "LECHE ENTERA SANCOR" → tipo_producto: "entera"
8. "LECHE DESCREMADA SANCOR" → tipo_producto: "descremada"
9. "COCA COLA ORIGINAL" → tipo_producto: "cola"
10. "COCA COLA ZERO" → tipo_producto: "zero"
11. "SPRITE" → tipo_producto: "standard"
11. "SPRITE ZERO" → tipo_producto: "zero"
12. "YOGUR NATURAL" → tipo_producto: "natural"
13. "YOGUR FRUTILLA" → tipo_producto: "saborizado"
14. "ARROZ LARGO FINO" → tipo_producto: "largo"
15. "FIDEOS TALLARINES" → tipo_producto: "tallarines"

EJEMPLOS ESPECÍFICOS DE ESTA IMAGEN:

1. "MAYONESA CADA DIA 12 x 250 GR" - $646.78
   → precio_final: 646.78, precio_sin_descuento: 760.92, precio_por_unidad: 53.90

2. "AC.GIRASOL NATURA 12 x 1,5 LT" - $3788.11  
   → precio_final: 3788.11, precio_sin_descuento: 4456.60, precio_por_unidad: 315.68

3. "HARINA OOO CASERITA 10 x 1KG" - $601.43
   → precio_final: 601.43, precio_sin_descuento: 707.56, precio_por_unidad: 60.14

IMPORTANTE: 
- precio_final_con_descuento es SIEMPRE el precio que se ve en la imagen
- precio_por_unidad es precio_final dividido la cantidad del pack
- Si no puedes calcular descuentos, usa precio_sin_descuento = precio_final

Responde EXCLUSIVAMENTE con el array JSON, sin texto adicional.
`;
  }

  private parseMultimodalResponse(content: string): NormalizedProduct[] {
    try {
      const cleanedContent = content.replace(/```json\s*|\s*```/g, '').trim();
      const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        this.logger.warn('❌ No JSON array found in multimodal response');
        return [];
      }

      const products = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(products)) {
        this.logger.warn('❌ Response is not an array');
        return [];
      }

      const normalizedProducts = products
        .map((product, index) => {
          try {
            // Validar campos requeridos
            if (
              !product.producto_normalizado ||
              product.precio_final_con_descuento === undefined ||
              product.precio_sin_descuento === undefined ||
              product.precio_por_unidad === undefined ||
              product.cantidad_pack === undefined ||
              !product.unidad_medida ||
              !product.descripcion_cantidad
            ) {
              this.logger.warn(
                `⚠️ Skipping product ${index}: missing required fields`,
              );
              this.logger.debug(`Product data:`, product);
              return null;
            }

            const normalized: NormalizedProduct = {
              producto_normalizado: product.producto_normalizado
                .toString()
                .trim(),
              tipo_producto: product.tipo_producto
                ? product.tipo_producto.toString().trim()
                : null,
              precio_final_con_descuento: Number(
                product.precio_final_con_descuento,
              ),
              precio_sin_descuento: Number(product.precio_sin_descuento),
              precio_por_unidad: Number(product.precio_por_unidad),
              porcentaje_descuento: product.porcentaje_descuento
                ? Number(product.porcentaje_descuento)
                : null,
              marca: product.marca?.toString().trim() || null,
              cantidad_pack: Number(product.cantidad_pack),
              unidad_medida: product.unidad_medida.toString().trim(),
              descripcion_cantidad: product.descripcion_cantidad
                .toString()
                .trim(),
              categoria_inferida:
                product.categoria_inferida?.toString().trim() || null,
              confidence: 0.95,
              rawText: 'multimodal_analysis',
            };

            this.logger.log(
              `✅ Product ${index + 1}: ${normalized.producto_normalizado} - $${normalized.precio_final_con_descuento} (${normalized.descripcion_cantidad}) - Por unidad: $${normalized.precio_por_unidad}`,
            );
            return normalized;
          } catch (error) {
            this.logger.warn(
              `⚠️ Error parsing product ${index}: ${error.message}`,
            );
            return null;
          }
        })
        .filter((product) => product !== null) as NormalizedProduct[];

      return normalizedProducts;
    } catch (error) {
      this.logger.error(`❌ Multimodal parse error: ${error.message}`);
      this.logger.debug(`Raw content: ${content.substring(0, 500)}...`);
      return [];
    }
  }
}
