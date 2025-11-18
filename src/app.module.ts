import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogProcessingModule } from './modules/catalog-processing/catalog-processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production' ? undefined : '.env.development',
      // O, de forma más simple, permite que las variables del sistema anulen los archivos .env
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    CatalogProcessingModule,
  ],
  providers: [],
})
export class AppModule {}
