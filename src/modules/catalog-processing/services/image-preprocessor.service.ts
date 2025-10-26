import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImagePreprocessorService {
  async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Aplicar mejoras para OCR
      const processedImage = await sharp(imageBuffer)
        .grayscale() // Mejorar contraste para texto
        .normalise() // Normalizar brillo
        .sharpen() // Enfocar texto
        .png() // Convertir a PNG consistente
        .toBuffer();

      return processedImage;
    } catch (error) {
      throw new Error(`Error preprocessing image: ${error.message}`);
    }
  }

  async extractImageRegions(imageBuffer: Buffer): Promise<Buffer[]> {
    // En una versión avanzada, aquí detectaríamos regiones individuales de productos
    // Por ahora retornamos la imagen completa
    return [await this.preprocessImage(imageBuffer)];
  }
}
