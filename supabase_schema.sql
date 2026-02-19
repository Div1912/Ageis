-- ─────────────────────────────────────────────────────────────
-- AEGIS — Supabase schema
-- Run this in the Supabase SQL editor to create required tables.
-- ─────────────────────────────────────────────────────────────

-- Positions table — stores LP positions for each wallet
CREATE TABLE IF NOT EXISTS positions (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    pair         TEXT DEFAULT 'ALGO / USDC',
    pool         TEXT DEFAULT 'Pact CLMM',
    entry_price  FLOAT8 NOT NULL,
    lower_bound  FLOAT8 NOT NULL,
    upper_bound  FLOAT8 NOT NULL,
    capital_usdc FLOAT8 NOT NULL,
    open_timestamp BIGINT NOT NULL,
    total_rebalances INT DEFAULT 0,
    status       TEXT DEFAULT 'active',   -- 'active' | 'closed'
    closed_at    BIGINT,
    app_id       BIGINT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Index for fast wallet lookups
CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

-- Decisions table — stores agent decision logs
CREATE TABLE IF NOT EXISTS decisions (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp    BIGINT NOT NULL,
    action       TEXT NOT NULL,          -- 'HOLD' | 'REBALANCE'
    reason       TEXT,
    price        FLOAT8,
    fee_projection FLOAT8,
    swap_cost    FLOAT8,
    hours_in_range FLOAT8,
    confidence   FLOAT8,
    tx_id        TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp DESC);

-- Rebalance events table — records on-chain rebalance transactions
CREATE TABLE IF NOT EXISTS rebalance_events (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tx_id        TEXT NOT NULL,
    timestamp    BIGINT NOT NULL,
    round_time   BIGINT,
    fee          FLOAT8,
    new_lower    FLOAT8,
    new_upper    FLOAT8,
    position_id  UUID REFERENCES positions(id),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rebalance_timestamp ON rebalance_events(timestamp DESC);

-- Row Level Security (optional, enable per table)
-- ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rebalance_events ENABLE ROW LEVEL SECURITY;

-- Depositors table — tracks all users who have joined the pool
CREATE TABLE IF NOT EXISTS depositors (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address   TEXT NOT NULL UNIQUE,
    algo_deposited   FLOAT8 DEFAULT 0,
    usdc_deposited   FLOAT8 DEFAULT 0,
    join_tx          TEXT,
    joined_at        TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_depositors_wallet ON depositors(wallet_address);
CREATE INDEX IF NOT EXISTS idx_depositors_joined ON depositors(joined_at);
