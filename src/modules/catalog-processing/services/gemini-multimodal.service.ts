// src/modules/catalog-processing/services/gemini-multimodal.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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
      //const apiKey = this.configService.get('GOOGLE_GEMINI_API_KEY');
      const apiKey = 'AIzaSyCoRaUW81J700CxdByAJI0d0y7VYGnSxPA';

      if (!apiKey) {
        this.logger.warn('GOOGLE_GEMINI_API_KEY not found');
        return;
      }

      this.genAI = new GoogleGenAI({ apiKey });
      this.isConfigured = true;
      this.logger.log(
        '✅ Gemini Multimodal service configured successfully model flash 2.1',
      );
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
        model: 'gemini-2.5-pro', // Modelo multimodal
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
        config: {
          temperature: 0,
        },
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
3. **EXTRACCIÓN ESTRICTA DE PRECIO (CRÍTICO):** El precio ("precio_final_catalogo") debe ser **EXACTAMENTE el valor monetario que se ve en la imagen**, sin realizar ningún cálculo, división, o inferencia (ej. de bulto a unidad o viceversa). Este es el precio de venta final visible.
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
7. EXTRACCIÓN O INFERENCIA DEL TIPO ESPECÍFICO:
   - Es obligatorio** determinar el subtipo para aceites, harinas, lácteos, etc.
   - Si el tipo no es visible, debes INFERIRLO por el color, diseño, o el nombre más común del producto en Argentina/Latinoamérica.
   - SOLO USA "standard" como último recurso si la inferencia es imposible.
   - Para aceites: "girasol", "mezcla", "oliva", "girasol alto oleico"
   - Para harinas: "000", "0000", "integral", "leudante" 
   - Para lácteos: "entera", "descremada", "semidescremada"
   - Para bebidas: "cola", "naranja", "lima", "pomelo", "light", "zero"
   - Para yogures: "natural", "saborizado", "griego", "bebible"
   - Para arroz: "largo", "redondo", "integral", "yamaní"
   - Para fideos: "tallarines", "moños", "tirabuzones", "coditos"
   - Si no hay tipo específico, usar "standard"

FORMATO DE RESPUESTA - SOLO JSON:
[
  {
    "producto_normalizado": "nombre completo del producto",
    "tipo_producto": "tipo específico (girasol, 000, cola, entera, etc.)",
    "precio_final_catalogo": 646.78, // SOLO EL PRECIO QUE SE VE EN LA IMAGEN (SIN CALCULAR)
    "porcentaje_descuento": 15, //% DE DESCUENTO SI SE INDICA (0 si no aplica)
    "marca": "marca si existe",
    "cantidad_pack": 12, // CANTIDAD DE UNIDADES O BULTO EN LA OFERTA DE VENTA (número)
    "unidad_medida": "250g", // UNIDAD DE MEDIDA POR CADA UNIDAD DEL PRODUCTO (250g, 1.5L, 1kg, etc)
    "descripcion_cantidad": "12 x 250g", // DESCRIPCIÓN COMPLETA DE LA CANTIDAD
    "categoria_inferida": "categoría apropiada"
  }
]

REGLAS DE CÁLCULO Y CONVERSIÓN:
**NO REALIZAR NINGÚN CÁLCULO DE PRECIO. SOLO EXTRAER EL PRECIO VISIBLE.**

1. PARA PACKS CON CANTIDAD:
   Ejemplo: "MAYONESA CADA DIA 12 x 250 GR" a $646.78
   - precio_final_catalogo: 646.78 (precio que se ve)
   - cantidad_pack_venta: 12
   - unidad_medida: "250g"
   - descripcion_cantidad: "12 x 250g"

2. PARA PRODUCTOS INDIVIDUALES:
   Ejemplo: "LECHE ENTERA 1L" a $320
   - precio_final_catalogo: 320
   - cantidad_pack_venta: 1
   - unidad_medida: "1L"
   - descripcion_cantidad: "1 unidad"

3. REGLAS DE DESCUENTO:
   - Si no se indica descuento, asumir porcentaje_descuento = 0.

4. NORMALIZACIÓN DE UNIDADES: (Se mantienen las reglas)

5. EXTRACCIÓN DE MARCAS: (Se mantienen las reglas)

6. EJEMPLOS DE TIPOS DE PRODUCTO: (Se mantienen los ejemplos)

