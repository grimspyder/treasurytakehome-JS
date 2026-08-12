"use client";

import { useState } from "react";
import type { AlcoholLabelApplicationData } from "@/domain/label-verification/models/types";

interface ApplicationInformationFormProps {
  initialValue?: AlcoholLabelApplicationData;
  onValueChange: (value: AlcoholLabelApplicationData) => void;
  compact?: boolean;
}

const BEVERAGE_CATEGORY_LABELS: Record<string, string> = {
  "distilled-spirits": "Distilled spirits (e.g. whiskey, vodka, gin)",
  wine: "Wine",
  "malt-beverage": "Malt beverage / beer",
  unknown: "",
};

/**
 * Form collecting the expected application information for a label review.
 * All fields are optional; a reviewer enters what they have and the app checks
 * the label against it. Uses clear labels and help text so a nontechnical
 * reviewer understands each field.
 */
export function ApplicationInformationForm({
  initialValue = {},
  onValueChange,
  compact = false,
}: ApplicationInformationFormProps) {
  const [form, setForm] = useState<AlcoholLabelApplicationData>(initialValue);

  const updateField = (field: keyof AlcoholLabelApplicationData, value: string) => {
    // Keep the raw value (including trailing spaces) so the user can type
    // normally — trimming on every keystroke would strip spaces mid-typing.
    // Only treat an all-whitespace string as empty (undefined).
    const next = { ...form, [field]: value.trim() === "" ? undefined : value };
    setForm(next);
    onValueChange(next);
  };

  return (
    <div className={compact ? undefined : "card"}>
      {!compact && <h2>Application information</h2>}
      {!compact && (
        <p className="hint">
          Enter what the label <strong>should say</strong> from the application.
          Leave a field blank if you are not checking it.
        </p>
      )}

      <div className="field">
        <label htmlFor="app-brand">Brand name</label>
        <input
          id="app-brand"
          type="text"
          value={form.brandName ?? ""}
          onChange={(e) => updateField("brandName", e.target.value)}
          placeholder="e.g. Old Tom Distillery"
        />
      </div>

      <div className="field">
        <label htmlFor="app-type">Class / type designation</label>
        <input
          id="app-type"
          type="text"
          value={form.classOrTypeDesignation ?? ""}
          onChange={(e) => updateField("classOrTypeDesignation", e.target.value)}
          placeholder="e.g. Kentucky Straight Bourbon Whiskey"
        />
      </div>

      <div className="field">
        <label htmlFor="app-abv">Alcohol content (ABV)</label>
        <input
          id="app-abv"
          type="text"
          value={form.alcoholByVolume ?? ""}
          onChange={(e) => updateField("alcoholByVolume", e.target.value)}
          placeholder="e.g. 45% ABV"
        />
      </div>

      <div className="field">
        <label htmlFor="app-proof">Proof (optional)</label>
        <input
          id="app-proof"
          type="text"
          value={form.proof ?? ""}
          onChange={(e) => updateField("proof", e.target.value)}
          placeholder="e.g. 90 Proof"
        />
      </div>

      <div className="field">
        <label htmlFor="app-net">Net contents</label>
        <input
          id="app-net"
          type="text"
          value={form.netContents ?? ""}
          onChange={(e) => updateField("netContents", e.target.value)}
          placeholder="e.g. 750 mL"
        />
      </div>

      <div className="field">
        <label htmlFor="app-bottler">Bottler / producer</label>
        <input
          id="app-bottler"
          type="text"
          value={form.producerOrBottlerName ?? ""}
          onChange={(e) => updateField("producerOrBottlerName", e.target.value)}
          placeholder="e.g. Old Tom Distillery"
        />
      </div>

      <div className="field">
        <label htmlFor="app-address">Bottler / producer address</label>
        <input
          id="app-address"
          type="text"
          value={form.producerOrBottlerAddress ?? ""}
          onChange={(e) => updateField("producerOrBottlerAddress", e.target.value)}
          placeholder="e.g. 123 Main St, Louisville, KY"
        />
      </div>

      <div className="field">
        <label htmlFor="app-country">Country of origin (optional)</label>
        <input
          id="app-country"
          type="text"
          value={form.countryOfOrigin ?? ""}
          onChange={(e) => updateField("countryOfOrigin", e.target.value)}
          placeholder="e.g. France (for imports)"
        />
      </div>

      <div className="field">
        <label htmlFor="app-category">Beverage type</label>
        <select
          id="app-category"
          value={form.beverageCategory ?? "unknown"}
          onChange={(e) =>
            updateField(
              "beverageCategory",
              e.target.value === "unknown" ? "" : e.target.value
            )
          }
        >
          <option value="unknown">Select a type</option>
          {Object.entries(BEVERAGE_CATEGORY_LABELS)
            .filter(([value]) => value !== "unknown")
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
