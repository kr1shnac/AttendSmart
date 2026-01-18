# Face Engine Dockerfile
# Multi-stage build for smaller image size

FROM python:3.11-slim as builder

# Install build dependencies for dlib/face_recognition
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# Production Stage
# ============================================
FROM python:3.11-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    liblapack3 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser
WORKDIR /app
RUN chown appuser:appuser /app

# Copy application
COPY --chown=appuser:appuser app.py .

# Switch to non-root user
USER appuser

# Environment variables
ENV PORT=5050
ENV PYTHONUNBUFFERED=1
ENV FLASK_DEBUG=false

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5050/health')" || exit 1

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5050", "--workers", "2", "--timeout", "60", "app:app"]
