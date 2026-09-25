import "dotenv/config";
import { z } from "zod";

const RawEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DB_HOST: z.string().default("localhost"), //postgres
  DB_PORT: z.coerce.number().int().default(5432),
  DB_USER: z.string().default("miniorder"),
  DB_PASSWORD: z.string().default("miniorder_password"),
  DB_NAME: z.string().default("miniorder"),
  DB_SSL: z.stringbool().default(false),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(2000),
  DB_POOL_MAX_LIFETIME_SECONDS: z.coerce.number().int().positive().default(300),
});
// .superRefine((rawEnv, ctx) => {
//   if (rawEnv.DATABASE_PROVIDER === "postgres" && !rawEnv.DATABASE_URL) {
//     ctx.addIssue({
//       code: "custom",
//       path: ["DATABASE_URL"],
//       message: "DATABASE_URL is required when DATABASE_PROVIDER=postgres",
//     });
//   }
// });

const AppConfigSchema = RawEnvSchema.transform((rawEnv) => {
  return {
    environment: rawEnv.NODE_ENV,
    server: {
      port: rawEnv.PORT,
    },
    logger: {
      level: rawEnv.LOG_LEVEL,
    },
    database: {
      host: rawEnv.DB_HOST,
      port: rawEnv.DB_PORT,
      user: rawEnv.DB_USER,
      password: rawEnv.DB_PASSWORD,
      name: rawEnv.DB_NAME,
      ssl: rawEnv.DB_SSL,
      poolMax: rawEnv.DB_POOL_MAX,
      poolMin: rawEnv.DB_POOL_MIN,
      idleTimeoutMillis: rawEnv.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: rawEnv.DB_POOL_CONNECTION_TIMEOUT_MS,
      maxLifetimeSeconds: rawEnv.DB_POOL_MAX_LIFETIME_SECONDS,
    },
  };
});

export type AppConfig = z.output<typeof AppConfigSchema>;

export const loadEnv = (): AppConfig => {
  const parsedEnv = AppConfigSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    console.error(
      "Invalid environment variables:",
      z.flattenError(parsedEnv.error).fieldErrors,
    );
    process.exit(1);
  }

  return parsedEnv.data;
};

export const env = loadEnv();
