export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable "${name}" is not set. Copy .env.example to .env and fill in all values.`
    );
  }
  return value;
}
