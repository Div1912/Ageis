"""
AEGIS Direct Deployment — deploys the contract using TEAL programs.
No puya, no AlgoKit compile needed. Just py-algorand-sdk.

This script:
  1. Loads DEPLOYER_MNEMONIC from .env
  2. Compiles TEAL via algod (AVM compile endpoint)
  3. Deploys the contract (ApplicationCreateTxn)
  4. Calls initialize() to zero-initialize all state
  5. Calls set_position() with default position parameters
  6. Updates .env with the new VITE_APP_ID

Usage:
  set DEPLOYER_MNEMONIC=your 25-word mnemonic here
  python contracts/deploy_teal.py

Get Testnet ALGO: https://bank.testnet.algorand.network/
"""
import os
import sys
import base64
import struct
from pathlib import Path

# -- Load deps -----------------------------------------------
try:
    from algosdk import account, mnemonic, transaction, encoding
    from algosdk.v2client import algod
    from dotenv import load_dotenv
except ImportError:
    print("Run: pip install py-algorand-sdk python-dotenv")
    sys.exit(1)

load_dotenv()

# -- Config ---------------------------------------------------
ALGOD_URL   = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""
ALGOD_HEADERS = {"User-Agent": "aegis-deploy/1.0"}

# ARC-4 method selectors (first 4 bytes of SHA-512/256 of method signature)
# Pre-computed for our contract methods:
import hashlib

def method_selector(sig: str) -> bytes:
    """Compute ARC-4 method selector from signature string."""
    h = hashlib.new("sha512_256", sig.encode()).digest()
    return h[:4]

SEL_INITIALIZE     = method_selector("initialize()void")
SEL_SET_POSITION   = method_selector("set_position(uint64,uint64,uint64,uint64)void")
SEL_AUTHORIZE      = method_selector("authorize_agent(account)void")
SEL_REBALANCE      = method_selector("trigger_rebalance(uint64,uint64)void")
SEL_DEPOSIT        = method_selector("deposit(uint64,uint64)void")
SEL_LOG_DECISION   = method_selector("log_decision(uint64)void")

def encode_uint64(n: int) -> bytes:
    return struct.pack(">Q", n)

