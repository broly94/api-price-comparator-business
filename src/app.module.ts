import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogProcessingModule } from './catalog-processing/catalog-processing.module';
import { DataAccessModule } from './data-access/data-access.module';
import { DataSourceConfig } from './config/data-source';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production' ? undefined : '.env.development',
      // O, de forma máss simple, permite que las variables del sistema anulen los archivos .env
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRoot({
      ...DataSourceConfig,
      retryAttempts: 10,
      retryDelay: 3000,
    }),
    CatalogProcessingModule,
    DataAccessModule,
  ],
  providers: [],
})
export class AppModule {}
