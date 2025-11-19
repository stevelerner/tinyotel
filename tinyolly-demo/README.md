# TinyOlly Full Stack Demo

This folder contains the complete demo environment including:
- **Demo Frontend**: A Flask app that generates telemetry.
- **Demo Backend**: A downstream service to demonstrate distributed tracing.
- **TinyOlly Core**: The observability backend (UI + Collector + Redis).

## Usage

**1. Start the demo:**
```bash
./01-start.sh
```

**2. Generate traffic:**
```bash
./02-traffic.sh
```

**3. View the UI:**
Open `http://localhost:5002`

**4. Stop the demo:**
```bash
./03-stop.sh
```
