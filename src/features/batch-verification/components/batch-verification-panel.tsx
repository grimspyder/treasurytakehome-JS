"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { AlcoholLabelApplicationData, LabelVerificationSummary } from "@/domain/label-verification/models/types";
import { runWithConcurrency } from "../utils/concurrency";
import { StatusChip } from "@/components/status-chip";
import { formatStatusLabel } from "@/components/presentation";

/** Phase a batch item is in (the assignment's queue vocabulary). */
type BatchItemPhase = "pending" | "processing" | "completed" | "needs-review" | "failed";

interface BatchItem {
  id: string;
  fileName: string;
  imageDataUrl: string;
  mimeType: string;
  applicationData: AlcoholLabelApplicationData;
  phase: BatchItemPhase;
  result?: LabelVerificationSummary;
  error?: string;
}

const DEFAULT_CONCURRENCY = 3;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side batch verifier.
 *
 * Upload many label photos (plus an optional CSV manifest mapping each image to
 * its expected application data). A concurrency-limited queue verifies each via
 * `/api/verify`; results stream in as they finish, failures are retryable, and
 * results can be exported to CSV. One failed label never aborts the batch.
 */
export function BatchVerificationPanel() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [batchError, setBatchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const acc = { pending: 0, processing: 0, completed: 0, needsReview: 0, failed: 0 };
    for (const item of items) {
      if (item.phase === "processing") acc.processing++;
      else if (item.phase === "completed") acc.completed++;
      else if (item.phase === "needs-review") acc.needsReview++;
      else if (item.phase === "failed") acc.failed++;
      else acc.pending++;
    }
    return acc;
  }, [items]);

  const totalDone = counts.completed + counts.needsReview + counts.failed;
  const progressPercent = items.length === 0 ? 0 : Math.round((totalDone / items.length) * 100);

  /** Parse a CSV manifest into per-filename application data. */
  const handleManifestFile = useCallback(async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      setBatchError("The manifest CSV needs a header row and at least one data row.");
      return;
    }
    const header = lines[0]
      .split(",")
      .map((cell) => cell.trim().toLowerCase().replace(/^"|"$/g, ""));
    const filenameIdx = header.indexOf("file") >= 0 ? header.indexOf("file") : header.indexOf("filename");
    if (filenameIdx < 0) {
      setBatchError("The manifest CSV needs a 'file' column with the image filename.");
      return;
    }
    const fieldMap: Record<string, keyof AlcoholLabelApplicationData> = {
      brand: "brandName",
      "brand name": "brandName",
      brandname: "brandName",
      type: "classOrTypeDesignation",
      "class/type": "classOrTypeDesignation",
      "class type": "classOrTypeDesignation",
      abv: "alcoholByVolume",
      "alcohol by volume": "alcoholByVolume",
      "alcohol content": "alcoholByVolume",
      proof: "proof",
      "net contents": "netContents",
      netcontents: "netContents",
      "net content": "netContents",
      bottler: "producerOrBottlerName",
      producer: "producerOrBottlerName",
      address: "producerOrBottlerAddress",
      "bottler address": "producerOrBottlerAddress",
      country: "countryOfOrigin",
      "country of origin": "countryOfOrigin",
    };
    const manifest = new Map<string, AlcoholLabelApplicationData>();
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
      const filename = cells[filenameIdx];
      if (!filename) continue;
      const data: AlcoholLabelApplicationData = {};
      header.forEach((col, idx) => {
        const field = fieldMap[col];
        if (field && cells[idx]) {
          (data as Record<string, string | undefined>)[field] = cells[idx];
        }
      });
      manifest.set(filename.toLowerCase(), data);
    }
    return manifest;
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      setBatchError(null);
      const newItems: BatchItem[] = [];
      let manifest: Map<string, AlcoholLabelApplicationData> | undefined;
      for (const file of Array.from(files)) {
        if (
          file.name.toLowerCase().endsWith(".csv") ||
          file.type === "text/csv" ||
          file.name.toLowerCase().endsWith(".manifest")
        ) {
          if (manifest) continue;
          manifest = await handleManifestFile(file);
          continue;
        }
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) continue;
        if (file.size > MAX_IMAGE_BYTES) {
          setBatchError(`Skipped ${file.name}: image larger than 15 MB.`);
          continue;
        }
        const imageDataUrl = await readFileAsDataUrl(file);
        const applicationData = manifest?.get(file.name.toLowerCase()) ?? {};
        newItems.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          imageDataUrl,
          mimeType: file.type,
          applicationData,
          phase: "pending",
        });
      }
      // Fold duplicate filenames: only keep one image if the same name repeats
      // (a manifest with that name is applied once).
      const seen = new Set<string>();
      const deduped = newItems.filter((item) => {
        const key = item.fileName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setItems((prev) => (isRunning ? prev : [...prev, ...deduped]));
    },
    [handleManifestFile, isRunning]
  );

  const updateItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const runSingle = useCallback(
    async (item: BatchItem) => {
      updateItem(item.id, { phase: "processing" });
      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: item.imageDataUrl,
            mimeType: item.mimeType,
            applicationData: item.applicationData,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Verification failed.");
        }
        const summary = payload.summary as LabelVerificationSummary;
        updateItem(item.id, {
          phase:
            summary.overallStatus === "needs-review"
              ? "needs-review"
              : summary.overallStatus === "ready"
              ? "completed"
              : "completed",
          result: summary,
        });
      } catch (err) {
        updateItem(item.id, {
          phase: "failed",
          error: err instanceof Error ? err.message : "Verification failed.",
        });
      }
    },
    [updateItem]
  );

  const startBatch = useCallback(async () => {
    const pendingIds = items.filter((item) => item.phase === "pending" || item.phase === "failed").map((item) => item.id);
    if (pendingIds.length === 0) return;
    setIsRunning(true);
    setBatchError(null);
    // Reset failed/pending to pending.
    setItems((prev) =>
      prev.map((item) =>
        pendingIds.includes(item.id) ? { ...item, phase: "pending" as const, error: undefined } : item
      )
    );
    const toRun = items.filter((item) => pendingIds.includes(item.id));
    await runWithConcurrency(toRun, {
      concurrency,
      worker: (item) => runSingle(item),
    });
    setIsRunning(false);
  }, [items, concurrency, runSingle]);

  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((item) => item.id !== id)),
    []
  );

  const exportCsv = useCallback(() => {
    const rows = [
      ["file", "status", "brand", "alcohol", "net contents", "remark"],
    ];
    for (const item of items) {
      if (item.phase !== "completed" && item.phase !== "needs-review") continue;
      const status = item.result?.overallStatus ?? item.phase;
      const checks = item.result?.checks ?? [];
      const brand = checks.find((c) => c.label === "Brand Name")?.status ?? "";
      const abv = checks.find((c) => c.label === "Alcohol Content")?.status ?? "";
      const net = checks.find((c) => c.label === "Net Contents")?.status ?? "";
      rows.push([
        item.fileName,
        status,
        brand,
        abv,
        net,
        item.result?.checks.find((c) => c.status === "mismatch" || c.status === "needs-review")?.label ?? "",
      ]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verilabel-batch-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  return (
    <div className="card">
      <h2>Verify a batch of labels</h2>
      <p className="hint">
        Upload many label photos. Optionally add a CSV manifest mapping each image
        to its expected application data (columns: file, brand, abv, net contents, ...).
        Labels without a manifest entry are checked for required-present fields only.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(",") + ",.csv,.manifest"}
        className="sr-only"
        id="batch-files"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
        Choose labels (and optional CSV)
      </button>

      <div className="field" style={{ marginTop: "1rem", maxWidth: "220px" }}>
        <label htmlFor="batch-concurrency">Concurrent label checks</label>
        <input
          id="batch-concurrency"
          type="number"
          min={1}
          max={10}
          value={concurrency}
          onChange={(e) => setConcurrency(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      {batchError && <p role="alert" style={{ color: "var(--danger-text)" }}>{batchError}</p>}

      {items.length > 0 && (
        <>
          <div className="progress-bar-wrap" style={{ marginTop: "1rem" }}>
            <div className="progress-bar" style={{ width: `${progressPercent}%` }} role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
              {progressPercent}%
            </div>
          </div>
          <p className="summary">
            {counts.completed + counts.needsReview + counts.failed} of {items.length} done ·{" "}
            {counts.processing} processing · {counts.needsReview} need review · {counts.failed} failed
          </p>
        </>
      )}

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={startBatch} disabled={isRunning}>
          {isRunning ? "Verifying batch…" : "Verify batch"}
        </button>
        {items.some((i) => i.phase === "completed" || i.phase === "needs-review") && (
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            Export results (CSV)
          </button>
        )}
      </div>

      {items.length > 0 && (
        <table className="batch-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.fileName}</td>
                <td>
                  <StatusChip status={item.phase} label={formatStatusLabel(item.phase)} />
                  {item.error && <p style={{ color: "var(--danger-text)", fontSize: "0.8rem", margin: 0 }}>{item.error}</p>}
                </td>
                <td>
                  {item.phase === "failed" && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => runSingle(item)}>
                      Retry
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(item.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}