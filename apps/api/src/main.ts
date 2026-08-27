import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.use(cookieParser());
  app.enableCors({
    origin: config.webOrigin,
    credentials: true,
  });

  await app.listen(config.port);
}

void bootstrap();
