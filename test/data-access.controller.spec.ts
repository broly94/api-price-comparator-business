import { Test, TestingModule } from '@nestjs/testing';
import { DataAccessController } from '../src/data-access/controllers/data-access.controller';

describe('DataAccessController', () => {
  let controller: DataAccessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataAccessController],
    }).compile();

    controller = module.get<DataAccessController>(DataAccessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
