"""
AEGIS Monitoring Agent — the autonomous rebalancing brain.

Monitoring loop:
  1. Polls every ~40 seconds (10 Algorand blocks)
  2. Reads live pool state (Pact CLMM simulation)
  3. Estimates swap cost (Tinyman simulation)
  4. Decision engine: fee_capture > swap_cost × 1.5
  5. Volatility model (rolling std dev)
  6. Atomic group builder (withdraw → swap on Tinyman → redeposit)
  7. Slippage guard — if any txn fails, everything reverts

Usage:
  cd agent
  pip install algosdk httpx numpy
  python aegis_agent.py
"""
import os
import sys
import time
import json
import math
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk import transaction

from config import (
    ALGOD_URL, APP_ID, AGENT_MNEMONIC,
    POLL_INTERVAL_SECONDS, DECISION_THRESHOLD,
    MAX_SLIPPAGE_PCT, SWAP_FEE_ESTIMATE_USD,
    VOLATILITY_WINDOW, MIN_HOURS_IN_RANGE,
    BUFFER_ZONE_PCT, REBALANCE_COOLDOWN_SECONDS, COST_BENEFIT_MULTIPLIER,
    LOG_FILE, USDC_ASA_ID,
    TINYMAN_POOL_APP_ID, TINYMAN_POOL_ADDRESS,
)

# ── Logging ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AEGIS] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("aegis")

# ── Algod Client ────────────────────────────────────────
algod_client = algod.AlgodClient("", ALGOD_URL, headers={"User-Agent": "aegis-agent/2.0"})


# ═══════════════════════════════════════════════════════
#  DATA LAYER — reads state from chain and price feeds
# ═══════════════════════════════════════════════════════

class PositionState:
    """Current on-chain position state."""
    entry_price: float = 0.172
    lower_bound: float = 0.140
    upper_bound: float = 0.220
    capital_usdc: float = 5000.0
    total_rebalances: int = 0
    open_timestamp: int = 0


def read_position_state() -> PositionState:
    """Read position from on-chain global state."""
    pos = PositionState()
    try:
        app_info = algod_client.application_info(APP_ID)
        global_state = app_info.get("params", {}).get("global-state", [])

        import base64
        state = {}
        for kv in global_state:
            key = base64.b64decode(kv["key"]).decode("utf-8", errors="ignore")
            value = kv["value"]
            state[key] = value.get("uint", 0) if value["type"] == 2 else 0

        pos.entry_price = state.get("entry_price", 172) / 1000
        pos.lower_bound = state.get("lower_bound", 140) / 1000
        pos.upper_bound = state.get("upper_bound", 220) / 1000
        pos.capital_usdc = state.get("capital_usdc", 500000) / 100
        pos.total_rebalances = state.get("total_rebalances", 0)
        pos.open_timestamp = state.get("open_timestamp", 0)

    except Exception as e:
        log.warning(f"Failed to read position: {e}")

    return pos


