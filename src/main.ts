import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://ragiadashboard.vercel.app',
        'http://localhost:3000',
      ];

      // 1. Orígenes fijos
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      }
      // 🚨 2. PERMITIR CUALQUIER DOMINIO DE LOCALTUNNEL 🚨
      else if (origin.endsWith('.loca.lt')) {
        callback(null, true);
      }
      // 3. Bloquear cualquier otro origen
      else {
        callback(new Error(`CORS policy error for origin: ${origin}`), false);
      }
    },
    // Asegúrate de permitir todos los métodos para cubrir la solicitud OPTIONS preflight
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  };

  app.enableCors(corsOptions);

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Price Comparison API running on http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api`);
  logger.log(`🎯 Environment: ${process.env.NODE_ENV}`);
}
bootstrap();
