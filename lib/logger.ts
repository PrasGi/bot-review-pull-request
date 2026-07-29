type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const log = {
  debug: (event: string, fields?: LogFields): void => emit("debug", event, fields),
  info: (event: string, fields?: LogFields): void => emit("info", event, fields),
  warn: (event: string, fields?: LogFields): void => emit("warn", event, fields),
  error: (event: string, fields?: LogFields): void => emit("error", event, fields),
};

export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorMessage: String(error) };
}
