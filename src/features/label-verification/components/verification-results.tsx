"use client";

import type {
  LabelVerificationSummary,
  VerificationCheckRow,
} from "@/domain/label-verification/models/types";
import { StatusChip } from "@/components/status-chip";
import { formatImageQuality } from "@/components/presentation";

interface VerificationResultsProps {
  summary: LabelVerificationSummary;
  imageUrl?: string;
}

/** Render the top-level overall verdict banner. */
function OverallBanner({ summary }: { summary: LabelVerificationSummary }) {
  let bannerClass = "";
  let title = "";
  switch (summary.overallStatus) {
    case "ready":
      bannerClass = "success-banner";
      title = "No mismatches detected";
      break;
    case "mismatches-found":
      bannerClass = "danger-banner";
      title = "Mismatches found";
      break;
    case "needs-review":
      bannerClass = "warning-banner";
      title = "Needs review";
      break;
  }
  return (
    <div
      className={bannerClass}
      role="status"
      style={{
        padding: "1rem",
        borderRadius: "var(--radius)",
        marginBottom: "1rem",
        fontWeight: 600,
      }}
    >
      {title}
    </div>
  );
}

/** Render one check row with expected / found / result. */
function CheckRow({ check }: { check: VerificationCheckRow }) {
  return (
    <div className="check-row" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
        <strong>{check.label}</strong>
        <StatusChip status={check.status} />
      </div>

      {(check.expected !== undefined || check.found !== undefined) && (
        <div className="check-values" style={{ fontSize: "0.9rem", marginTop: "0.4rem", color: "var(--text-muted)" }}>
          {check.expected !== undefined && (
            <div>
              <em>Expected:</em> {check.expected}
            </div>
          )}
          {check.found !== undefined && (
            <div>
              <em>Found on label:</em> {check.found}
            </div>
          )}
        </div>
      )}

      {check.detail && (
        <div className="check-detail" style={{ marginTop: "0.4rem", fontSize: "0.88rem" }}>
          {check.detail.map((sub) => (
            <div key={sub.label} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
              <span>{sub.label}:</span>
              <StatusChip status={sub.status} />
            </div>
          ))}
        </div>
      )}

      {check.reason && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", marginTop: "0.4rem" }}>
          {check.reason}
        </p>
      )}
    </div>
  );
}

/**
 * Full verification results: overall banner, then each check with expected /
 * found / result. The uploaded image stays visible beside/above the results so
 * the reviewer can visually compare (RSLT-001, RSLT-002, UX-009).
 */
export function VerificationResults({ summary, imageUrl }: VerificationResultsProps) {
  return (
    <div>
      <OverallBanner summary={summary} />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: imageUrl ? "1fr 1fr" : "1fr" }}>
        <div className="card">
          <h2>Check results</h2>
          {summary.imageQuality && (
            <p style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
              Image quality: <StatusChip status={summary.imageQuality} label={formatImageQuality(summary.imageQuality)} />
              {summary.uncertainties && summary.uncertainties.length > 0 && (
                <span style={{ display: "block", marginTop: "0.4rem" }}>
                  <em>Couldn't fully read:</em> {summary.uncertainties.join("; ")}
                </span>
              )}
            </p>
          )}
          {summary.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}

          {summary.durations && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", marginTop: "0.75rem", paddingTop: "0.75rem" }}>
              <strong>Timing (server):</strong>{" "}
              {summary.durations.aiInferenceDuration !== undefined && `AI ${summary.durations.aiInferenceDuration}ms · `}
              {summary.durations.validationDuration !== undefined && `verify ${summary.durations.validationDuration}ms`}
            </div>
          )}

          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "1rem" }}>
            {summary.disclaimer}
          </p>
        </div>

        {imageUrl && (
          <div className="card">
            <h2>Label under review</h2>
            <img
              src={imageUrl}
              alt="The label being verified"
              style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}