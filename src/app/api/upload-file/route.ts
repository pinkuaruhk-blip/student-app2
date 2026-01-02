import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileData, fileType } = await request.json();

    if (!fileName || !fileData) {
      return NextResponse.json(
        { error: "Missing fileName or fileData" },
        { status: 400 }
      );
    }

    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString("hex");
    const fileExtension = fileName.split(".").pop();
    const uniqueFileName = `${timestamp}-${randomHash}.${fileExtension}`;

    // Extract base64 data (remove data:image/png;base64, prefix if present)
    const base64Data = fileData.includes("base64,")
      ? fileData.split("base64,")[1]
      : fileData;

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Save to public/uploads directory
    const uploadsDir = join(process.cwd(), "public", "uploads");
    const filePath = join(uploadsDir, uniqueFileName);

    await writeFile(filePath, buffer);

    // Generate public URL
    const publicUrl = `/uploads/${uniqueFileName}`;

    console.log("✅ File uploaded successfully:", publicUrl);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: fileName,
      uniqueFileName: uniqueFileName,
    });
  } catch (error: any) {
    console.error("❌ Error uploading file:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
