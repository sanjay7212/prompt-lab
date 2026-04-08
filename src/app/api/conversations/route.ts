import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Conversation } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "conversations");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureDir();
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const conversations: Conversation[] = files.map((f) => {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8"));
    });
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureDir();
    const conversation: Conversation = await request.json();
    const filePath = path.join(DATA_DIR, `${conversation.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));
    return NextResponse.json(conversation);
  } catch {
    return NextResponse.json({ error: "Failed to save conversation" }, { status: 500 });
  }
}
