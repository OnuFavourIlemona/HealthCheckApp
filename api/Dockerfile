FROM python:3.12-slim

WORKDIR /app

# System deps for xgboost/shap wheels with native extensions.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Upgrade pip first: the base image's pip is too old to recognise the newer
# manylinux wheel tags xgboost 3.x publishes, which otherwise fails with
# "No matching distribution found" even though the wheel exists.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY main.py inference.py ./
COPY models/ ./models/

ENV MODEL_DIR=/app/models
ENV PORT=8080
EXPOSE 8080

# Single worker per container is intentional: Cloud Run scales by adding
# container instances, not by adding workers inside one — see README.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
