"""
AEGIS FastAPI Backend — serves live vault state to the frontend.

Endpoints:
  GET  /api/position           — live vault position from on-chain state
  GET  /api/rebalance-history  — parsed rebalance events from Indexer
  GET  /api/decision-log       — decision log from on-chain + local agent
  POST /api/trigger-rebalance  — manual rebalance signal

Usage:
  cd backend
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""
import os
import sys
import json
import time
import asyncio
import subprocess
import signal
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from algosdk.v2client import algod, indexer
import base64

# ── Agent Process Management ────────────────────────────
agent_process: Optional[subprocess.Popen] = None
agent_start_time: Optional[float] = None

# ── Config ──────────────────────────────────────────────
ALGOD_URL   = os.getenv("ALGOD_URL", "https://testnet-api.algonode.cloud")
INDEXER_URL = os.getenv("INDEXER_URL", "https://testnet-idx.algonode.cloud")
APP_ID      = int(os.getenv("APP_ID", os.getenv("VITE_APP_ID", "743291048")))

algod_client   = algod.AlgodClient("", ALGOD_URL, headers={"User-Agent": "aegis-api/2.0"})
indexer_client = indexer.IndexerClient("", INDEXER_URL, headers={"User-Agent": "aegis-api/2.0"})

# ── Supabase ────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase_client = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"[API] Supabase connected")
except Exception as e:
    print(f"[API] Supabase init failed: {e}")

# ── App ─────────────────────────────────────────────────
app = FastAPI(
    title="AEGIS API",
    description="Autonomous LP Manager — Algorand Testnet",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Local decision log (supplemented by on-chain data) ──
decision_log: list[dict] = []
rebalance_queue: list[dict] = []

# ── Models ──────────────────────────────────────────────
class PositionResponse(BaseModel):
    entry_price: float
    lower_bound: float
    upper_bound: float
    capital_usdc: float
    open_timestamp: int
    total_rebalances: int
    last_rebalance_timestamp: int
    deposited_algo: float
    deposited_usdc: float
    total_deposits: int
    total_withdrawals: int
    agent_authorized: bool
    total_decisions: int
    last_decision_timestamp: int
    last_decision_action: int
    app_id: int

class RebalanceEvent(BaseModel):
    tx_id: str
    timestamp: int
    round_time: int
    fee: float
    new_lower: Optional[float] = None
    new_upper: Optional[float] = None

class DecisionEntry(BaseModel):
    timestamp: int
    action: str  # HOLD, REBALANCE, ALERT, SKIP
    price: Optional[float] = None
    reason: str
    result: str
    tx_id: Optional[str] = None

class RebalanceTrigger(BaseModel):
    new_lower: float
    new_upper: float
    reason: str = "Manual override"


# ── Helper: Read global state ───────────────────────────
def read_global_state(app_id: int) -> dict:
    """Read all global state fields from the smart contract."""
    try:
        app_info = algod_client.application_info(app_id)
        global_state = app_info.get("params", {}).get("global-state", [])

        state = {}
        for kv in global_state:
            key = base64.b64decode(kv["key"]).decode("utf-8", errors="ignore")
            value = kv["value"]
            if value["type"] == 1:
                state[key] = base64.b64decode(value.get("bytes", ""))
            else:
                state[key] = value.get("uint", 0)

        return state
    except Exception as e:
        print(f"[API] Error reading global state: {e}")
        return {}


# ── Endpoints ───────────────────────────────────────────

@app.get("/api/position", response_model=PositionResponse)
async def get_position():
    """Read live vault position from on-chain global state."""
    state = read_global_state(APP_ID)

    if not state:
        # No on-chain state available — return zeros so frontend
        # falls back to direct contract reads via contractService.js
        return PositionResponse(
            entry_price=0,
            lower_bound=0,
            upper_bound=0,
            capital_usdc=0,
            open_timestamp=0,
            total_rebalances=0,
            last_rebalance_timestamp=0,
            deposited_algo=0,
            deposited_usdc=0,
            total_deposits=0,
            total_withdrawals=0,
            agent_authorized=False,
            total_decisions=0,
            last_decision_timestamp=0,
            last_decision_action=0,
            app_id=APP_ID,
        )

    return PositionResponse(
        entry_price=state.get("entry_price", 0) / 1000,
        lower_bound=state.get("lower_bound", 0) / 1000,
        upper_bound=state.get("upper_bound", 0) / 1000,
        capital_usdc=state.get("capital_usdc", 0) / 100,
        open_timestamp=state.get("open_timestamp", 0),
        total_rebalances=state.get("total_rebalances", 0),
        last_rebalance_timestamp=state.get("last_rebalance_timestamp", 0),
        deposited_algo=state.get("deposited_algo", 0) / 1e6,
        deposited_usdc=state.get("deposited_usdc", 0) / 1e6,
        total_deposits=state.get("total_deposits", 0),
        total_withdrawals=state.get("total_withdrawals", 0),
        agent_authorized=state.get("agent_authorized", 0) == 1,
        total_decisions=state.get("total_decisions", 0),
        last_decision_timestamp=state.get("last_decision_timestamp", 0),
        last_decision_action=state.get("last_decision_action", 0),
        app_id=APP_ID,
    )


@app.get("/api/rebalance-history", response_model=list[RebalanceEvent])
async def get_rebalance_history():
    """Fetch rebalance transaction history from Algorand Indexer."""
    try:
        result = indexer_client.search_transactions(
            application_id=APP_ID,
            limit=50,
        )
        transactions = result.get("transactions", [])

        # ABI method selector for trigger_rebalance(uint64,uint64)void
        TRIGGER_SELECTOR = "DhG20w=="  # first 4 bytes of SHA-512/256 of method sig

        events = []
        for tx in transactions:
            if tx.get("tx-type") != "appl":
                continue
            app_args = tx.get("application-transaction", {}).get("application-args", [])
            if not app_args:
                continue

            # Filter: only trigger_rebalance method calls
            # Check if first arg contains 'rebalance' in decoded form, or just accept all app calls for now
            events.append(RebalanceEvent(
                tx_id=tx.get("id", ""),
                timestamp=tx.get("round-time", 0),
                round_time=tx.get("round-time", 0),
                fee=(tx.get("fee", 0)) / 1e6,
            ))

        events.sort(key=lambda e: e.timestamp, reverse=True)
        return events

    except Exception as e:
        print(f"[API] Error fetching rebalance history: {e}")
        return []


@app.get("/api/decision-log", response_model=list[DecisionEntry])
async def get_decision_log():
    """Return combined on-chain + local agent decision log."""
    combined: list[dict] = []

    # Read from agent JSON log
    agent_decisions = _read_agent_decisions()
    for d in agent_decisions:
        combined.append({
            "timestamp": d.get("timestamp", 0),
            "action": d.get("action", "UNKNOWN"),
            "price": d.get("price"),
            "reason": d.get("reason", ""),
            "result": "Executed" if d.get("tx_id") else "Evaluated",
            "tx_id": d.get("tx_id"),
        })

    # Read from Supabase if available
    if supabase_client:
        try:
            result = supabase_client.table("decisions").select("*").order("timestamp", desc=True).limit(50).execute()
            for d in (result.data or []):
                # Avoid duplicates by timestamp
                if not any(c["timestamp"] == d.get("timestamp") for c in combined):
                    combined.append({
                        "timestamp": d.get("timestamp", 0),
                        "action": d.get("action", "UNKNOWN"),
                        "price": d.get("price"),
                        "reason": d.get("reason", ""),
                        "result": "Executed" if d.get("tx_id") else "Evaluated",
                        "tx_id": d.get("tx_id"),
                    })
        except Exception as e:
            print(f"[API] Supabase decision read failed: {e}")

    # Add on-chain decision info
    state = read_global_state(APP_ID)
    if state:
        total = state.get("total_decisions", 0)
        last_ts = state.get("last_decision_timestamp", 0)
        last_action = state.get("last_decision_action", 0)

        action_map = {0: "HOLD", 1: "REBALANCE", 2: "ALERT", 3: "SKIP"}
        if last_ts > 0 and not any(c["timestamp"] == last_ts for c in combined):
            combined.append({
                "timestamp": last_ts,
                "action": action_map.get(last_action, "UNKNOWN"),
                "price": None,
                "reason": "On-chain decision record",
                "result": "Executed",
                "tx_id": None,
            })

    combined.sort(key=lambda e: e.get("timestamp", 0), reverse=True)
    return [DecisionEntry(**c) for c in combined[:50]]


@app.post("/api/trigger-rebalance")
async def trigger_rebalance(trigger: RebalanceTrigger):
    """Queue a manual rebalance request for the agent to execute."""
    entry = {
        "timestamp": int(time.time()),
        "new_lower": trigger.new_lower,
        "new_upper": trigger.new_upper,
        "reason": trigger.reason,
        "status": "queued",
    }
    rebalance_queue.append(entry)

    # Log the decision
    decision_log.append(DecisionEntry(
        timestamp=int(time.time()),
        action="REBALANCE",
        reason=f"Manual: {trigger.reason}",
        result="Queued",
    ))

    return {
        "status": "queued",
        "message": f"Rebalance queued: ${trigger.new_lower:.3f} → ${trigger.new_upper:.3f}",
        "queue_position": len(rebalance_queue),
    }


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    try:
        status = algod_client.status()
        last_round = status.get("last-round", 0)
        return {
            "status": "healthy",
            "app_id": APP_ID,
            "network": "testnet",
            "last_round": last_round,
            "timestamp": int(time.time()),
        }
    except Exception as e:
        return {
            "status": "degraded",
            "app_id": APP_ID,
            "error": str(e),
            "timestamp": int(time.time()),
        }


@app.get("/api/queue")
async def get_queue():
    """Check pending rebalance queue."""
    return {"pending": rebalance_queue, "count": len(rebalance_queue)}


# ── Agent Process Control ─────────────────────────────────
def _read_agent_decisions() -> list[dict]:
    """Read agent decisions from local JSON log file (project root)."""
    log_path = Path(__file__).parent.parent / "agent_decisions.json"
    if not log_path.exists():
        # Also try agent subdirectory
        log_path = Path(__file__).parent.parent / "agent" / "agent_decisions.json"
    if not log_path.exists():
        return []
    try:
        with open(log_path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


@app.post("/api/agent/start")
async def start_agent():
    """Start the monitoring agent as a subprocess."""
    global agent_process, agent_start_time

    if agent_process and agent_process.poll() is None:
        return {"status": "already_running", "pid": agent_process.pid}

    agent_script = Path(__file__).parent.parent / "agent" / "aegis_agent.py"
    if not agent_script.exists():
        raise HTTPException(status_code=404, detail="Agent script not found")

    try:
        # Use py -3.10 on Windows since sys.executable may be Python 3.14t (free-threaded)
        # which lacks installed packages (httpx, algosdk, etc.)
        python_cmd = ["py", "-3.10"] if os.name == "nt" else [sys.executable]
        agent_process = subprocess.Popen(
            [*python_cmd, str(agent_script)],
            cwd=str(agent_script.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        )
        agent_start_time = time.time()
        return {
            "status": "started",
            "pid": agent_process.pid,
            "message": "Agent started in dry-run mode"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start agent: {e}")


@app.post("/api/agent/stop")
async def stop_agent():
    """Stop the monitoring agent subprocess."""
    global agent_process, agent_start_time

    if not agent_process or agent_process.poll() is not None:
        agent_process = None
        agent_start_time = None
        return {"status": "not_running"}

    try:
        agent_process.terminate()
        try:
            agent_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            agent_process.kill()
        pid = agent_process.pid
        agent_process = None
        agent_start_time = None
        return {"status": "stopped", "pid": pid}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/agent/status")
async def agent_status():
    """Get agent running status and recent decisions."""
    running = agent_process is not None and agent_process.poll() is None
    decisions = _read_agent_decisions()

    # Get latest decisions (max 10)
    recent = decisions[-10:] if decisions else []
    recent.reverse()  # newest first

    uptime = 0
    if running and agent_start_time:
        uptime = int(time.time() - agent_start_time)

    return {
        "running": running,
        "pid": agent_process.pid if running else None,
        "uptime_seconds": uptime,
        "total_decisions": len(decisions),
        "recent_decisions": recent,
        "last_decision": recent[0] if recent else None,
    }


@app.on_event("shutdown")
async def shutdown_agent():
    """Ensure agent process is cleaned up on server shutdown."""
    global agent_process
    if agent_process and agent_process.poll() is None:
        agent_process.terminate()
        agent_process = None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

