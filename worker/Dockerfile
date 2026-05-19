FROM python:3.12-slim AS base
WORKDIR /app
RUN addgroup --system worker && adduser --system --group worker

FROM base AS builder
COPY pyproject.toml .
# Install declared dependencies directly (no package build step needed — the
# source is COPY-ed into the runtime stage, so we only need the libs).
RUN pip install uv && uv pip install --system \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.30" \
      "httpx>=0.27" \
      "asyncpg>=0.29" \
      "pydantic>=2.7" \
      "pydantic-settings>=2.3" \
      "structlog>=24" \
      "cryptography>=42" \
      "playwright>=1.44" \
      "openai>=1.30" \
      "reportlab>=4.2"

FROM base AS runtime
COPY --from=builder /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=builder /usr/local/bin /usr/local/bin
COPY worker/ ./worker/
USER worker
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "worker.main:app", "--host", "0.0.0.0", "--port", "8000"]
