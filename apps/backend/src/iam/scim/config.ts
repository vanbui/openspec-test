export type ScimConfig = { ipLimit: number; sourceLimit: number };

export function readScimConfig(env: Record<string, string | undefined> = process.env): ScimConfig {
  const positive = (key: string, fallback: number): number => {
    const raw = env[key];
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer within the safe integer range.`);
    }
    return value;
  };
  return { ipLimit: positive("IDAMBOX_SCIM_IP_LIMIT", 1200), sourceLimit: positive("IDAMBOX_SCIM_SOURCE_LIMIT", 600) };
}
