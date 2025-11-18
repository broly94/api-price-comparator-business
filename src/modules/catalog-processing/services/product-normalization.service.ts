// src/modules/catalog-processing/services/product-normalization.service.ts

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProductNormalizationService {
  private readonly logger = new Logger(ProductNormalizationService.name);

  /**
   * Normaliza unidades de medida para consistencia
   */
  normalizeUnit(unit: string): string {
    if (!unit) return unit;

    return unit
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace('litro', 'l')
      .replace('litros', 'l')
      .replace('lt', 'l')
      .replace('gramo', 'g')
      .replace('gramos', 'g')
      .replace('kilo', 'kg')
      .replace('kilos', 'kg')
      .replace('gr', 'g')
      .replace('ml', 'ml')
      .replace('cl', 'cl')
      .replace(/^(\d+)l$/, '$1l')
      .replace(/^(\d+)kg$/, '$1kg')
      .replace(/^(\d+)g$/, '$1g')
      .trim();
  }

  /**
   * Convierte unidades a un formato estandarizado para comparación
   */
  standardizeUnitForComparison(unit: string): string {
    const normalized = this.normalizeUnit(unit);

    // Convertir todo a gramos o mililitros para comparación
    const volumeMatch = normalized.match(/(\d+\.?\d*)\s*(ml|cl|l)/i);
    const weightMatch = normalized.match(/(\d+\.?\d*)\s*(g|kg)/i);

    if (volumeMatch) {
      const value = parseFloat(volumeMatch[1]);
      const unitType = volumeMatch[2].toLowerCase();

      switch (unitType) {
        case 'l':
          return `${value * 1000}ml`;
        case 'cl':
          return `${value * 10}ml`;
        case 'ml':
          return `${value}ml`;
      }
    }

    if (weightMatch) {
      const value = parseFloat(weightMatch[1]);
      const unitType = weightMatch[2].toLowerCase();

      switch (unitType) {
        case 'kg':
          return `${value * 1000}g`;
        case 'g':
          return `${value}g`;
      }
    }

    return normalized;
  }
}
