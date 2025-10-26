import { Test, TestingModule } from '@nestjs/testing';
import { ImagePreprocessorService } from '../catalog-processing/services/image-preprocessor.service';

describe('ImagePreprocessorService', () => {
  let service: ImagePreprocessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImagePreprocessorService],
    }).compile();

    service = module.get<ImagePreprocessorService>(ImagePreprocessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
