import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

  app.enableCors({
    origin: frontendUrl.split(",").map((origin) => origin.trim().replace(/\/$/, "")),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = config.get<number>("PORT") ?? 4000;
  await app.listen(port);
}

bootstrap();
