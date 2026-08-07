# Deploying the prediction API to Render

The service is a plain Docker container, so Render runs the exact same
`api/` folder and `Dockerfile` with no code changes. This is the fallback
to Google Cloud Run (see `README.md`) — pick whichever you can get billing
working on. Nothing here locks you in; the same image moves to Cloud Run
later if you outgrow Render.

## One-time prerequisite: push the code to GitHub

Render deploys from a connected Git repo. The `HealthCheckApp` repo has no
remote yet, so:

1. Create an empty repo on GitHub (e.g. `healthcheck-app`). Private is fine.
2. From `HealthCheckApp/`:

   ```bash
   git add .
   git commit -m "Add prediction API and Render blueprint"
   git remote add origin https://github.com/YOUR_USERNAME/healthcheck-app.git
   git branch -M main
   git push -u origin main
   ```

   Your `.env` (with the real secret) is gitignored, so it will NOT be pushed.
   Good — the secret goes into Render's dashboard instead (step below).

## Deploy on Render

There are two ways. The Blueprint way is one click and uses `render.yaml`
already at the repo root.

### Option A — Blueprint (recommended)

1. Go to <https://dashboard.render.com> and sign up (GitHub login is easiest).
2. **New +** → **Blueprint**.
3. Connect the GitHub repo you just pushed. Render finds `render.yaml`
   automatically and shows a `healthcheck-api` web service.
4. It will prompt for the one secret marked `sync: false`:
   - **PREDICTION_API_KEY** → paste the value from the app's `.env`
     (`EXPO_PUBLIC_PREDICTION_API_KEY`). They MUST match exactly.
5. **Apply**. First build takes ~3-5 min (it installs xgboost/shap).

### Option B — Manual web service (if you skip the blueprint)

1. **New +** → **Web Service** → connect the repo.
2. Set **Root Directory** to `api`, **Runtime** to `Docker` (auto-detected),
   **Region** to Frankfurt, **Health Check Path** to `/v1/health`.
3. Under **Environment**, add `PREDICTION_API_KEY` = the same secret as above.
4. **Create Web Service**.

## After it deploys

1. Copy the service URL Render gives you, e.g.
   `https://healthcheck-api.onrender.com`.
2. Put it in the app's `.env`:

   ```
   EXPO_PUBLIC_PREDICTION_API_URL=https://healthcheck-api.onrender.com
   ```

3. Restart the Expo dev server so it picks up the new env var.
4. Verify it's live:

   ```bash
   curl https://healthcheck-api.onrender.com/v1/health
   # -> {"status":"ok"}

   curl -X POST https://healthcheck-api.onrender.com/v1/predict/diabetes \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_SECRET" \
     -d '{"age":59,"gender":"Male","bmi":31.6,"hypertension":true,"blood_glucose_mgdl":148,"smoking_history":"current"}'
   ```

   A `401` means the `X-API-Key` header does not match `PREDICTION_API_KEY`.

## Notes

- **The `starter` plan does not sleep**, so no cold starts. The free plan
  does spin down after ~15 min idle (first request then takes ~30s) — fine
  for testing, upgrade to `starter` before real users.
- **Weekly model refresh**: replace the `*_model.json` files under
  `api/models/`, commit, and push. Render auto-redeploys (`autoDeploy: true`).
- **Scaling**: raise the instance count / plan in the Render dashboard as
  traffic grows. Same container, so migrating to Cloud Run later needs no
  code change.
