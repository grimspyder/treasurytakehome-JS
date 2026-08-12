/** Shared presentation helpers for the VeriLabel UI. */

export function formatStatusLabel(status: string): string {
  switch (status) {
    case "matches":
      return "Match";
    case "mismatch":
      return "Mismatch";
    case "needs-review":
      return "Needs Review";
    case "unable-to-determine":
      return "Unable to Determine";
    default:
      return status;
  }
}

export function formatImageQuality(quality: string): string {
  switch (quality) {
    case "good":
      return "Good";
    case "usable":
      return "Usable";
    case "poor":
      return "Poor";
    case "insufficient":
      return "Insufficient";
    default:
      return quality;
  }
}

/** Map an image-quality value to a status-chip tone. */
export function imageQualityTone(quality: string): string {
  switch (quality) {
    case "good":
    case "usable":
      return "matches";
    case "poor":
      return "needs-review";
    case "insufficient":
      return "mismatch";
    default:
      return "needs-review";
  }
}