# -- TEAL Programs ---------------------------------------------
# Approval program: handles all ABI calls with creator/agent auth
APPROVAL_TEAL = """#pragma version 9

// Route on application call type
txn ApplicationID
bz handle_create

// Branch on method selector
txna ApplicationArgs 0
method "initialize()void"
==
bnz route_initialize

txna ApplicationArgs 0
method "set_position(uint64,uint64,uint64,uint64)void"
==
bnz route_set_position

txna ApplicationArgs 0
method "authorize_agent(account)void"
==
bnz route_authorize_agent

txna ApplicationArgs 0
method "revoke_agent()void"
==
bnz route_revoke_agent

txna ApplicationArgs 0
method "trigger_rebalance(uint64,uint64)void"
==
bnz route_trigger_rebalance

txna ApplicationArgs 0
method "deposit(uint64,uint64)void"
==
bnz route_deposit

txna ApplicationArgs 0
method "withdraw(uint64,uint64)void"
==
bnz route_withdraw

txna ApplicationArgs 0
method "log_decision(uint64)void"
==
bnz route_log_decision

// Allow read-only / bare calls
int 1
return

// -- handle_create ----------------------------------------------
handle_create:
  // Only allow creation if calling initialize()
  txna ApplicationArgs 0
  method "initialize()void"
  ==
  assert
  b route_initialize

// -- initialize ------------------------------------------------
route_initialize:
  byte "entry_price"
  int 0
  app_global_put
  byte "lower_bound"
  int 0
  app_global_put
  byte "upper_bound"
  int 0
  app_global_put
  byte "capital_usdc"
  int 0
  app_global_put
  byte "open_timestamp"
  int 0
  app_global_put
  byte "total_rebalances"
  int 0
  app_global_put
  byte "last_rebalance_ts"
  int 0
  app_global_put
  byte "deposited_algo"
  int 0
  app_global_put
  byte "deposited_usdc"
  int 0
  app_global_put
  byte "total_deposits"
  int 0
  app_global_put
  byte "total_withdrawals"
  int 0
  app_global_put
  byte "agent_address"
  byte ""
  app_global_put
  byte "agent_authorized"
  int 0
  app_global_put
  byte "total_decisions"
  int 0
  app_global_put
  byte "last_decision_ts"
  int 0
  app_global_put
  byte "last_decision_action"
  int 0
  app_global_put
  int 1
  return

// -- set_position ----------------------------------------------
route_set_position:
  txn Sender
  global CreatorAddress
  ==
  assert  // "Unauthorized"
  byte "entry_price"
  txna ApplicationArgs 1
  btoi
  app_global_put
  byte "lower_bound"
  txna ApplicationArgs 2
  btoi
  app_global_put
  byte "upper_bound"
  txna ApplicationArgs 3
  btoi
  app_global_put
  byte "capital_usdc"
  txna ApplicationArgs 4
  btoi
  app_global_put
  byte "open_timestamp"
  global LatestTimestamp
  app_global_put
  int 1
  return

// -- authorize_agent -------------------------------------------
route_authorize_agent:
  txn Sender
  global CreatorAddress
  ==
  assert
  byte "agent_address"
  txna ApplicationArgs 1
  app_global_put
  byte "agent_authorized"
  int 1
  app_global_put
  int 1
  return

// -- revoke_agent ----------------------------------------------
route_revoke_agent:
  txn Sender
  global CreatorAddress
  ==
  assert
  byte "agent_address"
  byte ""
  app_global_put
  byte "agent_authorized"
  int 0
  app_global_put
  int 1
  return

// -- trigger_rebalance -----------------------------------------
route_trigger_rebalance:
  // Allow creator OR authorized agent (must verify sender == agent_address)
  txn Sender
  global CreatorAddress
  ==
  bnz rebalance_authorized
  // Check agent_authorized == 1
  byte "agent_authorized"
  app_global_get
  int 1
  ==
  assert
  // Also verify sender IS the agent
  txn Sender
  byte "agent_address"
  app_global_get
  ==
  assert
rebalance_authorized:
  byte "lower_bound"
  txna ApplicationArgs 1
  btoi
  app_global_put
  byte "upper_bound"
  txna ApplicationArgs 2
  btoi
  app_global_put
  byte "total_rebalances"
  byte "total_rebalances"
  app_global_get
  int 1
  +
  app_global_put
  byte "last_rebalance_ts"
  global LatestTimestamp
  app_global_put
  byte "total_decisions"
  byte "total_decisions"
  app_global_get
  int 1
  +
  app_global_put
  byte "last_decision_ts"
  global LatestTimestamp
  app_global_put
  byte "last_decision_action"
  int 1
  app_global_put
  int 1
  return

// -- deposit ---------------------------------------------------
route_deposit:
  // PUBLIC: Any user can deposit into the pool
  byte "deposited_algo"
  byte "deposited_algo"
  app_global_get
  txna ApplicationArgs 1
  btoi
  +
  app_global_put
  byte "deposited_usdc"
  byte "deposited_usdc"
  app_global_get
  txna ApplicationArgs 2
  btoi
  +
  app_global_put
  byte "total_deposits"
  byte "total_deposits"
  app_global_get
  int 1
  +
  app_global_put
  int 1
  return

// -- withdraw --------------------------------------------------
route_withdraw:
  // SECURITY: Only creator can withdraw — agent is blocked
  txn Sender
  global CreatorAddress
  ==
  assert  // "Only creator can withdraw"
  byte "deposited_algo"
  byte "deposited_algo"
  app_global_get
  txna ApplicationArgs 1
  btoi
  -
  app_global_put
  byte "deposited_usdc"
  byte "deposited_usdc"
  app_global_get
  txna ApplicationArgs 2
  btoi
  -
  app_global_put
  byte "total_withdrawals"
  byte "total_withdrawals"
  app_global_get
  int 1
  +
  app_global_put
  int 1
  return

// -- log_decision ----------------------------------------------
route_log_decision:
  txn Sender
  global CreatorAddress
  ==
  bnz log_authorized
  // Check agent_authorized == 1
  byte "agent_authorized"
  app_global_get
  int 1
  ==
  assert
  // Also verify sender IS the agent
  txn Sender
  byte "agent_address"
  app_global_get
  ==
  assert
log_authorized:
  byte "total_decisions"
  byte "total_decisions"
  app_global_get
  int 1
  +
  app_global_put
  byte "last_decision_ts"
  global LatestTimestamp
  app_global_put
  byte "last_decision_action"
  txna ApplicationArgs 1
  btoi
  app_global_put
  int 1
  return
"""

CLEAR_TEAL = """#pragma version 9
int 1
"""


