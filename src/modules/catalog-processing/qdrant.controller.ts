import { Controller, Get } from '@nestjs/common';
import { QdrantService } from './services/qdrant.service';

@Controller('qdrant')
export class QdrantController {
  constructor(private readonly qdrantService: QdrantService) {}

  @Get('status')
  async getStatus() {
    try {
      const status = this.qdrantService.getStatus();
      return status;
    } catch (error) {
      console.log(error);
    }
  }

  @Get('collection')
  async getCollection() {
    try {
      const collection = await this.qdrantService.getCollection();
      return collection;
    } catch (error) {
      console.log(error);
    }
  }
}
