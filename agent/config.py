"""
AEGIS Agent Configuration.

Pool IDs, thresholds, and network config for the monitoring agent.
"""
import os

# ── Network ─────────────────────────────────────────────
ALGOD_URL   = os.getenv("ALGOD_URL", "https://testnet-api.algonode.cloud")
INDEXER_URL = os.getenv("INDEXER_URL", "https://testnet-idx.algonode.cloud")
APP_ID      = int(os.getenv("APP_ID", os.getenv("VITE_APP_ID", "755777633")))

# ── Agent ───────────────────────────────────────────────
AGENT_MNEMONIC = os.getenv("AGENT_MNEMONIC", "")
POLL_INTERVAL_SECONDS = 40   # ~10 Algorand blocks at ~3.3s/block
DECISION_THRESHOLD = 1.5     # fee_capture > swap_cost * this

# ── Pool Config (Testnet) ──────────────────────────────
PACT_POOL_ID   = int(os.getenv("PACT_POOL_ID", "0"))
TINYMAN_POOL_APP_ID = int(os.getenv("TINYMAN_POOL_APP_ID", "148607000"))
TINYMAN_POOL_ADDRESS = os.getenv("TINYMAN_POOL_ADDRESS", "UDFWT5DW3X5RZQYXKQEMZ6MRWAEYHWYP7YUAPZKPW6WJK3JH3OZPL7PO2Y")

# ── Token IDs (Testnet) ────────────────────────────────
ALGO_ASA_ID = 0   # Native ALGO
USDC_ASA_ID = int(os.getenv("USDC_ASA_ID", "10458941"))  # Testnet USDC

# ── Slippage ────────────────────────────────────────────
MAX_SLIPPAGE_PCT = 2.0       # Maximum allowed slippage (%)
SWAP_FEE_ESTIMATE_USD = 4.20 # Estimated cost per rebalance in USD

# ── Anti-Spam Guards ───────────────────────────────────
BUFFER_ZONE_PCT = 3.0        # Ignore out-of-range if price is within 3% of boundary
REBALANCE_COOLDOWN_SECONDS = 1800   # 30 minutes between rebalances
COST_BENEFIT_MULTIPLIER = 2.5       # Require fees > 2.5× swap cost

# ── Volatility Model ───────────────────────────────────
VOLATILITY_WINDOW = 24       # Rolling window in hours for vol calculation
MIN_HOURS_IN_RANGE = 4       # Minimum predicted hours in range to justify rebalance

# ── Logging ─────────────────────────────────────────────
LOG_FILE = os.getenv("AGENT_LOG_FILE", "agent_decisions.json")

# ── Supabase ────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
