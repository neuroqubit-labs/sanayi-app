import { z, type ZodType } from "zod";

export type EnvSchema<T> = ZodType<T, z.ZodTypeDef, Record<string, string | undefined>>;

function getDefaultRuntimeEnv(): Record<string, string | undefined> {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
}

export function createExpoPublicEnv<T>(
  schema: EnvSchema<T>,
  runtimeEnv: Record<string, string | undefined> = getDefaultRuntimeEnv(),
): T {
  const parsed = schema.safeParse(runtimeEnv);

  if (parsed.success) {
    return parsed.data;
  }

  const formatted = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid Expo public environment configuration: ${formatted}`);
}

export { z };
