export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const configPath = path.join(process.cwd(), "config.json");
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);
      const providers = Object.keys(config.providers || {});
      console.log(`[startup] config.json loaded successfully. Providers: ${providers.join(", ")}`);
    } catch (error) {
      console.error(`[startup] Failed to read config.json at ${configPath}:`, error);
      process.exit(1);
    }
  }
}
