FROM python:3.14.6-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements-audit.txt requirements-model.txt requirements-service.txt ./
RUN python -m pip install --no-cache-dir --only-binary=:all: -r requirements-service.txt

COPY . .

# Fail the image build unless the checked-in artifact and frozen fixture load and agree.
RUN python scripts/verify_model.py

EXPOSE 10000

# Render supplies PORT; verify once more before accepting traffic on every container start.
CMD ["sh", "-c", "python scripts/verify_model.py && exec python scripts/serve.py --host 0.0.0.0 --port \"${PORT:-10000}\""]
