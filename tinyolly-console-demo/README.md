# TinyOlly Console Demo

This folder contains a lightweight demo that outputs telemetry directly to the console using the OpenTelemetry Collector. No UI is required.

## Usage

**1. Start the collector:**
```bash
./01-start.sh
```

**2. Generate traffic:**
```bash
./02-traffic.sh
```

**3. View Telemetry:**
- **Logs:** `./02-show-logs.sh`
- **Traces:** `./03-show-traces.sh`
- **Metrics:** `./04-show-metrics.sh`

**4. Cleanup:**
```bash
./05-cleanup.sh
```
