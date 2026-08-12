"use client";

import { useState } from "react";
import type { AlcoholLabelApplicationData, LabelVerificationSummary } from "@/domain/label-verification/models/types";
import { ApplicationInformationForm } from "@/features/label-verification/components/application-information-form";
import { LabelImageUploader } from "@/features/label-verification/components/label-image-uploader";
import { VerificationProgress } from "@/features/label-verification/components/verification-progress";
import { VerificationResults } from "@/features/label-verification/components/verification-results";
import { BatchVerificationPanel } from "@/features/batch-verification/components/batch-verification-panel";

interface SelectedImage {
  dataUrl: string;
  mimeType: string;
  fileName: string;
}

/**
 * The single-label verification workflow.
 *
 * Flow: enter application info → upload label photo → Verify → review the
 * clearly-presented results. Large primary action, visible upload area, and
 * plain-English instructions throughout so a first-time reviewer needs no
 * documentation (UX-002, UX-004).
 */
export default function LabelVerificationHome() {
  const [applicationData, setApplicationData] = useState<AlcoholLabelApplicationData>({});
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<LabelVerificationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canVerify = selectedImage !== null && !isVerifying;

  async function handleVerify() {
    if (!selectedImage) return;
    setIsVerifying(true);
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: selectedImage.dataUrl,
          mimeType: selectedImage.mimeType,
          applicationData,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "We couldn't analyze this label. Please try again.");
      }
      setResult(payload.summary as LabelVerificationSummary);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't analyze this label. Please try again."
      );
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="container">
      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>VeriLabel</h1>
        <p style={{ color: "var(--text-muted)", maxWidth: "640px", margin: "0 auto" }}>
          Check that a beverage label matches the information on your application — fast.
          Upload a photo and review the results yourself.
        </p>
      </header>

      <main>
        {!result && !isVerifying && (
          <div className="card">
            <h2>Review a single label</h2>
            <p className="hint">
              Step 1 — Enter the expected application information. Step 2 — Upload a
              photo of the label. Step 3 — Click <strong>Verify Label</strong>.
            </p>
            <ApplicationInformationForm
              initialValue={applicationData}
              onValueChange={setApplicationData}
            />
            <div style={{ marginTop: "1rem" }}>
              <LabelImageUploader
                onImageSelected={(dataUrl, mimeType, fileName) =>
                  setSelectedImage({ dataUrl, mimeType, fileName })
                }
                onClear={() => setSelectedImage(null)}
              />
            </div>

            {error && (
              <p role="alert" style={{ color: "var(--danger-text)", marginTop: "1rem" }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: "1.25rem" }}>
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={!canVerify}
                onClick={handleVerify}
              >
                {isVerifying ? "Analyzing…" : "Verify Label"}
              </button>
            </div>
            {!selectedImage && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem", textAlign: "center" }}>
                Please upload a label photo first.
              </p>
            )}
          </div>
        )}

        {isVerifying && !result && <VerificationProgress />}

        {result && (
          <>
            <VerificationResults summary={result} imageUrl={selectedImage?.dataUrl} />
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResult(null)}
              >
                Review another label
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: "2rem" }}>
          <BatchVerificationPanel />
        </div>
      </main>
    </div>
  );
}