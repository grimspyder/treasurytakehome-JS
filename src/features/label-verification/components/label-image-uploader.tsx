"use client";

import { useCallback, useRef, useState } from "react";

interface LabelImageUploaderProps {
  onImageSelected: (imageDataUrl: string, mimeType: string, fileName: string) => void;
  onClear: () => void;
  label?: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_SIZE = 15 * 1024 * 1024;

/**
 * Drag-and-drop + click-to-browse image uploader for a single label. Large
 * obvious drop zone, plain-English instructions, and a clear preview + remove.
 * The file is read to a data URL in the browser; only its contents (already
 * validated as an image) are sent to the server.
 */
export function LabelImageUploader({
  onImageSelected,
  onClear,
  label = "Upload a photo of the label",
}: LabelImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      setError(null);
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(
          "This file type isn't supported. Please upload a JPG, PNG, or WebP image."
        );
        return;
      }
      if (file.size > MAX_SIZE) {
        setError("This image is too large (over 15 MB). Please upload a smaller photo.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : null;
        if (dataUrl) {
          setPreviewUrl(dataUrl);
          setFileName(file.name);
          onImageSelected(dataUrl, file.type, file.name);
        }
      };
      reader.onerror = () =>
        setError("Sorry, we couldn't read that file. Please try another photo.");
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  const clearImage = useCallback(() => {
    setPreviewUrl(null);
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  }, [onClear]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        id="label-image-input"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!previewUrl ? (
        <label
          htmlFor="label-image-input"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`upload-zone ${isDragging ? "upload-zone--dragging" : ""} ${
            error ? "upload-zone--error" : ""
          }`}
          style={{
            display: "block",
            border: "2px dashed var(--border)",
            borderRadius: "var(--radius)",
            padding: "2.5rem 1rem",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "var(--bg-muted)" : "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }} aria-hidden="true">
            🏷️
          </div>
          <strong>{label}</strong>
          <p style={{ margin: "0.25rem 0", color: "var(--text-muted)" }}>
            Drag and drop a photo here, or click to choose one
          </p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            JPG, PNG, or WebP · up to 15 MB
          </p>
          {error && (
            <p role="alert" style={{ color: "var(--danger-text)", marginTop: "0.75rem" }}>
              {error}
            </p>
          )}
        </label>
      ) : (
        <div className="upload-preview">
          <img
            src={previewUrl}
            alt="Label preview"
            style={{
              maxWidth: "100%",
              maxHeight: "320px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
            }}
          />
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.5rem 0" }}>
            {fileName}
          </p>
          <button type="button" className="btn btn-secondary" onClick={clearImage}>
            Remove image
          </button>
        </div>
      )}
    </div>
  );
}