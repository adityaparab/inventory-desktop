import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

const API_ROUTE_PREFIXES = ['/api', '/auth', '/builds', '/download', '/generate', '/health', '/setup', '/machines'];

function isApiRoute(requestPath: string): boolean {
  return API_ROUTE_PREFIXES.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  );
}

function serveClientApp(app: NestExpressApplication): void {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  const indexPath = path.join(clientDistPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.warn(
      `Client app was not served because ${indexPath} does not exist. Run the client build first.`,
    );
    return;
  }

  const server = app.getHttpAdapter().getInstance();
  server.use(express.static(clientDistPath));
  server.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isApiRoute(req.path)) {
      next();
      return;
    }
    res.sendFile(indexPath);
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the first hop's X-Forwarded-Proto / X-Forwarded-For headers so that
  // req.protocol returns 'https' (not 'http') when running behind Railway's
  // reverse proxy.  Without this the ApiBaseUrl embedded in the setup EXE is
  // http://… and Railway's HTTP→HTTPS redirect causes POST→GET conversion.
  app.set('trust proxy', 1);

  // ---------------------------------------------------------------------------
  // Global validation — strips unknown fields and coerces types automatically.
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strip properties not declared in DTOs
      forbidNonWhitelisted: false,
      transform: true,       // auto-transform payloads to DTO class instances
    }),
  );

  // ---------------------------------------------------------------------------
  // Swagger / OpenAPI documentation
  // Available at: GET /api/docs
  // JSON spec at: GET /api/docs-json
  // ---------------------------------------------------------------------------
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Inventory Build Server API')
    .setDescription(
      'REST + SSE API for generating and downloading machine-specific NSIS installers.\n\n' +
        '**Authentication flow:**\n' +
        '1. `POST /auth/register` — create an account (returns `accessToken`).\n' +
        '2. `POST /auth/login`    — authenticate (returns `accessToken`).\n' +
        '3. Click **Authorize** (lock icon) and enter `Bearer <accessToken>` to access protected endpoints.\n\n' +
        '**Build flow:**\n' +
        '1. `GET /generate/:uuid` — triggers the build; consumes the SSE stream until `type: "complete"`.\n' +
        '2. `GET /download/:uuid` — downloads the generated `.exe` installer.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token obtained from POST /auth/login or POST /auth/register. ' +
          'Prefix with "Bearer " (e.g. "Bearer eyJhbGci...").',
        in: 'header',
      },
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  serveClientApp(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Build server listening on port ${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap();
