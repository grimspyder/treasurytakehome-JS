import { VerificationStatus } from "@/domain/label-verification/models/types";
import { formatStatusLabel } from "@/components/presentation";

interface StatusChipProps {
  status: VerificationStatus | string;
  /** Optionally override the label (used for image quality etc.). */
  label?: string;
}

/**
 * Accessible status pill. The result is communicated by both color AND text
 * (never color alone) to satisfy the non-color-only status requirement.
 */
export function StatusChip({ status, label }: StatusChipProps) {
  const toneClass = `status-chip--${status}`;
  return (
    <span className={`status-chip ${toneClass}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{label ?? formatStatusLabel(status)}</span>
    </span>
  );
}