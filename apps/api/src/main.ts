import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);

  // CSV import sends the file (up to CSV_IMPORT_MAX_LENGTH characters) as JSON;
  // Express's default 100 KB limit would reject most of that range.
  app.useBodyParser("json", { limit: "2mb" });
  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
  });

  await app.listen(config.port);
}

void bootstrap();
