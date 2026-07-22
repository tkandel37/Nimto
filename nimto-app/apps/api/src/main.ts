import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const frontendUrl =
    config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

  const allowedOrigins = frontendUrl
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""));

  app.set("trust proxy", config.get<string>("TRUST_PROXY") ?? "loopback");
  app.use(json({ inflate: false, limit: "1mb" }));
  app.use(
    urlencoded({
      extended: false,
      inflate: false,
      limit: "64kb",
      parameterLimit: 100,
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    next();
  });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Nimto-Client"],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    }),
  );

  const port = config.get<number>("PORT") ?? 4000;
  const server = app.getHttpServer();
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 1_000;
  await app.listen(port);
}

bootstrap();
