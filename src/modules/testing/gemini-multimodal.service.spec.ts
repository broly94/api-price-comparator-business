import { Test, TestingModule } from '@nestjs/testing';
import { GeminiMultimodalService } from '../catalog-processing/services/gemini-multimodal.service';

describe('GeminiMultimodalService', () => {
  let service: GeminiMultimodalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiMultimodalService],
    }).compile();

    service = module.get<GeminiMultimodalService>(GeminiMultimodalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
