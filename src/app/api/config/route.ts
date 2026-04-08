import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { AppConfig } from "@/lib/types";

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    return process.env[varName] || value;
  });
}

export async function GET() {
  try {
    const configPath = path.join(process.cwd(), "config.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config: AppConfig = JSON.parse(raw);

    // Resolve env vars in API keys, return config without exposing full keys
    const safeConfig: Record<string, { models: string[] }> = {};
    for (const [provider, providerConfig] of Object.entries(config.providers)) {
      const resolvedKey = resolveEnvVars(providerConfig.apiKey);
      safeConfig[provider] = {
        models: providerConfig.models,
      };
    }

    return NextResponse.json(safeConfig);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}