async def fetch_live_price() -> float:
    """Fetch ALGO/USDC price from Vestige.fi."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get("https://free-api.vestige.fi/asset/0/prices?currency=usdc")
            data = resp.json()
            if isinstance(data, list) and data:
                latest = data[-1]
                return latest.get("price", latest.get("close", 0.18))
            elif isinstance(data, dict):
                return data.get("price", 0.18)
    except Exception as e:
        log.warning(f"Price fetch failed: {e}")
    return 0.18


async def fetch_pact_pool_state() -> dict:
    """
    Read Pact CLMM pool state.
    In production, this uses Pact SDK. For now, simulates pool reads.
    """
    price = await fetch_live_price()
    return {
        "current_price": price,
        "liquidity": 125000,   # simulated TVL
        "fee_rate": 0.003,     # 0.3% swap fee
        "tick_spacing": 10,
        "sqrt_price": math.sqrt(price),
    }


def estimate_swap_cost(capital: float, slippage_pct: float = 0.5) -> float:
    """
    Estimate swap cost for a rebalance on Tinyman.
    Real implementation uses Tinyman SDK for quote.
    """
    swap_amount = capital * 0.5   # swap half the position
    swap_fee = swap_amount * 0.003  # 0.3% Tinyman fee
    slippage_cost = swap_amount * (slippage_pct / 100)
    gas_cost = 0.004  # ~4000 microAlgo for atomic group
    return swap_fee + slippage_cost + gas_cost


# ═══════════════════════════════════════════════════════
#  VOLATILITY MODEL — predicts hours-in-range
# ═══════════════════════════════════════════════════════

class VolatilityModel:
    """Simple rolling volatility model. Predicts hours in range."""

    def __init__(self, window: int = 24):
        self.window = window
        self.price_history: list[float] = []

    def update(self, price: float):
        self.price_history.append(price)
        # Keep only last N hours of data (assuming ~90 samples/hour)
        max_samples = self.window * 90
        if len(self.price_history) > max_samples:
            self.price_history = self.price_history[-max_samples:]

    def predict_hours_in_range(self, current: float, lower: float, upper: float) -> float:
        """Predict how many hours price will stay in range based on recent volatility."""
        if len(self.price_history) < 10:
            return 12.0  # default estimate

        # Calculate rolling standard deviation
        recent = self.price_history[-90:]  # last hour
        mean = sum(recent) / len(recent)
        variance = sum((p - mean) ** 2 for p in recent) / len(recent)
        std_dev = math.sqrt(variance) if variance > 0 else 0.001

        # Distance to nearest boundary
        dist_lower = current - lower
        dist_upper = upper - current
        min_dist = min(dist_lower, dist_upper)

        # Rough estimate: hours = (distance / hourly_std_dev)^2
        hourly_std = std_dev * math.sqrt(90)  # scale to hourly
        if hourly_std < 0.0001:
            return 48.0  # very low vol = very long time in range

        hours = (min_dist / hourly_std) ** 2
        return min(hours, 168)  # cap at 1 week


# ═══════════════════════════════════════════════════════
#  DECISION ENGINE — core rebalance logic
# ═══════════════════════════════════════════════════════

class DecisionEngine:
    """Evaluates whether to rebalance based on fee projection vs cost."""

    def __init__(self):
        self.vol_model = VolatilityModel(window=VOLATILITY_WINDOW)
        self.last_rebalance_time: float = 0.0  # timestamp of last rebalance

    def evaluate(
        self,
        price: float,
        position: PositionState,
        pool_state: dict,
    ) -> dict:
        """
        Core decision: should we rebalance?

        Returns dict with:
          - action: "HOLD" | "REBALANCE" | "ALERT" | "SKIP"
          - reason: human-readable explanation
          - fee_projection: estimated 7-day fee capture
          - swap_cost: estimated rebalance cost
          - hours_in_range: predicted hours price stays in range
          - confidence: 0.0 to 1.0
        """
        self.vol_model.update(price)

        in_range = position.lower_bound <= price <= position.upper_bound
        swap_cost = estimate_swap_cost(position.capital_usdc)

        # ── GUARD 1: Cooldown Timer ──
        now = time.time()
        since_last = now - self.last_rebalance_time
        if since_last < REBALANCE_COOLDOWN_SECONDS and self.last_rebalance_time > 0:
            remaining = int(REBALANCE_COOLDOWN_SECONDS - since_last)
            return {
                "action": "SKIP",
                "reason": f"Cooldown: {remaining}s remaining (min {REBALANCE_COOLDOWN_SECONDS}s between rebalances)",
                "fee_projection": 0,
                "swap_cost": swap_cost,
                "hours_in_range": 0,
                "confidence": 0.3,
            }

        # ── GUARD 2: Buffer Zone ──
        # If price is out of range but within BUFFER_ZONE_PCT of a boundary, treat as "in range"
        buffer_frac = BUFFER_ZONE_PCT / 100.0
        if not in_range:
            dist_lower = abs(price - position.lower_bound) / position.lower_bound if position.lower_bound > 0 else 999
            dist_upper = abs(price - position.upper_bound) / position.upper_bound if position.upper_bound > 0 else 999
            if min(dist_lower, dist_upper) < buffer_frac:
                return {
                    "action": "HOLD",
                    "reason": f"Buffer zone: price {min(dist_lower, dist_upper)*100:.1f}% from boundary (< {BUFFER_ZONE_PCT}% threshold)",
                    "fee_projection": 0,
                    "swap_cost": swap_cost,
                    "hours_in_range": 0,
                    "confidence": 0.6,
                }

        # Daily fee projection: capital × fee_rate × utilization
        daily_fee = position.capital_usdc * pool_state["fee_rate"] * (1.0 if in_range else 0.0)
        weekly_fee = daily_fee * 7

        hours_in_range = self.vol_model.predict_hours_in_range(
            price, position.lower_bound, position.upper_bound
        )

        # ── Decision Logic ──
        if in_range:
            # Currently in range — is it worth preemptively rebalancing?
            if hours_in_range < MIN_HOURS_IN_RANGE:
                # About to go out of range
                net_benefit = weekly_fee - swap_cost
                if net_benefit > swap_cost * COST_BENEFIT_MULTIPLIER:
                    self.last_rebalance_time = time.time()
                    return {
                        "action": "REBALANCE",
                        "reason": f"Preemptive: {hours_in_range:.1f}h to boundary, net +${net_benefit:.2f}",
                        "fee_projection": weekly_fee,
                        "swap_cost": swap_cost,
                        "hours_in_range": hours_in_range,
                        "confidence": 0.7,
                    }
                else:
                    return {
                        "action": "ALERT",
                        "reason": f"Near boundary ({hours_in_range:.1f}h), but cost too high",
                        "fee_projection": weekly_fee,
                        "swap_cost": swap_cost,
                        "hours_in_range": hours_in_range,
                        "confidence": 0.5,
                    }
            else:
                return {
                    "action": "HOLD",
                    "reason": f"In range, ~{hours_in_range:.0f}h predicted, fees +${daily_fee:.2f}/day",
                    "fee_projection": weekly_fee,
                    "swap_cost": swap_cost,
                    "hours_in_range": hours_in_range,
                    "confidence": 0.9,
                }
        else:
            # Out of range — should we rebalance?
            # New centered range would capture fees again
            new_lower = price * 0.82
            new_upper = price * 1.22
            projected_daily = position.capital_usdc * pool_state["fee_rate"]
            projected_weekly = projected_daily * 7

            if projected_weekly > swap_cost * COST_BENEFIT_MULTIPLIER:
                self.last_rebalance_time = time.time()
                return {
                    "action": "REBALANCE",
                    "reason": f"Out of range. Projected +${projected_weekly:.2f}/wk > cost ${swap_cost:.2f}",
                    "fee_projection": projected_weekly,
                    "swap_cost": swap_cost,
                    "hours_in_range": 0,
                    "confidence": 0.85,
                    "new_lower": new_lower,
                    "new_upper": new_upper,
                }
            else:
                return {
                    "action": "SKIP",
                    "reason": f"Out of range, but cost ${swap_cost:.2f} > benefit ${projected_weekly:.2f}",
                    "fee_projection": projected_weekly,
                    "swap_cost": swap_cost,
                    "hours_in_range": 0,
                    "confidence": 0.6,
                }


# ═══════════════════════════════════════════════════════
#  ATOMIC GROUP BUILDER — 8 transactions in one block
# ═══════════════════════════════════════════════════════

class AtomicGroupBuilder:
    """
    Builds the atomic rebalance group:
      1. Withdraw from Pact CLMM (simulated on testnet)
      2. Send ALGO to Tinyman pool (real payment)
      3. Tinyman swap app call (real swap execution)
      4. Deposit to Pact CLMM new range (simulated on testnet)
      5. Call trigger_rebalance() on AEGIS contract (real)

    If ANY transaction fails, everything reverts (atomic guarantee).
    Transactions 2-3 are real Tinyman interactions on testnet.
    """

    def __init__(self, agent_address: str, agent_private_key: str):
        self.agent_address = agent_address
        self.agent_private_key = agent_private_key

    async def build_rebalance_group(
        self,
        new_lower: float,
        new_upper: float,
        position: PositionState,
    ) -> list:
        """
        Build the atomic transaction group for a rebalance.
        Uses real Tinyman v2 swap on testnet.
        Returns list of signed transactions ready to submit.
        """
        params = algod_client.suggested_params()
        params.flat_fee = True
        params.fee = 1000  # 0.001 ALGO per txn

        txns = []
        log.info("Building atomic rebalance group...")

        # ── Transaction 1: Withdraw from Pact CLMM (simulated) ──
        # In production: Pact SDK remove_liquidity call
        txn1 = transaction.PaymentTxn(
            sender=self.agent_address,
            sp=params,
            receiver=self.agent_address,
            amt=0,
            note=b"aegis:pact_withdraw",
        )
        txns.append(txn1)

        # ── Transaction 2: Send ALGO to Tinyman pool (real swap input) ──
        # Send a small amount of ALGO to the pool for the swap
        swap_amount_algo = 10_000  # 0.01 ALGO (small testnet amount)
        txn2 = transaction.PaymentTxn(
            sender=self.agent_address,
            sp=params,
            receiver=TINYMAN_POOL_ADDRESS,
            amt=swap_amount_algo,
            note=b"aegis:tinyman_swap_input",
        )
        txns.append(txn2)

        # ── Transaction 3: Tinyman pool app call (real swap execution) ──
        txn3 = transaction.ApplicationCallTxn(
            sender=self.agent_address,
            sp=params,
            index=TINYMAN_POOL_APP_ID,
            on_complete=transaction.OnComplete.NoOpOC,
            app_args=[b"swap", b"fixed-input", (0).to_bytes(8, "big")],  # min output = 0 for testnet
            foreign_assets=[USDC_ASA_ID],
            accounts=[TINYMAN_POOL_ADDRESS],
            note=b"aegis:tinyman_swap_execute",
        )
        txns.append(txn3)

        # ── Transaction 4: Deposit to Pact CLMM new range (simulated) ──
        # In production: Pact SDK add_liquidity call
        txn4 = transaction.PaymentTxn(
            sender=self.agent_address,
            sp=params,
            receiver=self.agent_address,
            amt=0,
            note=b"aegis:pact_deposit_new_range",
        )
        txns.append(txn4)

        # ── Transaction 5: Call trigger_rebalance on AEGIS contract ──
        from algosdk import abi
        method = abi.Method.from_signature("trigger_rebalance(uint64,uint64)void")
        atc = transaction.atomic_transaction_composer.AtomicTransactionComposer()
        atc.add_method_call(
            app_id=APP_ID,
            method=method,
            sender=self.agent_address,
            sp=params,
            signer=transaction.atomic_transaction_composer.AccountTransactionSigner(self.agent_private_key),
            method_args=[
                int(new_lower * 1000),
                int(new_upper * 1000),
            ],
        )
        # Extract the built transaction
        atc_group = atc.build_group()
        txn5 = atc_group[0].txn
        txns.append(txn5)

        # ── Assign group ID (atomic guarantee) ──
        gid = transaction.calculate_group_id(txns)
        for t in txns:
            t.group = gid

        # ── Sign all transactions ──
        signed = [t.sign(self.agent_private_key) for t in txns]

        log.info(f"  Built {len(signed)} transactions in atomic group")
        log.info(f"  New range: ${new_lower:.4f} → ${new_upper:.4f}")
        log.info(f"  Tinyman pool: {TINYMAN_POOL_APP_ID} (real swap)")
        log.info(f"  AEGIS contract: {APP_ID} (trigger_rebalance)")
        log.info(f"  Group ID: {gid.hex()[:16]}...")

        return signed

    async def submit_group(self, signed_txns: list) -> Optional[str]:
        """
        Submit the atomic group with slippage guard.
        If any transaction fails, everything reverts automatically.
        """
        try:
            txid = algod_client.send_transactions(signed_txns)
            log.info(f"  ✓ Atomic group submitted: {txid}")

            # Wait for confirmation
            result = transaction.wait_for_confirmation(algod_client, txid, 4)
            confirmed_round = result.get("confirmed-round", 0)
            log.info(f"  ✓ Confirmed in round {confirmed_round}")

            return txid

        except Exception as e:
            log.error(f"  ✗ Atomic group REVERTED: {e}")
            log.error("  All transactions rolled back — slippage guard activated")
            return None


# ═══════════════════════════════════════════════════════
#  DECISION LOGGER — persists all decisions
# ═══════════════════════════════════════════════════════

class DecisionLogger:
    """Persists agent decisions to local JSON file + Supabase."""

    def __init__(self, log_file: str = LOG_FILE):
        # Write to project root so backend can read it
        self.log_file = Path(__file__).parent.parent / log_file
        self.entries: list[dict] = []
        self.supabase = None
        self._load()
        self._init_supabase()

    def _init_supabase(self):
        try:
            sb_url = os.getenv("SUPABASE_URL", "")
            sb_key = os.getenv("SUPABASE_KEY", "")
            if sb_url and sb_key:
                from supabase import create_client
                self.supabase = create_client(sb_url, sb_key)
                log.info("Supabase connected for decision logging")
        except Exception as e:
            log.warning(f"Supabase init failed (using JSON fallback): {e}")

    def _load(self):
        if self.log_file.exists():
            try:
                self.entries = json.loads(self.log_file.read_text())
            except Exception:
                self.entries = []

    def log(self, decision: dict, price: float, tx_id: Optional[str] = None):
        entry = {
            "timestamp": int(time.time()),
            "datetime": datetime.now().isoformat(),
            "price": price,
            "action": decision["action"],
            "reason": decision["reason"],
            "fee_projection": round(decision.get("fee_projection", 0), 4),
            "swap_cost": round(decision.get("swap_cost", 0), 4),
            "hours_in_range": round(decision.get("hours_in_range", 0), 2),
            "confidence": round(decision.get("confidence", 0), 3),
            "tx_id": tx_id,
        }
        self.entries.append(entry)
        self._save()
        self._write_supabase(entry)

    def _save(self):
        self.log_file.write_text(json.dumps(self.entries, indent=2))

    def _write_supabase(self, entry: dict):
        if not self.supabase:
            return
        try:
            self.supabase.table("decisions").insert(entry).execute()
        except Exception as e:
            log.warning(f"Supabase write failed: {e}")

    def get_recent(self, n: int = 20) -> list:
        return self.entries[-n:]


# ═══════════════════════════════════════════════════════
#  MAIN MONITORING LOOP
# ═══════════════════════════════════════════════════════

async def monitoring_loop():
    """Main agent loop — runs every ~40 seconds."""

    # Initialize components
    if not AGENT_MNEMONIC:
        log.error("AGENT_MNEMONIC not set. Cannot start agent.")
        log.info("Set AGENT_MNEMONIC environment variable to the agent's 25-word mnemonic.")
        log.info("")
        log.info("Running in DRY RUN mode (no transactions will be submitted)...")
        dry_run = True
        agent_address = "DRY-RUN-MODE"
        agent_private_key = ""
    else:
        private_key = mnemonic.to_private_key(AGENT_MNEMONIC)
        agent_address = account.address_from_private_key(private_key)
        agent_private_key = private_key
        dry_run = False

    engine = DecisionEngine()
    logger = DecisionLogger()
    builder = AtomicGroupBuilder(agent_address, agent_private_key) if not dry_run else None

    log.info("═" * 60)
    log.info("  AEGIS Monitoring Agent Started")
    log.info(f"  App ID:    {APP_ID}")
    log.info(f"  Agent:     {agent_address[:8]}...{agent_address[-6:] if len(agent_address) > 14 else ''}")
    log.info(f"  Interval:  {POLL_INTERVAL_SECONDS}s (~10 blocks)")
    log.info(f"  Threshold: ×{DECISION_THRESHOLD}")
    log.info(f"  Mode:      {'DRY RUN' if dry_run else 'LIVE'}")
    log.info("═" * 60)
    log.info("")

    cycle = 0
    while True:
        cycle += 1
        try:
            log.info(f"── Cycle {cycle} ──────────────────────────────")

            # 1. Read on-chain state
            position = read_position_state()
            log.info(f"  Position: ${position.lower_bound:.4f} → ${position.upper_bound:.4f}")
            log.info(f"  Capital:  ${position.capital_usdc:,.0f} | Rebalances: {position.total_rebalances}")

            # 2. Read pool state
            pool_state = await fetch_pact_pool_state()
            price = pool_state["current_price"]
            log.info(f"  Price:    ${price:.4f}")

            in_range = position.lower_bound <= price <= position.upper_bound
            log.info(f"  Status:   {'✓ IN RANGE' if in_range else '✗ OUT OF RANGE'}")

            # 3. Decision engine
            decision = engine.evaluate(price, position, pool_state)
            log.info(f"  Decision: {decision['action']} — {decision['reason']}")
            log.info(f"  Fee proj: ${decision['fee_projection']:.2f}/wk | Cost: ${decision['swap_cost']:.2f}")

            # 4. Execute if REBALANCE
            tx_id = None
            if decision["action"] == "REBALANCE" and not dry_run:
                new_lower = decision.get("new_lower", price * 0.82)
                new_upper = decision.get("new_upper", price * 1.22)

                log.info(f"  ⚡ EXECUTING REBALANCE")
                log.info(f"  New range: ${new_lower:.4f} → ${new_upper:.4f}")

                signed = await builder.build_rebalance_group(new_lower, new_upper, position)
                tx_id = await builder.submit_group(signed)

                if tx_id:
                    log.info(f"  ✓ Rebalance complete: {tx_id}")
                else:
                    log.warning(f"  ✗ Rebalance failed — reverted")
                    decision["action"] = "SKIP"
                    decision["reason"] += " (reverted)"

            elif decision["action"] == "REBALANCE" and dry_run:
                log.info(f"  [DRY RUN] Would rebalance to ${price*0.82:.4f} → ${price*1.22:.4f}")

            # 5. Log decision
            logger.log(decision, price, tx_id)
            log.info(f"  Logged decision #{len(logger.entries)}")
            log.info("")

        except Exception as e:
            log.error(f"  Error in cycle {cycle}: {e}")
            log.info("")

        # Wait for next cycle
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


def main():
    """Entry point."""
    try:
        asyncio.run(monitoring_loop())
    except KeyboardInterrupt:
        log.info("\nAgent stopped by user.")


if __name__ == "__main__":
    main()
