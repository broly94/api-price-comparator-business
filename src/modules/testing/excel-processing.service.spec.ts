import { Test, TestingModule } from '@nestjs/testing';
import { ExcelProcessingService } from '../catalog-processing/services/excel-processing.service';

describe('ExcelProcessingService', () => {
  let service: ExcelProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExcelProcessingService],
    }).compile();

    service = module.get<ExcelProcessingService>(ExcelProcessingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
