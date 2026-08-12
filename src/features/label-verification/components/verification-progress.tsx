"use client";

interface VerificationProgressProps {
  label?: string;
}

/**
 * A simple, accessible verifiying-progress indicator shown while the label is
 * being analyzed. Uses an animated spinner + text (never frozen UI), with a
 * screen-reader status.
 */
export function VerificationProgress({
  label = "Analyzing your label…",
}: VerificationProgressProps) {
  return (
    <div role="status" aria-live="polite" className="progress" style={{ textAlign: "center", padding: "2rem" }}>
      <span
        aria-hidden="true"
        className="spinner"
        style={{
          display: "inline-block",
          width: "2rem",
          height: "2rem",
          border: "3px solid var(--border)",
          borderTopColor: "var(--primary)",
          borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <p style={{ marginTop: "0.75rem", fontWeight: 600 }}>{label}</p>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        This usually takes about 5 seconds.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}