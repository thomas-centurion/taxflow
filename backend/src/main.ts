import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loggerLevels, trustProxySetting } from './common/runtime-options';
import { isSwaggerEnabled, setupSwagger } from './common/swagger/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: loggerLevels(process.env.NODE_ENV) });
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>(
    'FRONTEND_ORIGIN',
    'http://localhost:4200',
  );

  app.set('trust proxy', trustProxySetting(config.get<string>('TRUST_PROXY')));
  app.use(helmet());
  app.enableCors({ origin: frontendOrigin, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  if (isSwaggerEnabled({ SWAGGER_ENABLED: config.get<string>('SWAGGER_ENABLED'), NODE_ENV: config.get<string>('NODE_ENV') })) setupSwagger(app);
  app.enableShutdownHooks();

  const port = Number(config.get<string>('PORT', '3002'));
  await app.listen(port);
}

void bootstrap();
