import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySingleLabel } from "../../../features/label-verification/server/verify-single-label";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Minimal schema for the request body. */
const VerifyRequestSchema = z.object({
  image: z.string().min(1, "Image is required."),
  mimeType: z.string().min(1, "MIME type is required."),
  applicationData: z
    .object({
      brandName: z.string().optional(),
      classOrTypeDesignation: z.string().optional(),
      alcoholByVolume: z.string().optional(),
      proof: z.string().optional(),
      netContents: z.string().optional(),
      producerOrBottlerName: z.string().optional(),
      producerOrBottlerAddress: z.string().optional(),
      countryOfOrigin: z.string().optional(),
      beverageCategory: z
        .enum(["distilled-spirits", "wine", "malt-beverage", "unknown"])
        .optional(),
    })
    .optional()
    .default({}),
});

/** Decode a base64 data URL into a Buffer. */
function imageBufferFromDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:[^;,]+;base64,(.+)$/);
  if (!match) {
    throw new Error("The uploaded image is not a valid data URL.");
  }
  return Buffer.from(match[1], "base64");
}

/**
 * POST /api/verify
 *
 * Single-label verification. The browser sends the image as a data URL plus the
 * expected application data; we return the human-readable verification summary.
 */
export async function POST(request: NextRequest) {
  let requestId: string;
  try {
    requestId = crypto.randomUUID().slice(0, 8);
  } catch {
    requestId = "unknown";
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The request could not be read. Please try again." },
      { status: 400 }
    );
  }

  const parsed = VerifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid request.",
        code: "invalid-request",
      },
      { status: 400 }
    );
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = imageBufferFromDataUrl(parsed.data.image);
  } catch {
    return NextResponse.json(
      {
        error: "The uploaded image could not be read as a data URL.",
        code: "invalid-image",
      },
      { status: 400 }
    );
  }

  try {
    const verificationOutput = await verifySingleLabel(
      imageBuffer,
      parsed.data.mimeType,
      parsed.data.applicationData
    );
    return NextResponse.json({
      ok: true,
      ...verificationOutput,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred.";
    console.error(
      JSON.stringify({ event: "verify_failed", requestId, message })
    );
    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "verification-failed",
      },
      { status: 500 }
    );
  }
}