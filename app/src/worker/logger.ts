type LogMessage = Record<string, unknown>;

export type Logger = {
  info(message: LogMessage): void;
  error(message: LogMessage, error: unknown): void;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { name: "UnknownError", message: String(error) };
}

export const makeLogger = (): Logger => {
  return {
    info: (message) => {
      console.log(JSON.stringify({ level: "INFO", ...message }));
    },
    error: (message, error) => {
      console.error(
        JSON.stringify({
          level: "ERROR",
          ...message,
          error: serializeError(error),
        }),
      );
    },
  };
};
