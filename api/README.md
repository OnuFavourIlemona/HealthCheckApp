# HealthCheck Risk Prediction API

FastAPI service serving the four trained risk models (`ml/diabetes`,
`ml/hypertension`, `ml/stroke`; `high_blood_sugar` shares the diabetes
model — see `ml/high_blood_sugar/report.md`) with real per-prediction SHAP
explanations. Built to satisfy: fast predictions, weekly model updates
without an app release, scale to millions of users, zero app-size impact,
and identical behavior on iOS/Android (it's just an HTTPS API).

## Why this shape

- **Fast**: models load once at startup, not per-request. XGBoost inference
  and the default (`tree_path_dependent`) SHAP explainer are both
  sub-10ms — no background dataset needed.
- **Weekly updates without an app release**: model files are plain JSON on
  disk (`models/<condition>/{full,core}_model.json`), not compiled into the
  code. Refreshing means replacing those files and redeploying this service
  — the mobile app never rebuilds. See "Weekly model refresh" below.
- **Millions of users**: stateless — any request can hit any instance — so
  it scales horizontally by adding container instances, which is what Cloud
  Run does automatically per-request.
- **Zero app size impact**: nothing here ships in the Expo app bundle. The
  app only ever makes a `fetch()` call, identical on iOS and Android.

## Run locally

```bash
cd api
python -m venv .venv && source .venv/bin/activate  # .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Try it:

```bash
curl -X POST http://localhost:8080/v1/predict/diabetes \
  -H "Content-Type: application/json" \
  -d '{
    "age": 59, "gender": "Male", "bmi": 31.6, "hypertension": true,
    "blood_glucose_mgdl": 148, "heart_disease": false,
    "smoking_history": "current", "hba1c": null
  }'
```

## Deploy to Google Cloud Run

Requires a Google Cloud project with billing enabled and the `gcloud` CLI
installed and authenticated (`gcloud auth login`).

```bash
cd api
gcloud config set project YOUR_PROJECT_ID

# Build and push the container (Cloud Build handles this in one step)
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/healthcheck-api

# Deploy — autoscales 0 to whatever you cap it at, pay only per request
gcloud run deploy healthcheck-api \
  --image gcr.io/YOUR_PROJECT_ID/healthcheck-api \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 100 \
  --cpu 1 --memory 512Mi \
  --set-env-vars PREDICTION_API_KEY=YOUR_LONG_RANDOM_SECRET
```

Notes on the flags:
- `--region europe-west1` — closest Cloud Run region to Nigeria today;
  revisit if Google adds an African region, or add a second region behind
  a load balancer once traffic justifies it.
- `--min-instances 1` avoids a cold-start on the first request after idle —
  worth the small always-on cost for a health app people expect to be fast.
- `--max-instances 100` is a safety cap, not a real ceiling — raise it as
  real traffic requires. Cloud Run itself can scale far beyond this.
- `--allow-unauthenticated` still makes the *route* public (Cloud Run's own
  IAM gate is off), but every predict endpoint now checks the `X-API-Key`
  header against `PREDICTION_API_KEY` itself (see `main.py`'s
  `require_api_key`) — a random 32+ byte value works well, e.g. generate one
  with `openssl rand -hex 32`. Set the same value as
  `EXPO_PUBLIC_PREDICTION_API_KEY` in the app's `.env`. Leaving the env var
  unset (e.g. local dev) disables the check entirely.

## Weekly model refresh

Two real options, in order of how much infrastructure they need:

1. **Redeploy** (simplest, recommended to start): retrain
   (`ml/<condition>/train.py`), copy the new `*_model.json` files into
   `api/models/<condition>/`, run the `gcloud builds submit` + `gcloud run
   deploy` commands above again. Cloud Run does a zero-downtime rollout.
   Automate this as a weekly scheduled GitHub Action / Cloud Build trigger
   once the retraining data pipeline exists.
2. **Hot-reload** (once weekly redeploys feel like too much ceremony): the
   `ConditionModel.reload()` method already exists for this — wire a
   protected `/v1/admin/reload` endpoint that re-reads `models/` from disk
   (e.g. after syncing new files from a GCS bucket) without restarting the
   container. Not built yet since redeploy is simpler and just as valid at
   this stage.

## API reference

All predict endpoints: `POST /v1/predict/{diabetes,hypertension,stroke,high_blood_sugar}`

Response shape (identical across all four):

```json
{
  "condition": "diabetes",
  "model_tier": "full",
  "probability": 0.8341,
  "score": 83,
  "risk_level": "HIGH",
  "base_probability": 0.085,
  "factors": [
    {"feature": "HbA1c_level", "raw_value": 6.8, "impact_points": 24.1, "direction": "increase"},
    {"feature": "age", "raw_value": 59, "impact_points": 9.7, "direction": "increase"}
  ]
}
```

`factors[].impact_points` are real SHAP-derived probability-point
contributions (see `inference.py`'s module docstring for the exact method)
— they sum to `score - round(base_probability * 100)`, not an approximation
dressed up as one. Sorted by `|impact_points|` descending.

`model_tier` is `"full"` when every optional field for that condition was
supplied, `"core"` otherwise — see each `ml/<condition>/report.md` for what
that gap costs in accuracy.

**Important gap, not a bug**: diabetes and high_blood_sugar both *require*
`blood_glucose_mgdl` — there is no glucose-free tier for either, because the
diabetes models were never trained or validated without it (see
`ml/diabetes/report.md`). A request missing it returns HTTP 422. The app
should keep using its local heuristic (`AssessScreen.tsx`) for diabetes/high
blood sugar when the patient hasn't provided a glucose reading, and only
call this API once they have.

**Known limitation, found by testing this API directly**: `high_blood_sugar`
shares the diabetes model (see `ml/high_blood_sugar/report.md` for why a
dedicated model failed). For someone otherwise low-risk (young, healthy BMI,
no hypertension), the score barely responds to glucose and can even move the
wrong direction at high values — verified with real requests, e.g. a healthy
30-year-old scored 10/100 at 126 mg/dL but 5/100 at 160 mg/dL. It works well
for the common case (several risk factors trending together) but not for
"otherwise perfectly healthy except one glucose reading." Not fixed here —
see the report for the root cause and what fixing it properly would need.

`GET /v1/health` — liveness check. `GET /v1/models` — lists each model's
expected fields, useful for debugging a 422.

## Already done

- **App-side integration**: `AssessScreen.tsx` calls `predictCondition()`
  (`src/lib/predictionApi.ts`), falling back to the local heuristic when the
  API is unreachable, unconfigured, or the condition has no model. Set
  `EXPO_PUBLIC_PREDICTION_API_URL` and `EXPO_PUBLIC_PREDICTION_API_KEY` in the
  app's `.env` once deployed (see `.env.example`).
- **API key auth**: every predict endpoint checks `X-API-Key` against
  `PREDICTION_API_KEY` (see `require_api_key` in `main.py`) — stops random
  internet traffic from hitting the model for free.

## Not done here (deliberately, out of scope for this pass)

- **Per-caller rate limiting**: the API key stops anonymous traffic, but
  there's no per-caller rate limit yet. Cloud Run's `--max-instances` cap is
  the current backstop against a runaway bill.
- **Actual cloud provisioning**: the `gcloud` commands above need to be run
  by someone with access to a real GCP billing account — not something
  buildable from a coding session without that access.
