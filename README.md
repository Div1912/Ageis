# AEGIS — Autonomous LP Manager on Algorand

> Autonomous Concentrated Liquidity Position Manager built on Algorand Testnet.
> Agent monitors positions, decides when to rebalance based on fee capture vs swap cost,
> and executes atomic 8-transaction groups — all while the user just watches their returns compound.

---

## 🔗 Live Links

| Resource | Link |
|----------|------|
| **App ID** | [`755777633`](https://lora.algokit.io/testnet/application/755777633) |
| **Network** | Algorand Testnet |
| **Frontend** | `http://localhost:5173` |
| **API Docs** | `http://localhost:8000/docs` |

---

## 🏗 Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │────▶│  FastAPI      │────▶│  Algorand        │
│  React/Vite  │     │  Backend      │     │  Testnet         │
│  :5173       │     │  :8000        │     │                  │
└──────────────┘     └──────────────┘     │  ┌────────────┐  │
       │                    ▲              │  │ AegisVault │  │
       │                    │              │  │ Contract   │  │
       └──── fallback ──────┘              │  └────────────┘  │
                                           │        ▲         │
                            ┌──────────┐   │        │         │
                            │  AEGIS   │───┘────────┘         │
                            │  Agent   │                      │
                            │ (Python) │  atomic groups       │
                            └──────────┘──────────────────────┘
```

**Data flow:** Frontend → FastAPI → Algorand Indexer/Algod → on-chain state.
**Fallback:** Frontend reads directly from chain if backend is offline.
**Agent:** Polls every 40s, evaluates fee capture vs cost, executes atomic rebalance groups.

---

## 🔑 Key Features

### Smart Contract (PuyaPy)
- **Vault with fund tracking** — `deposited_algo`, `deposited_usdc` on-chain
- **Agent key delegation** — `authorize_agent()` lets the agent rebalance but *never* withdraw
- **Withdrawal guard** — `withdraw()` asserts `Txn.sender == Global.creator_address`
- **Decision log** — on-chain action counter with timestamp
- **ARC-4 ABI methods** — `set_position`, `trigger_rebalance`, `deposit`, `withdraw`, `get_position`, `get_vault_state`

### Python Agent
- **40-second monitoring loop** (~10 Algorand blocks)
- **Decision engine**: `fee_capture > swap_cost × 1.5`
- **Volatility model**: Rolling std dev predicting hours-in-range
- **Atomic 8-txn group**: Pact withdraw → Tinyman swap → Pact redeposit → contract update
- **Slippage guard**: Auto-revert if any transaction fails
- **Dry-run mode**: Runs without credentials for testing

### FastAPI Backend
- `GET /api/position` — live vault state from global state
- `GET /api/rebalance-history` — parsed from Algorand Indexer
- `GET /api/decision-log` — agent decisions (on-chain + local)
- `POST /api/trigger-rebalance` — manual override queue
- `GET /api/health` — network status with last round
- `GET /api/queue` — pending rebalances

### Frontend (React + Vite)
- **Dashboard** with live price, P&L, fee accumulation, range gauge
- **Out-of-range alert** with fee loss estimate and rebalance CTA
- **Transaction preview** modal with fee projections and cost breakdown
- **5-step onboarding** wizard (range → capital → deposit → agent auth → confirm)
- **Transaction history** page with type filters and search
- **Positions** page reading live on-chain data
- **Skeleton loading** states across all pages
- **Pera Wallet** integration for signing

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Algorand Testnet account with ALGO balance ([Faucet](https://bank.testnet.algorand.network/))

### 1. Frontend
```bash
npm install
npm run dev
# → http://localhost:5173
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs
```

### 3. Agent (dry-run)
```bash
cd agent
pip install algosdk httpx
python aegis_agent.py
# Runs in dry-run mode without AGENT_MNEMONIC
```

### 4. Deploy Contract
```bash
export DEPLOYER_MNEMONIC="your 25-word mnemonic"
algokit compile py contracts/aegis_position.py
python contracts/deploy.py
# Updates .env with new VITE_APP_ID
```

---

## 📁 Project Structure

```
AGEIS/
├── contracts/
│   ├── aegis_position.py    # PuyaPy vault contract
│   └── deploy.py            # Testnet deployment script
├── backend/
│   ├── main.py              # FastAPI with 6 endpoints
│   └── requirements.txt
├── agent/
│   ├── aegis_agent.py       # Monitoring agent
│   └── config.py            # Agent configuration
├── scripts/
│   └── seed_testnet.py      # Testnet setup helper
├── src/
│   ├── pages/               # Landing, Dashboard, Positions, Analytics, Transactions
│   ├── components/          # OutOfRangeAlert, ConfirmationModal, DecisionLogTable, etc
│   ├── hooks/               # useWallet, usePosition, useLivePrice, useDerivedStats
│   └── services/            # apiService, contractService, vestigeService, pnlCalculator
├── .env                     # VITE_APP_ID and node config
├── package.json
└── vite.config.js
```

---

## 🔒 Security Model

```
Creator (you)  ──can──▶  set_position, deposit, withdraw, authorize_agent, trigger_rebalance
Agent          ──can──▶  trigger_rebalance, log_decision
Agent          ──CANNOT──▶  withdraw, deposit, set_position, authorize_agent
```

The agent can only move your liquidity between pool ranges — it can never extract funds.
You can revoke agent access at any time with `revoke_agent()`.

---

## 📊 Decision Engine Logic

```
IF in_range:
    IF hours_to_boundary < 4 AND net_benefit > cost × 1.5:
        → REBALANCE (preemptive)
    ELSE:
        → HOLD
ELSE out_of_range:
    IF projected_weekly_fees > cost × 1.5:
        → REBALANCE (reactive)
    ELSE:
        → SKIP (cost too high)
```

---

## 🛠 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_ID` | `743291048` | Deployed contract App ID |
| `VITE_ALGO_NODE` | `https://testnet-api.algonode.cloud` | Algod URL |
| `VITE_INDEXER` | `https://testnet-idx.algonode.cloud` | Indexer URL |
| `VITE_VESTIGE` | `https://free-api.vestige.fi` | Price feed |
| `VITE_API_URL` | `http://localhost:8000` | FastAPI backend URL |
| `DEPLOYER_MNEMONIC` | — | 25-word mnemonic for deployment |
| `AGENT_MNEMONIC` | — | 25-word mnemonic for agent |

---

## 📐 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | PuyaPy (Algorand) |
| Backend | FastAPI + Python 3.11 |
| Agent | Python + algosdk + httpx |
| Frontend | React 18 + Vite + Framer Motion |
| Charts | Recharts |
| Wallet | Pera Wallet (@perawallet/connect) |
| Styling | Vanilla CSS (dark theme) |

---

Built for Algorand hackathon · Testnet only · Not financial advice.
