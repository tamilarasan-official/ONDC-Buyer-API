import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const DEFAULT_MIN_REDIS_VERSION = "6.2.0";

function parseSemver(version: string): [number, number, number] {
  const [major = "0", minor = "0", patch = "0"] =
    String(version).split(".");
  return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0];
}

function isVersionLowerThan(current: string, minimum: string): boolean {
  const currentParts = parseSemver(current);
  const minimumParts = parseSemver(minimum);

  for (let i = 0; i < 3; i += 1) {
    if (currentParts[i] < minimumParts[i]) return true;
    if (currentParts[i] > minimumParts[i]) return false;
  }

  return false;
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>("REDIS_HOST") || "localhost";
        const port = configService.get<number>("REDIS_PORT") || 6379;
        const minRedisVersion =
          configService.get<string>("REDIS_MIN_VERSION") ||
          DEFAULT_MIN_REDIS_VERSION;

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

        const info = await client.info("server");
        const versionLine = info
          .split("\n")
          .find((line) => line.startsWith("redis_version:"));
        const redisVersion =
          versionLine?.replace("redis_version:", "").trim() || "0.0.0";

        if (isVersionLowerThan(redisVersion, minRedisVersion)) {
          await client.quit();
          throw new Error(
            `Redis version ${redisVersion} is not supported. Minimum required version is ${minRedisVersion}.`,
          );
        }

        console.log(`[Redis] Connecting to ${host}:${port} (BullMQ queue uses this)`);
        console.log(`[Redis] Version check passed: ${redisVersion} (minimum ${minRedisVersion})`);
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
