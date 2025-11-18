import { Test, TestingModule } from '@nestjs/testing';
import { ProductNormalizationService } from '../src/modules/catalog-processing/services/product-normalization.service';

describe('ProductNormalizationService', () => {
  let service: ProductNormalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductNormalizationService],
    }).compile();

    service = module.get<ProductNormalizationService>(
      ProductNormalizationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
