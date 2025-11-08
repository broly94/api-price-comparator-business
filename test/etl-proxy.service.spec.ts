import { Test, TestingModule } from '@nestjs/testing';
import { EtlProxyService } from '../src/modules/catalog-processing/services/etl-proxy.service';

describe('EtlProxyService', () => {
  let service: EtlProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EtlProxyService],
    }).compile();

    service = module.get<EtlProxyService>(EtlProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
