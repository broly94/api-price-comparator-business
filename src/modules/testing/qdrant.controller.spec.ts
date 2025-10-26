import { Test, TestingModule } from '@nestjs/testing';
import { QdrantController } from '../catalog-processing/qdrant.controller';

describe('QdrantController', () => {
  let controller: QdrantController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QdrantController],
    }).compile();

    controller = module.get<QdrantController>(QdrantController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
