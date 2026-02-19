/**
 * usePosition — reads AEGIS vault data.
 *
 * Hybrid Strategy:
 * 1. ALWAYS read Global Vault State (On-Chain) — getting current Range, Entry, TVL.
 *    - This ensures Dashboard always shows the active vault status.
 * 2. Try Supabase for "My Share" (Capital, User's Entry).
 *    - If found: Start with User Data, overlay Global live counters.
 *    - If NOT found (or keys missing): Use Global Vault Data, but set Capital = 0.
 *
 * This ensures:
 * - "Buttons Gone" fix: Vault is always visible (entryPrice > 0).
 * - "New Device" fix: Even if Supabase fails, you see Global Vault (just 0 capital).
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
    _positionId: null,
}

export function usePosition(walletAddress) {
    const [position, setPosition] = useState(EMPTY)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const lastGoodData = useRef(null)

    const load = useCallback(async () => {
        setIsLoading(true)

        // 1. Always fetch Global Vault State (On-Chain)
        // This is public data, available to everyone.
        let globalState = null
        try {
            globalState = await readPosition()
        } catch (e) {
            console.warn('[usePosition] Global read failed:', e)
        }

        // 2. If wallet connected, try fetching User's Share from Supabase
        let userShare = null
        if (walletAddress) {
            try {
                const positions = await getActivePositions(walletAddress)
                if (positions && positions.length > 0) {
                    userShare = positions[0]
                }
            } catch (e) {
                console.warn('[usePosition] Supabase read failed:', e)
            }
        }

        // 3. Merge Strategies
        if (userShare && userShare.entryPrice > 0) {
            // STRATEGY A: User has a specific tracked position
            // Use User's entry/capital, but Global's live counters/range
            const merged = {
                ...globalState, // Global range, TVL, rebalances
                // Overlay User specifics
                entryPrice: userShare.entryPrice,
                capitalUsdc: userShare.capitalUsdc,
                openTimestamp: userShare.openTimestamp,
                appId: userShare.appId || globalState?.appId,
                // Meta
                source: 'supabase+onchain',
                _positionId: userShare.id,
                _walletAddress: walletAddress,
            }
            lastGoodData.current = merged
            setPosition(merged)
        } else if (globalState && globalState.entryPrice > 0) {
            // STRATEGY B: User has no personal position (or Supabase failed), but Vault exists
            // Show Global Vault stats, but Capital = 0 (View-Only Mode)
            const viewOnly = {
                ...globalState,
                capitalUsdc: 0, // No user capital tracked
                source: 'onchain-global',
                _positionId: null,
                _walletAddress: walletAddress,
            }
            lastGoodData.current = viewOnly
            setPosition(viewOnly)
        } else {
            // STRATEGY C: Nothing found (Contract likely empty/new)
            if (lastGoodData.current) {
                setPosition(lastGoodData.current)
            } else {
                setPosition(EMPTY)
            }
        }

        setIsLoading(false)
        setError(null)
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

    // Re-run when walletAddress changes
    useEffect(() => {
        load()
        const interval = setInterval(load, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [load, walletAddress])

    return { ...position, isLoading, error, refresh: load, forceUpdate }
}
