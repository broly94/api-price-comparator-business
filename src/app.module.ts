import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogProcessingModule } from './modules/catalog-processing/catalog-processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.development',
    }),
    CatalogProcessingModule,
  ],
  providers: [],
})
export class AppModule {}
