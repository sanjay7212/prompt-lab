import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { InstructionsProgress } from "@/lib/types";

const PROGRESS_FILE = path.join(process.cwd(), "data", "instructions-progress.json");

function ensureFile() {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PROGRESS_FILE)) fs.writeFileSync(PROGRESS_FILE, "{}");
}

export async function GET() {
  try {
    ensureFile();
    const data: InstructionsProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureFile();
    const progress: InstructionsProgress = await request.json();
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    return NextResponse.json(progress);
  } catch {
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
