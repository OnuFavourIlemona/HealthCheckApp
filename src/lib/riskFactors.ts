export type FactorCategory = 'increase' | 'protective';

/**
 * Shared shape for a single risk-factor explanation, whether it came from
 * the real prediction API (real SHAP-derived contribution) or the local
 * heuristic fallback (AssessScreen's placeholder scoring). Stored verbatim
 * in risk_assessments.details.factors so RiskPredictionScreen can render
 * either source identically without knowing which one produced it.
 */
export type StoredFactor = {
  key: string;
  name: string;
  detail: string;
  category: FactorCategory;
  /** Percentage/risk points, same 0-100 scale as the overall score. */
  impact: number;
  /** A MaterialCommunityIcons glyph name. */
  icon: string;
  tip: string | null;
};
