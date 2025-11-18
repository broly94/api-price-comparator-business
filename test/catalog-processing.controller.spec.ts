import { Test, TestingModule } from '@nestjs/testing';
import { CatalogProcessingController } from '../src/modules/catalog-processing/catalog-processing.controller';

describe('CatalogProcessingController', () => {
  let controller: CatalogProcessingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogProcessingController],
    }).compile();

    controller = module.get<CatalogProcessingController>(
      CatalogProcessingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
