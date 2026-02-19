"""
AEGIS deployment script — enhanced for vault contract.

Prerequisites:
  1. pip install algokit-utils algosdk
  2. Set DEPLOYER_MNEMONIC environment variable
  3. Optionally set AGENT_MNEMONIC for agent key setup

Usage:
  python contracts/deploy.py

The script will:
  - Compile and deploy AegisPosition vault to Algorand Testnet
  - Call set_position() with example values
  - Optionally authorize an agent key
  - Print the App ID — paste this into .env as VITE_APP_ID
"""
import os
import sys
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algokit_utils import (
    ApplicationClient,
    ApplicationSpecification,
    Account,
    get_algod_client,
    get_indexer_client,
)
from pathlib import Path
import json

TESTNET_ALGOD = "https://testnet-api.algonode.cloud"
TESTNET_IDX   = "https://testnet-idx.algonode.cloud"

def get_account_from_env(var_name="DEPLOYER_MNEMONIC") -> Account:
    """Load account from environment variable."""
    mn = os.environ.get(var_name)
    if not mn:
        print(f"ERROR: Set {var_name} environment variable to your 25-word mnemonic.")
        print("       You can get Testnet ALGO from: https://bank.testnet.algorand.network/")
        sys.exit(1)
    private_key = mnemonic.to_private_key(mn)
    addr = account.address_from_private_key(private_key)
    print(f"  Address ({var_name}): {addr}")
    return Account(private_key=private_key, address=addr)


def deploy():
    """Deploy AegisPosition vault contract and set initial position."""
    algod_client = algod.AlgodClient("", TESTNET_ALGOD, headers={"User-Agent": "aegis/2.0"})

    print("═" * 60)
    print("  AEGIS Vault Deployment — Algorand Testnet")
    print("═" * 60)
    print()

    deployer = get_account_from_env("DEPLOYER_MNEMONIC")

    # Check balance
    info = algod_client.account_info(deployer.address)
    balance_algo = info["amount"] / 1e6
    print(f"  Balance: {balance_algo:.2f} ALGO")
    if balance_algo < 1:
        print("ERROR: Need at least 1 ALGO for deployment.")
        print("Fund from: https://bank.testnet.algorand.network/")
        sys.exit(1)

    # Load ARC4 spec
    artifact_dir = Path(__file__).parent / "artifacts"
    app_spec_path = artifact_dir / "AegisPosition" / "application.json"

    if not app_spec_path.exists():
        print()
        print("═" * 60)
        print("  COMPILE FIRST:")
        print("    algokit compile py contracts/aegis_position.py")
        print("═" * 60)
        print()
        print("Then re-run this script.")
        sys.exit(1)

    app_spec = ApplicationSpecification.from_json(app_spec_path.read_text())

    # Deploy
    app_client = ApplicationClient(
        algod_client=algod_client,
        app_spec=app_spec,
        signer=deployer,
    )

    print("\n  Deploying AegisPosition vault to Testnet...")
    app_id, app_addr, txid = app_client.create(call_abi_method="initialize")
    print(f"\n  ✓ Deployed!")
    print(f"    App ID:      {app_id}")
    print(f"    App Address: {app_addr}")
    print(f"    TX:          {txid}")
    print(f"    Explorer:    https://lora.algokit.io/testnet/application/{app_id}")

    # Set initial position: ALGO/USDC entry=$0.172, range $0.140–$0.220, capital=$5000
    print("\n  Setting initial position...")
    result = app_client.call(
        call_abi_method="set_position",
        entry=172,        # $0.172 * 1000
        lower=140,        # $0.140 * 1000
        upper=220,        # $0.220 * 1000
        capital=500000,   # $5000.00 * 100
    )
    print(f"  ✓ Position set — TX: {result.tx_id}")

    # Record initial deposit
    print("\n  Recording initial deposit...")
    result = app_client.call(
        call_abi_method="deposit",
        algo_amount=15_000_000,   # 15 ALGO in microAlgo
        usdc_amount=2_500_000,    # 2500 USDC in micro-units
    )
    print(f"  ✓ Deposit recorded — TX: {result.tx_id}")

    # Authorize agent key if AGENT_MNEMONIC is set
    agent_mn = os.environ.get("AGENT_MNEMONIC")
    if agent_mn:
        agent_pk = mnemonic.to_private_key(agent_mn)
        agent_addr = account.address_from_private_key(agent_pk)
        print(f"\n  Authorizing agent: {agent_addr[:8]}...{agent_addr[-6:]}")
        result = app_client.call(
            call_abi_method="authorize_agent",
            agent=agent_addr,
        )
        print(f"  ✓ Agent authorized — TX: {result.tx_id}")
    else:
        print("\n  ℹ No AGENT_MNEMONIC set — skipping agent authorization")
        print("    Set AGENT_MNEMONIC to authorize an agent key later")

    # Update .env
    env_path = Path(__file__).parent.parent / ".env"
    env_content = env_path.read_text() if env_path.exists() else ""
    lines = [l for l in env_content.splitlines() if not l.startswith("VITE_APP_ID")]
    lines.append(f"VITE_APP_ID={app_id}")
    env_path.write_text("\n".join(lines) + "\n")
    print(f"\n  ✓ Updated .env with VITE_APP_ID={app_id}")

    print()
    print("═" * 60)
    print("  Deployment complete!")
    print(f"  App ID: {app_id}")
    print("  Restart the dev server: npm run dev")
    print("═" * 60)


if __name__ == "__main__":
    deploy()
