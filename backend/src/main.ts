import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isSwaggerEnabled, setupSwagger } from './common/swagger/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendOrigin = config.get<string>(
    'FRONTEND_ORIGIN',
    'http://localhost:4200',
  );

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

  const port = Number(config.get<string>('PORT', '3002'));
  await app.listen(port);
}

void bootstrap();
