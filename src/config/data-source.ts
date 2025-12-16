import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

ConfigModule.forRoot({
  // Las variables de entorno del sistema (ej. de Docker) tienen prioridad.
  // Si no existen, se buscará en el archivo .env especificado.
  envFilePath:
    process.env.NODE_ENV === 'development' ? '.development.env' : '.env',
});

const configService = new ConfigService();

export const DataSourceConfig: DataSourceOptions = {
  type: 'mssql',
  host: configService.get<string>('ACCESS_DATA_HOST'),
  port: configService.get<number>('ACCESS_DATA__PORT'),
  username: configService.get<string>('ACCESS_DATA_USER'),
  password: configService.get<string>('ACCESS_DATA_PASS'),
  database: configService.get<string>('ACCESS_DATA_NAME'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
  migrationsRun: true,
  namingStrategy: new SnakeNamingStrategy(),
};

export default new DataSource(DataSourceConfig);
