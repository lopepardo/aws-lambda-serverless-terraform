import "dotenv/config";
import { z } from "zod";

const RawEnvSchema = z.object({
  APP_ENV: z.enum(["dev", "test", "production"]).default("dev"),
  TABLE_NAME: z.string().trim().min(1),
});

const AppConfigSchema = RawEnvSchema.transform((rawEnv) => {
  return {
    APP_ENV: rawEnv.APP_ENV,
    DYNAMO: {
      TABLE_NAME: rawEnv.TABLE_NAME,
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
