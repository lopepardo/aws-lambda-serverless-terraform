import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const RawEnvSchema = z.object({
  APP_ENV: z.enum(["dev", "test", "production"]).default("dev"),
  EVENT_BUS_NAME: z.string().trim().min(1),
});

const AppConfigSchema = RawEnvSchema.transform((rawEnv) => {
  return {
    APP_ENV: rawEnv.APP_ENV,
    EVENTBRIDGE: {
      EVENT_BUS_NAME: rawEnv.EVENT_BUS_NAME,
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
