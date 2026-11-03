import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { AppConfigService } from "./config/app-config.service";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ApplicationsModule } from "./applications/applications.module";
import { AiModule } from "./ai/ai.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({ connection: { url: config.redisUrl } }),
    }),
    AuthModule,
    ApplicationsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
