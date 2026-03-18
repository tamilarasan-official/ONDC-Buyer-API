import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>("REDIS_HOST") || "localhost";
        const port = configService.get<number>("REDIS_PORT") || 6379;
        const client = new Redis({
          host,
          port,
          password: configService.get<string>("REDIS_PASSWORD") || undefined,
          maxRetriesPerRequest: null, // Required by BullMQ for blocking commands (e.g. BRPOP)
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });
        console.log(`[Redis] Connecting to ${host}:${port} (BullMQ queue uses this)`);
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
