/**
 * Supabase data service — replaces localStorage for position/decision persistence.
 * Falls back to localStorage if Supabase not configured.
 * 
 * Tables required in Supabase:
 *   positions: id (uuid), wallet_address (text), pair (text), pool (text),
 *              entry_price (float8), lower_bound (float8), upper_bound (float8),
 *              capital_usdc (float8), open_timestamp (int8), total_rebalances (int4),
 *              status (text), closed_at (int8), app_id (int8), created_at (timestamptz)
 *   
 *   decisions: id (uuid), timestamp (int8), action (text), reason (text),
 *              price (float8), fee_projection (float8), swap_cost (float8),
 *              hours_in_range (float8), confidence (float8), tx_id (text),
 *              created_at (timestamptz)
 */
import { supabase } from './supabaseClient'

// ── Position CRUD ────────────────────────────────

/**
 * Save a new position to Supabase.
 */
export async function savePosition(walletAddress, positionData) {
    if (!supabase) {
        // Fallback: save to localStorage
        _localSavePosition(walletAddress, positionData)
        return positionData
    }

    try {
        const { data, error } = await supabase.from('positions').insert({
            wallet_address: walletAddress,
            pair: positionData.pair || 'ALGO / USDC',
            pool: positionData.pool || 'Pact CLMM',
            entry_price: positionData.entryPrice,
            lower_bound: positionData.lowerBound,
            upper_bound: positionData.upperBound,
            capital_usdc: positionData.capitalUsdc,
            open_timestamp: positionData.openTimestamp || Math.floor(Date.now() / 1000),
            total_rebalances: 0,
            status: 'active',
            app_id: positionData.appId || parseInt(import.meta.env.VITE_APP_ID || '755777633'),
        }).select().single()

        if (error) throw error
        return data
    } catch (err) {
        console.warn('[supabaseService] savePosition failed, using localStorage:', err.message)
        _localSavePosition(walletAddress, positionData)
        return positionData
    }
}

/**
 * Get all positions for a wallet (active + closed).
 */
export async function getPositions(walletAddress) {
    if (!supabase) {
        return _localGetPositions(walletAddress)
    }

    try {
        const { data, error } = await supabase
            .from('positions')
            .select('*')
            .eq('wallet_address', walletAddress)
            .order('created_at', { ascending: false })

        if (error) throw error
        return (data || []).map(_mapPosition)
    } catch (err) {
        console.warn('[supabaseService] getPositions failed, using localStorage:', err.message)
        return _localGetPositions(walletAddress)
    }
}

/**
 * Get active positions only.
 */
export async function getActivePositions(walletAddress) {
    if (!supabase) {
        return _localGetPositions(walletAddress).filter(p => p.status === 'active')
    }

    try {
        const { data, error } = await supabase
            .from('positions')
            .select('*')
            .eq('wallet_address', walletAddress)
            .eq('status', 'active')
            .order('created_at', { ascending: false })

        if (error) throw error
        return (data || []).map(_mapPosition)
    } catch (err) {
        console.warn('[supabaseService] getActivePositions failed:', err.message)
        return _localGetPositions(walletAddress).filter(p => p.status === 'active')
    }
}

/**
 * Close a position (mark as closed).
 */
export async function closePosition(positionId) {
    if (!supabase) {
        _localClosePosition(positionId)
        return
    }

    try {
        const { error } = await supabase
            .from('positions')
            .update({ status: 'closed', closed_at: Math.floor(Date.now() / 1000) })
            .eq('id', positionId)
        if (error) throw error
    } catch (err) {
        console.warn('[supabaseService] closePosition failed:', err.message)
    }
}

/**
 * Update position after deposit/withdraw.
 */
export async function updatePosition(positionId, updates) {
    if (!supabase) return
    try {
        const { error } = await supabase
            .from('positions')
            .update(updates)
            .eq('id', positionId)
        if (error) throw error
    } catch (err) {
        console.warn('[supabaseService] updatePosition failed:', err.message)
    }
}

// ── Decision CRUD ────────────────────────────────

/**
 * Get recent decisions.
 */
export async function getDecisions(limit = 50) {
    if (!supabase) return []
    try {
        const { data, error } = await supabase
            .from('decisions')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit)
        if (error) throw error
        return data || []
    } catch (err) {
        console.warn('[supabaseService] getDecisions failed:', err.message)
        return []
    }
}

// ── Internal: localStorage fallback ────────────────────

function _localSavePosition(wallet, pos) {
    const key = `aegis_positions_${wallet}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.unshift({
        id: `pos_${Date.now()}`,
        ...pos,
        status: 'active',
        createdAt: Date.now(),
    })
    localStorage.setItem(key, JSON.stringify(existing))
}

function _localGetPositions(wallet) {
    const key = `aegis_positions_${wallet}`
    return JSON.parse(localStorage.getItem(key) || '[]')
}

function _localClosePosition(id) {
    // Scan all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('aegis_positions_')) {
            const list = JSON.parse(localStorage.getItem(key) || '[]')
            const updated = list.map(p => p.id === id ? { ...p, status: 'closed', closedAt: Date.now() } : p)
            localStorage.setItem(key, JSON.stringify(updated))
        }
    }
}

function _mapPosition(row) {
    return {
        id: row.id,
        pair: row.pair,
        pool: row.pool,
        entryPrice: row.entry_price,
        lowerBound: row.lower_bound,
        upperBound: row.upper_bound,
        capitalUsdc: row.capital_usdc,
        openTimestamp: row.open_timestamp,
        totalRebalances: row.total_rebalances || 0,
        status: row.status,
        closedAt: row.closed_at,
        appId: row.app_id,
        walletAddress: row.wallet_address,
    }
}
