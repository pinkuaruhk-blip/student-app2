import { NextResponse } from "next/server";
import { devOnly } from "@/lib/staff-auth";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const readmePath = join(process.cwd(), "README.md");
    const content = readFileSync(readmePath, "utf-8");

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": "attachment; filename=README.md",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
