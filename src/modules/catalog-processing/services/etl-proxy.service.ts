import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
const FormData = require('form-data');

@Injectable()
export class EtlProxyService {
  private readonly logger = new Logger(EtlProxyService.name);
  private readonly ETL_BASE_URL: string;

  constructor(private configService: ConfigService) {
    // 🎯 Obtener la URL del servicio FastAPI desde la configuración/env
    this.ETL_BASE_URL =
      this.configService.get<string>('ETL_SERVICE_URL') ||
      'http://localhost:8001';
  }

  async sendExcelToEtlService(
    file: Express.Multer.File,
  ): Promise<{ processed: number; total: number }> {
    // El endpoint es /api/v1/etl/upload (según la configuración de FastAPI)
    const url = `${this.ETL_BASE_URL}/api/v1/etl/upload`;
    this.logger.log(`Forwarding file to ETL Service at: ${url}`);

    const formData = new FormData();

    // 🎯 CRÍTICO: La clave 'excel_file' debe coincidir con el nombre del argumento en FastAPI
    // (excel_file: UploadFile = File(...))
    formData.append('excel_file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    try {
      const response = await axios.post(url, formData, {
        // headers de FormData son esenciales para el boundary de multipart
        headers: {
          ...formData.getHeaders(),
          Accept: 'application/json',
        },
      });

      // Estructura de respuesta esperada de FastAPI:
      // { success: true, message: ..., data: { processed: N, total: M } }
      const etlData = response.data.data;

      return {
        processed: etlData.processed,
        total: etlData.total,
      };
    } catch (error) {
      this.logger.error(
        'Error forwarding Excel to ETL Service:',
        error.message,
      );

      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const detail =
          error.response.data?.detail ||
          error.response.data?.message ||
          'Unknown error from ETL Service';

        // 🎯 Propagar el estado y el mensaje de error del servicio ETL
        throw new HttpException(
          `ETL Service Error [${status}]: ${detail}`,
          status,
        );
      }

      throw new HttpException(
        `ETL Proxy failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