def main():
    print()
    print("=" * 62)
    print("  AEGIS Contract Deployment (Direct TEAL)")
    print("=" * 62)
    print()

    # Load mnemonic
    mn = os.environ.get("DEPLOYER_MNEMONIC", "").strip()
    if not mn:
        print("ERROR: DEPLOYER_MNEMONIC not set.")
        print()
        print("  PowerShell:")
        print('  $env:DEPLOYER_MNEMONIC = "your 25-word mnemonic here"')
        print()
        print("  Use the mnemonic from your .env or generate a new one.")
        sys.exit(1)

    private_key = mnemonic.to_private_key(mn)
    deployer_addr = account.address_from_private_key(private_key)

    # Connect to algod
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL, headers=ALGOD_HEADERS)

    try:
        status = client.status()
        print(f"  Network:  Algorand Testnet (round {status['last-round']})")
    except Exception as e:
        print(f"  ERROR: Cannot connect to Testnet algod: {e}")
        print("  Check your internet connection.")
        sys.exit(1)

    # Check balance
    try:
        info = client.account_info(deployer_addr)
        balance = info["amount"] / 1e6
    except Exception as e:
        print(f"  ERROR: Cannot fetch account info: {e}")
        sys.exit(1)

    print(f"  Deployer: {deployer_addr}")
    print(f"  Balance:  {balance:.4f} ALGO")
    print()

    if balance < 0.5:
        print(f"  [!] Need at least 0.5 ALGO. Fund here:")
        print(f"  https://bank.testnet.algorand.network/")
        print(f"  Address: {deployer_addr}")
        sys.exit(1)

    print("  [OK] Balance OK")
    print()

    # Compile TEAL
    print("  Compiling approval program…")
    try:
        result = client.compile(APPROVAL_TEAL)
        approval_b64 = result["result"]
        approval_program = base64.b64decode(approval_b64)
        print(f"  [OK] Approval: {len(approval_program)} bytes")

        result = client.compile(CLEAR_TEAL)
        clear_b64 = result["result"]
        clear_program = base64.b64decode(clear_b64)
        print(f"  [OK] Clear:    {len(clear_program)} bytes")
    except Exception as e:
        print(f"  ERROR compiling TEAL: {e}")
        sys.exit(1)

    # Get suggested params
    sp = client.suggested_params()

    # Build ApplicationCreateTxn
    print()
    print("  Creating application…")
    create_txn = transaction.ApplicationCreateTxn(
        sender=deployer_addr,
        sp=sp,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=transaction.StateSchema(num_uints=16, num_byte_slices=2),
        local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
        app_args=[SEL_INITIALIZE],  # call initialize() on create
    )

    signed = create_txn.sign(private_key)
    try:
        tx_id = client.send_transaction(signed)
        print(f"  [OK] TX sent:  {tx_id}")
    except Exception as e:
        print(f"  ERROR sending transaction: {e}")
        sys.exit(1)

    # Wait for confirmation
    print("  Waiting for confirmation…")
    try:
        result = transaction.wait_for_confirmation(client, tx_id, wait_rounds=10)
        app_id = result["application-index"]
    except Exception as e:
        print(f"  ERROR waiting for confirmation: {e}")
        sys.exit(1)

    print()
    print(f"  [OK] Contract deployed!")
    print(f"  App ID:    {app_id}")
    print(f"  Explorer:  https://lora.algokit.io/testnet/application/{app_id}")
    print()

    # Call set_position() with demo values
    # Entry: 0.175 -> 175, Lower: 0.143 -> 143, Upper: 0.213 -> 213, Capital: $5000 -> 500000
    print("  Setting initial position: ALGO/USDC, $0.143–$0.213 range, $5000 capital…")
    sp = client.suggested_params()
    set_pos_txn = transaction.ApplicationNoOpTxn(
        sender=deployer_addr,
        sp=sp,
        index=app_id,
        app_args=[
            SEL_SET_POSITION,
            encode_uint64(175),    # entry price: $0.175
            encode_uint64(143),    # lower: $0.143
            encode_uint64(213),    # upper: $0.213
            encode_uint64(500000), # capital: $5000.00
        ],
    )
    signed_pos = set_pos_txn.sign(private_key)
    try:
        pos_tx_id = client.send_transaction(signed_pos)
        transaction.wait_for_confirmation(client, pos_tx_id, wait_rounds=8)
        print(f"  [OK] Position set: {pos_tx_id}")
    except Exception as e:
        print(f"  WARNING: set_position failed: {e}")

    # Record initial deposit
    print("  Recording initial deposit…")
    sp = client.suggested_params()
    deposit_txn = transaction.ApplicationNoOpTxn(
        sender=deployer_addr,
        sp=sp,
        index=app_id,
        app_args=[
            SEL_DEPOSIT,
            encode_uint64(15_000_000),    # 15 ALGO (in microAlgo)
            encode_uint64(2_500_000_000), # 2500 USDC (in micro-units)
        ],
    )
    signed_dep = deposit_txn.sign(private_key)
    try:
        dep_tx_id = client.send_transaction(signed_dep)
        transaction.wait_for_confirmation(client, dep_tx_id, wait_rounds=8)
        print(f"  [OK] Deposit recorded: {dep_tx_id}")
    except Exception as e:
        print(f"  WARNING: deposit failed: {e}")

    # Update .env
    env_path = Path(__file__).parent.parent / ".env"
    env_text = env_path.read_text() if env_path.exists() else ""
    if "VITE_APP_ID=" in env_text:
        import re
        env_text = re.sub(r"VITE_APP_ID=.*", f"VITE_APP_ID={app_id}", env_text)
    else:
        env_text += f"\nVITE_APP_ID={app_id}\n"
    env_path.write_text(env_text)
    print(f"  [OK] .env updated: VITE_APP_ID={app_id}")

    print()
    print("=" * 62)
    print(f"  DEPLOYMENT COMPLETE")
    print(f"  App ID:   {app_id}")
    print(f"  Explorer: https://lora.algokit.io/testnet/application/{app_id}")
    print(f"  Next: npm run dev (frontend will auto-read new App ID)")
    print("=" * 62)
    print()


if __name__ == "__main__":
    main()
