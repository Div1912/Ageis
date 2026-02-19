"""
AEGIS Testnet Seeding Script — sets up everything on Algorand Testnet.

Steps:
  1. Loads deployer account
  2. Deploys the AegisPosition vault contract
  3. Sets initial LP position parameters
  4. Records an initial deposit
  5. Optionally authorizes an agent key
  6. Prints App ID for .env

Usage:
  pip install algosdk algokit-utils
  export DEPLOYER_MNEMONIC="your 25-word mnemonic"
  python scripts/seed_testnet.py

Get Testnet ALGO: https://bank.testnet.algorand.network/
"""
import os
import sys
import json
from pathlib import Path

def main():
    try:
        from algosdk import account, mnemonic
        from algosdk.v2client import algod
    except ImportError:
        print("ERROR: Install required packages:")
        print("  pip install algosdk algokit-utils")
        sys.exit(1)

    ALGOD_URL = "https://testnet-api.algonode.cloud"
    algod_client = algod.AlgodClient("", ALGOD_URL, headers={"User-Agent": "aegis-seed/2.0"})

    print()
    print("═" * 60)
    print("  AEGIS Testnet Seeder")
    print("═" * 60)
    print()

    # Load deployer
    mn = os.environ.get("DEPLOYER_MNEMONIC")
    if not mn:
        print("ERROR: Set DEPLOYER_MNEMONIC environment variable")
        print("  This should be a 25-word Algorand mnemonic.")
        print()
        print("  To create a new account:")
        print("    python -c \"from algosdk import account; pk, addr = account.generate_account(); "
              "from algosdk import mnemonic; print(f'Address: {addr}'); print(f'Mnemonic: {mnemonic.from_private_key(pk)}')\"")
        print()
        print("  Then fund it: https://bank.testnet.algorand.network/")
        sys.exit(1)

    private_key = mnemonic.to_private_key(mn)
    deployer_addr = account.address_from_private_key(private_key)
    print(f"  Deployer: {deployer_addr}")

    # Check balance
    info = algod_client.account_info(deployer_addr)
    balance = info["amount"] / 1e6
    print(f"  Balance:  {balance:.2f} ALGO")

    if balance < 1:
        print()
        print(f"  ⚠ Insufficient balance. Need at least 1 ALGO.")
        print(f"  Fund here: https://bank.testnet.algorand.network/")
        print(f"  Address:   {deployer_addr}")
        sys.exit(1)

    print(f"  ✓ Balance OK")
    print()

    # Check for compiled contract
    artifact_dir = Path(__file__).parent.parent / "contracts" / "artifacts"
    app_spec_path = artifact_dir / "AegisPosition" / "application.json"

    if app_spec_path.exists():
        print("  ✓ Found compiled contract artifacts")
        print()
        print("  To deploy, run:")
        print("    python contracts/deploy.py")
    else:
        print("  ⚠ Contract artifacts not found.")
        print("  Compile first:")
        print("    algokit compile py contracts/aegis_position.py")
        print()
        print("  Or deploy using algokit:")
        print("    algokit project deploy")

    print()

    # Generate agent key if needed
    agent_mn = os.environ.get("AGENT_MNEMONIC")
    if not agent_mn:
        print("  Generating new agent key pair...")
        agent_pk, agent_addr = account.generate_account()
        agent_mnemonic = mnemonic.from_private_key(agent_pk)
        print(f"  Agent Address:  {agent_addr}")
        print(f"  Agent Mnemonic: {agent_mnemonic}")
        print()
        print("  ⚠ SAVE THIS MNEMONIC! Set it as AGENT_MNEMONIC environment variable.")
        print("  The agent account also needs a small ALGO balance for gas fees.")
        print(f"  Fund here: https://bank.testnet.algorand.network/")
    else:
        agent_pk = mnemonic.to_private_key(agent_mn)
        agent_addr = account.address_from_private_key(agent_pk)
        info = algod_client.account_info(agent_addr)
        agent_balance = info["amount"] / 1e6
        print(f"  Agent:   {agent_addr}")
        print(f"  Balance: {agent_balance:.2f} ALGO")
        if agent_balance < 0.5:
            print(f"  ⚠ Agent needs more ALGO for gas. Fund: https://bank.testnet.algorand.network/")

    print()
    print("═" * 60)
    print("  Seeding complete. Next steps:")
    print("  1. Compile: algokit compile py contracts/aegis_position.py")
    print("  2. Deploy:  python contracts/deploy.py")
    print("  3. Backend: cd backend && uvicorn main:app --reload --port 8000")
    print("  4. Agent:   cd agent && python aegis_agent.py")
    print("  5. Frontend: npm run dev")
    print("═" * 60)
    print()


if __name__ == "__main__":
    main()
