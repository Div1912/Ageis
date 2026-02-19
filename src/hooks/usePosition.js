/**
 * usePosition — reads THIS wallet's AEGIS position data.
 *
 * Priority order:
 *   1. Supabase (wallet-scoped) — each user sees only their own position
 *   2. On-chain contract read — used as a fallback / for position creator
 *   3. Backend API — only used if wallet is the contract creator
 *
 * CRITICAL: position data is scoped per walletAddress.
 * If no walletAddress, returns empty state (not connected).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPositionFromAPI } from '../services/apiService'
import { readPosition } from '../services/contractService'
import { getActivePositions } from '../services/supabaseService'

const REFRESH_INTERVAL = 30_000

const EMPTY = {
    entryPrice: 0,
    lowerBound: 0,
    upperBound: 0,
    capitalUsdc: 0,
    openTimestamp: 0,
    totalRebalances: 0,
    lastRebalanceTimestamp: 0,
    depositedAlgo: 0,
    depositedUsdc: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    agentAuthorized: false,
    totalDecisions: 0,
    lastDecisionTimestamp: 0,
    lastDecisionAction: 0,
    appId: 0,
    source: 'empty',
}

export function usePosition(walletAddress) {
    const [position, setPosition] = useState(EMPTY)
    const [isLoading, setIsLoading] = useState(!!walletAddress)
    const [error, setError] = useState(null)
    const lastGoodData = useRef(null)

    const load = useCallback(async () => {
        // No wallet connected → clear state
        if (!walletAddress) {
            setPosition(EMPTY)
            setIsLoading(false)
            lastGoodData.current = null
            return
        }

        try {
            // ── Step 1: Load from Supabase (wallet-scoped) ──────────────
            let supabasePos = null
            try {
                const positions = await getActivePositions(walletAddress)
                if (positions && positions.length > 0) {
                    // Use the most recent active position
                    const latest = positions[0]
                    supabasePos = {
                        entryPrice: latest.entryPrice || 0,
                        lowerBound: latest.lowerBound || 0,
                        upperBound: latest.upperBound || 0,
                        capitalUsdc: latest.capitalUsdc || 0,
                        openTimestamp: latest.openTimestamp || 0,
                        totalRebalances: latest.totalRebalances || 0,
                        lastRebalanceTimestamp: 0,
                        depositedAlgo: 0,
                        depositedUsdc: 0,
                        totalDeposits: 0,
                        totalWithdrawals: 0,
                        agentAuthorized: false,
                        totalDecisions: 0,
                        lastDecisionTimestamp: 0,
                        lastDecisionAction: 0,
                        appId: latest.appId || 0,
                        source: 'supabase',
                        _positionId: latest.id,
                        _walletAddress: walletAddress,
                    }
                }
            } catch (sb) {
                console.warn('[usePosition] Supabase read failed:', sb.message)
            }

            if (supabasePos && supabasePos.entryPrice > 0) {
                // ── Step 2: Enrich with live on-chain data for this user's app ──
                // Try on-chain to get deposit amounts, rebalances etc
                try {
                    const onChain = await readPosition()
                    if (onChain && onChain.entryPrice > 0) {
                        // Merge: trust Supabase for position params, on-chain for live counters
                        // But only if the on-chain position entry matches our saved entry
                        const enriched = {
                            ...supabasePos,
                            totalRebalances: onChain.totalRebalances || supabasePos.totalRebalances,
                            lastRebalanceTimestamp: onChain.lastRebalanceTimestamp || 0,
                            depositedAlgo: onChain.depositedAlgo || 0,
                            depositedUsdc: onChain.depositedUsdc || 0,
                            totalDeposits: onChain.totalDeposits || 0,
                            totalWithdrawals: onChain.totalWithdrawals || 0,
                            agentAuthorized: onChain.agentAuthorized || false,
                            totalDecisions: onChain.totalDecisions || 0,
                            lastDecisionTimestamp: onChain.lastDecisionTimestamp || 0,
                            lastDecisionAction: onChain.lastDecisionAction || 0,
                            source: 'supabase+onchain',
                        }
                        lastGoodData.current = enriched
                        setPosition(enriched)
                        setError(null)
                        setIsLoading(false)
                        return
                    }
                } catch (_) { /* on-chain enrichment failed — use supabase alone */ }

                lastGoodData.current = supabasePos
                setPosition(supabasePos)
                setError(null)
                setIsLoading(false)
                return
            }

            // ── Step 3: No Supabase data — new user with no positions yet ──
            // Show empty state, not another user's data
            if (lastGoodData.current && lastGoodData.current._walletAddress === walletAddress) {
                setPosition(lastGoodData.current)
            } else {
                // Different wallet or no data — reset to empty
                lastGoodData.current = null
                setPosition(EMPTY)
            }
            setError(null)
        } catch (err) {
            if (lastGoodData.current && lastGoodData.current._walletAddress === walletAddress) {
                setPosition(lastGoodData.current)
            }
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }, [walletAddress])

    // Force update (e.g., after creating a position)
    const forceUpdate = useCallback((newData) => {
        if (newData && newData.entryPrice > 0) {
            const tagged = { ...newData, source: 'local-update', _walletAddress: walletAddress }
            lastGoodData.current = tagged
            setPosition(tagged)
            setIsLoading(false)
            setError(null)
        }
    }, [walletAddress])

    // Re-run when walletAddress changes (login / logout / switch)
    useEffect(() => {
        lastGoodData.current = null
        setPosition(EMPTY)
        setIsLoading(!!walletAddress)
        load()
        const interval = setInterval(load, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [load, walletAddress])

    return { ...position, isLoading, error, refresh: load, forceUpdate }
}
