import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Request, Response, NextFunction } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();

    console.log(
      `[SERVER] → ${req.method} ${req.originalUrl}`,
    );

    res.on('finish', () => {
      console.log(
        `[SERVER] ← ${req.method} ${req.originalUrl} ${res.statusCode} (${Date.now() - startedAt}ms)`,
      );
    });

    next();
  });

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

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port);
}

void bootstrap();