IMPORTANTE: 
- precio_final_catalogo es SIEMPRE el precio que se ve en la imagen.
- **NO DEBES CALCULAR PRECIO POR UNIDAD O PRECIO SIN DESCUENTO.**

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
            // 🚨 MODIFICACIÓN CLAVE: Validar solo los campos extraídos del catálogo
            if (
              !product.producto_normalizado ||
              product.precio_final_catalogo === undefined || // Nuevo nombre
              product.cantidad_pack === undefined || // Nuevo nombre
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
                : null, // 🚨 MANTENER SOLO EL PRECIO EXTRAÍDO DEL CATÁLOGO
              precio_final_catalogo: Number(product.precio_final_catalogo), // ❌ ELIMINAR precio_final_con_descuento, precio_sin_descuento, precio_por_unidad
              porcentaje_descuento: product.porcentaje_descuento
                ? Number(product.porcentaje_descuento)
                : null,
              marca: product.marca?.toString().trim() || null, // 🚨 MANTENER EL PACK VENTA
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
              // 🚨 USAR EL CAMPO CORRECTO PARA LOG
              `✅ Product ${index + 1}: ${normalized.producto_normalizado} - $${normalized.precio_final_catalogo} (${normalized.descripcion_cantidad})`,
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

  // ***** RE RANKING CON GEMINI MULTIMODAL *****
  // USAR EL SERVICIO ANTERIOR PARA RE RANKEAR LOS RESULTADOS FINALES
  // BASADO EN LA IMAGEN DEL CATÁLOGO Y LOS PRODUCTOS EXTRAÍDOS
  // IMPLEMENTAR SI ES NECESARIO MÁS ADELANTE

  /**
   * 🎯 ORQUESTADOR PRINCIPAL
   * Envía cada producto extraído con sus coincidencias a Gemini para el re-ranking.
   */
  public async processAllReRanking(
    data: any, // Usamos 'any' por la estructura ProcessCatalogData
  ): Promise<any> {
    if (!this.isConfigured || !data?.preview?.length) {
      this.logger.warn(
        'Gemini Multimodal service not configured or no products to process for Re-ranking.',
      );
      return data;
    }

    try {
      // Mapear cada producto/match a una promesa de Re-ranking con el LLM
      const reRankingPromises = data.preview.map((item) =>
        this.processReRankingSingleProduct(item),
      );

      // Esperar a que todos los Re-rankings (llamadas a Gemini) terminen
      const filteredPreview = await Promise.all(reRankingPromises);

      // Devolver la estructura de datos completa y actualizada
      return {
        ...data,
        preview: filteredPreview.map((item) => ({
          // Actualizar el total de coincidencias después del re-ranking
          ...item,
          total_coincidencias: item.coincidencias.length,
        })),
      };
    } catch (error: any) {
      this.logger.error(`❌ Gemini Re-ranking batch error: ${error.message}`);
      // En caso de fallo total, devuelve los datos originales sin filtrar.
      return data;
    }
  }

  /**
   * 🎯 PROCESADOR INDIVIDUAL
   * Llama al modelo Gemini con el prompt de Re-ranking para un solo producto.
   */
  private async processReRankingSingleProduct(
    pairedProductItem: any, // Un solo ítem del array 'preview'
  ): Promise<any> {
    try {
      const prompt = this.buildReRankProductsPrompt();

      // Se envía el prompt y el JSON del producto/coincidencias
      const buildPromptContent = `
            ${prompt}
            ${JSON.stringify(pairedProductItem, null, 2)}
        `;

      const result: any = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash', // Modelo rápido para re-ranking
        contents: buildPromptContent,
        config: {
          temperature: 0,
        },
      });

      // El LLM DEBE devolver el JSON filtrado.
      const filteredJson = this.parseReRankingResponse(result.text);

      // Devolver el objeto filtrado por el LLM.
      return filteredJson;
    } catch (error: any) {
      this.logger.error(
        `❌ Gemini Re-ranking error for product: ${pairedProductItem.producto_extraido.producto_normalizado} | ${error.message}`,
      );
      // CRÍTICO: Si el LLM falla, devolvemos el ítem original
      // con coincidencias vacías para no contaminar el resultado.
      return {
        ...pairedProductItem,
        coincidencias: [],
        total_coincidencias: 0,
        error_llm: `Re-ranking failed: ${error.message}`,
      };
    }
  }

  /**
   * 📄 PROMPT FINAL DE RE-RANKING
   */
  private buildReRankProductsPrompt(): string {
    return `
Tu rol es un experto en matching y clasificación de productos de supermercado.
# Tarea: Analizar un JSON de entrada y devolver **EXCLUSIVAMENTE** el mismo JSON, pero con el array "coincidencias" dentro de cada producto LIMPIO, conteniendo solo el/los match(es) perfecto(s).

# REGLAS DE FILTRADO Y RAZONAMIENTO:

1. **Criterio de Discemimiento:** Utiliza la **Marca**, **Peso/Volumen** y **Rubro** como filtros duros. Tu principal tarea es discernir entre matches con similitud inicial alta, prestando atención a diferencias sutiles en la **Descripción** (ej. 'zero' vs. 'común', con/sin chip de chocolate). El match debe ser **exacto** a la consulta extraída.

2. **Interpretación de Scores:** El campo 'score' es el valor de similitud vectorial (QDRANT). El campo **'score_ajustado'** incluye un **BOOST de +0.1** si la marca coincide. Prioriza los matches que, cumpliendo la Regla 1, tengan el score_ajustado más alto.

3. **Ambigüedad y Match Múltiple (REGLA DE ORO):** Si la consulta extraída (\`producto_extraido.producto_normalizado\`) contiene **múltiples variantes** (ej. 'Alfajor blanco / negro', 'Batata / Membrillo') y existe un match perfecto para CADA VARIANTE en el array de coincidencias, **debes mantener TODOS** esos matches perfectos. No elimines variantes válidas.

4. **Resultado Final:** * Si el producto tiene **match(es) perfecto(s)**, mantén esos resultados en el array "coincidencias".
    * Si el producto **no tiene match perfecto**, el array "coincidencias" debe devolverse **vacío**.

**MÉTODO DE ENTREGA:** Tu respuesta final debe ser **EXCLUSIVAMENTE el JSON filtrado**.
    `;
  }

  /**
   * 📦 MÉTODO AUXILIAR DE ROBUSTEZ para el Re-ranker
   * Limpia y parsea el texto devuelto por el LLM.
   */
  private parseReRankingResponse(responseText: string): any {
    try {
      // Busca el bloque JSON envuelto en ```json ... ```
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);

      let jsonString = jsonMatch ? jsonMatch[1] : responseText;

      jsonString = jsonString.trim();

      return JSON.parse(jsonString);
    } catch (e) {
      this.logger.error(
        `Error parsing JSON from Gemini Re-ranker response: ${responseText.substring(0, 100)}...`,
      );
      throw new Error('Failed to parse Gemini Re-ranker JSON output.');
    }
  }
}
