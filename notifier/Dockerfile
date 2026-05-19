FROM python:3.12-slim

WORKDIR /app

# Install system deps for asyncpg (C extension)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer-cached)
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# Copy application code
COPY . .

# Run as non-root
RUN adduser --system --no-create-home notifier
USER notifier

CMD ["python", "main.py"]
