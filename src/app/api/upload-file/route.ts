import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { loadPublicFormContext } from "@/lib/public-form";

// Same limit the public form shows to the recipient.
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Public: used by the form page (/form/[cardId]/[formId]) for signed-out
// recipients, so it only accepts uploads for an open client form on a real card.
export async function POST(request: NextRequest) {
  try {
    const { cardId, formId, fileName, fileData, fileType } = await request.json();

    if (!fileName || !fileData || typeof fileData !== "string") {
      return NextResponse.json(
        { error: "Missing fileName or fileData" },
        { status: 400 }
      );
    }

    const ctx = await loadPublicFormContext(cardId, formId);
    if (!ctx) {
      return NextResponse.json({ error: "Form or card not found" }, { status: 404 });
    }
    if (ctx.existingSubmission) {
      return NextResponse.json(
        { error: "This form has already been submitted" },
        { status: 409 }
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
    if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is empty or larger than 2MB" }, { status: 413 });
    }

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
