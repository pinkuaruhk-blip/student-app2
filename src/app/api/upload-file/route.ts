import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
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

    // Validate BLOB_READ_WRITE_TOKEN exists
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("❌ BLOB_READ_WRITE_TOKEN not configured");
      return NextResponse.json(
        { error: "Blob storage not configured" },
        { status: 500 }
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

    console.log(`📤 Uploading ${fileName} (${(buffer.length / 1024).toFixed(2)} KB) to Vercel Blob...`);

    // Upload to Vercel Blob Storage
    const blob = await put(uniqueFileName, buffer, {
      access: "public",
      contentType: fileType || "application/octet-stream",
      addRandomSuffix: false, // We already generated a unique filename
    });

    console.log("✅ File uploaded successfully to Vercel Blob:", blob.url);

    // Return response matching existing metadata structure
    // CRITICAL: This maintains backward compatibility with existing code
    return NextResponse.json({
      success: true,
      url: blob.url, // Now returns full Vercel Blob URL (e.g., https://xxx.public.blob.vercel-storage.com/...)
      fileName: fileName,
      uniqueFileName: uniqueFileName,
    });
  } catch (error: any) {
    console.error("❌ Error uploading file to Vercel Blob:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
