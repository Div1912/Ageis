# AEGIS Backend

FastAPI backend serving live on-chain data to the AEGIS frontend.

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/position` | Live vault position from on-chain state |
| GET | `/api/rebalance-history` | Parsed rebalance events from Indexer |
| GET | `/api/decision-log` | Decision log (on-chain + local agent) |
| POST | `/api/trigger-rebalance` | Queue manual rebalance |
| GET | `/api/health` | Health check + last round |
| GET | `/api/queue` | Pending rebalance queue |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ID` | `743291048` | Algorand App ID |
| `ALGOD_URL` | `https://testnet-api.algonode.cloud` | Algod endpoint |
| `INDEXER_URL` | `https://testnet-idx.algonode.cloud` | Indexer endpoint |

## Interactive Docs

Once running, visit `http://localhost:8000/docs` for Swagger UI.
