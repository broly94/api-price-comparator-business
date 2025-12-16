import { Module } from '@nestjs/common';
import { DataAccessService } from '@/data-access/services/data-access.service';
import { DataAccessController } from '@/data-access/controllers/data-access.controller';

@Module({
  imports: [],
  providers: [DataAccessService],
  controllers: [DataAccessController],
})
export class DataAccessModule {}
