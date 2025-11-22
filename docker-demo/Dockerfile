FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV PYTHONUNBUFFERED=1
ENV OTEL_PYTHON_LOGGING_AUTO_INSTRUMENTATION_ENABLED=true
ENV OTEL_SERVICE_NAME=demo-frontend
ENV OTEL_TRACES_EXPORTER=otlp
ENV OTEL_METRICS_EXPORTER=otlp
ENV OTEL_LOGS_EXPORTER=otlp
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
ENV OTEL_EXPORTER_OTLP_PROTOCOL=grpc

EXPOSE 5000

CMD ["sh", "-c", "echo 'Starting app...' && opentelemetry-instrument python -u app.py"]

