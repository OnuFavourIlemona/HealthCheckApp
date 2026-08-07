"""
Shared inference engine for all HealthCheck risk models.

Design choices, and why:

- Models load once at process startup as module-level singletons, not per
  request — this is most of what makes predictions fast (XGBoost inference
  itself is sub-millisecond; loading a model from disk is not).

- SHAP explanations use the default `shap.TreeExplainer` (tree_path_dependent
  feature perturbation) — no background dataset needed, so it stays fast.
  Raw SHAP values from this come out in margin (log-odds) space, which isn't
  directly meaningful to show a patient ("+2.3 log-odds" means nothing to
  anyone). `explain()` below converts them into per-feature probability-point
  contributions via a waterfall decomposition: apply each feature's SHAP
  value in descending order of magnitude, converting the running margin total
  to a probability via sigmoid at each step, and taking the delta. This is
  cheap (reuses SHAP values already computed, no extra model calls) and the
  contributions sum exactly to (final_probability - base_probability), so
  they are honest numbers, not an approximation dressed up as one.

- Weekly model updates: MODEL_DIR is a plain directory of versioned JSON
  files, not baked into a Python module. Refreshing the model is "replace the
  files and restart the process" — no code change, no app release. See
  README.md for the actual weekly refresh pattern.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import shap
import xgboost as xgb

MODEL_DIR = Path(os.environ.get("MODEL_DIR", Path(__file__).parent / "models"))


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


@dataclass
class Factor:
    feature: str
    raw_value: float
    impact_points: float
    direction: str  # "increase" | "protective"


@dataclass
class Prediction:
    model_tier: str
    probability: float
    base_probability: float
    score: int
    factors: list[Factor]


class ConditionModel:
    """
    Loads the full+core XGBoost boosters and SHAP explainers for one
    condition, and picks the right tier per request based on which optional
    fields were actually supplied.
    """

    def __init__(self, name: str, full_features: list[str], core_features: list[str]):
        self.name = name
        self.full_features = full_features
        self.core_features = core_features
        self._models: dict[str, xgb.XGBClassifier] = {}
        self._explainers: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        condition_dir = MODEL_DIR / self.name
        for tier in ("full", "core"):
            model = xgb.XGBClassifier()
            model.load_model(str(condition_dir / f"{tier}_model.json"))
            self._models[tier] = model
            # tree_path_dependent (the default) needs no background dataset —
            # keeps this fast enough to run inline on every request.
            self._explainers[tier] = shap.TreeExplainer(model)

    def reload(self) -> None:
        """Re-reads model files from disk without restarting the process — used by the weekly refresh hook (see README)."""
        self._load()

    def pick_tier(self, available_fields: set[str]) -> str:
        full_only = set(self.full_features) - set(self.core_features)
        return "full" if full_only.issubset(available_fields) else "core"

    def predict(self, encoded: dict[str, float], tier: str) -> Prediction:
        features = self.full_features if tier == "full" else self.core_features
        model = self._models[tier]
        explainer = self._explainers[tier]

        x = np.array([[encoded[f] for f in features]], dtype=float)
        probability = float(model.predict_proba(x)[0, 1])

        shap_row = explainer.shap_values(x)[0]
        base_value = explainer.expected_value
        if isinstance(base_value, (list, np.ndarray)):
            base_value = float(np.asarray(base_value).reshape(-1)[-1])
        base_probability = float(sigmoid(base_value))

        order = np.argsort(-np.abs(shap_row))
        cumulative = base_value
        factors: list[Factor] = []
        for idx in order:
            prev_prob = sigmoid(cumulative)
            cumulative += shap_row[idx]
            new_prob = sigmoid(cumulative)
            delta_points = float((new_prob - prev_prob) * 100)
            factors.append(
                Factor(
                    feature=features[idx],
                    raw_value=float(x[0, idx]),
                    impact_points=round(delta_points, 2),
                    direction="increase" if delta_points > 0 else "protective",
                )
            )

        return Prediction(
            model_tier=tier,
            probability=probability,
            base_probability=base_probability,
            score=round(probability * 100),
            factors=factors,
        )


def risk_level(score: int, low_max: int, moderate_max: int) -> str:
    if score < low_max:
        return "LOW"
    if score < moderate_max:
        return "MODERATE"
    return "HIGH"
