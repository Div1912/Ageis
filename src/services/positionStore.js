/**
 * Position store — localStorage-backed position tracking.
 * The contract is single-vault (one active position in global state).
 * This service tracks ALL positions ever created, marking old ones as "closed"
 * when a new one is set on-chain.
 */

const STORAGE_KEY = 'aegis_positions'

/** Get all tracked positions from localStorage. */
export function getPositions() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
        return []
    }
}

/** Save the full positions array. */
function savePositions(positions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}

/**
 * Called BEFORE a new set_position on-chain call.
 * Snapshots the current active position as "closed" so it appears in history.
 * @param {Object} currentOnChain - current on-chain position data
 */
export function archiveCurrentPosition(currentOnChain) {
    if (!currentOnChain || !currentOnChain.entryPrice || currentOnChain.entryPrice === 0) return

    const positions = getPositions()

    // Mark any existing active position as closed
    for (const p of positions) {
        if (p.status === 'active') {
            p.status = 'closed'
            p.closedAt = Date.now()
        }
    }

    // Check if this position is already tracked
    const alreadyTracked = positions.some(p =>
        p.entryPrice === currentOnChain.entryPrice &&
        p.lowerBound === currentOnChain.lowerBound &&
        p.upperBound === currentOnChain.upperBound &&
        p.capitalUsdc === currentOnChain.capitalUsdc
    )

    if (!alreadyTracked) {
        positions.push({
            id: `pos_${Date.now()}`,
            entryPrice: currentOnChain.entryPrice,
            lowerBound: currentOnChain.lowerBound,
            upperBound: currentOnChain.upperBound,
            capitalUsdc: currentOnChain.capitalUsdc,
            openTimestamp: currentOnChain.openTimestamp || Math.floor(Date.now() / 1000),
            totalRebalances: currentOnChain.totalRebalances || 0,
            status: 'closed',
            closedAt: Date.now(),
            pair: 'ALGO / USDC',
            pool: 'Pact CLMM',
        })
    }

    savePositions(positions)
}

/**
 * Called AFTER a new set_position succeeds on-chain.
 * Records the new position as "active".
 * @param {Object} newPosition - { entryPrice, lowerBound, upperBound, capitalUsdc }
 */
export function trackNewPosition(newPosition) {
    const positions = getPositions()

    // Mark any existing active position as closed
    for (const p of positions) {
        if (p.status === 'active') {
            p.status = 'closed'
            p.closedAt = Date.now()
        }
    }

    positions.push({
        id: `pos_${Date.now()}`,
        entryPrice: newPosition.entryPrice || newPosition.entry,
        lowerBound: newPosition.lowerBound || newPosition.lower,
        upperBound: newPosition.upperBound || newPosition.upper,
        capitalUsdc: newPosition.capitalUsdc || newPosition.capital,
        openTimestamp: Math.floor(Date.now() / 1000),
        totalRebalances: 0,
        status: 'active',
        pair: 'ALGO / USDC',
        pool: 'Pact CLMM',
    })

    savePositions(positions)
}

/**
 * Update capital of the current active position (Add Liquidity).
 * @param {number} additionalCapital - USDC to add
 */
export function addLiquidityToActive(additionalCapital) {
    const positions = getPositions()
    const active = positions.find(p => p.status === 'active')
    if (active) {
        active.capitalUsdc = (active.capitalUsdc || 0) + additionalCapital
    }
    savePositions(positions)
}

/**
 * Close the current active position (Remove Liquidity).
 */
export function closeActivePosition() {
    const positions = getPositions()
    for (const p of positions) {
        if (p.status === 'active') {
            p.status = 'closed'
            p.closedAt = Date.now()
        }
    }
    savePositions(positions)
}

/** Get closed positions for display. */
export function getClosedPositions() {
    return getPositions().filter(p => p.status === 'closed')
}

/** Get active position from store (if any). */
export function getActivePosition() {
    return getPositions().find(p => p.status === 'active') || null
}
