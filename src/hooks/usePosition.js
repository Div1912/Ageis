/**
 * usePosition — reads AEGIS vault data, tries backend API first.
 * Falls back to direct on-chain reads if backend is unavailable.
 * Refreshes every 30 seconds.
 * 
 * CRITICAL FIX: Never reset to zeros if a refresh fails — keep last known good data.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPositionFromAPI } from '../services/apiService'
import { readPosition } from '../services/contractService'

const REFRESH_INTERVAL = 30_000

export function usePosition() {
    const [position, setPosition] = useState({
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
        source: 'loading',
    })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const lastGoodData = useRef(null)

    const load = useCallback(async () => {
        try {
            // Try API first, falls back to on-chain inside fetchPositionFromAPI
            const data = await fetchPositionFromAPI()

            // Only update if we got real data (entryPrice > 0 means position exists)
            if (data && data.entryPrice > 0) {
                lastGoodData.current = data
                setPosition(data)
                setError(null)
            } else if (data && data.source) {
                // API returned but position not set yet — keep last good data if available
                if (lastGoodData.current) {
                    setPosition(lastGoodData.current)
                } else {
                    setPosition(data)
                }
                setError(null)
            }
        } catch (err) {
            // Last resort: direct on-chain read
            try {
                const data = await readPosition()
                if (data && data.entryPrice > 0) {
                    lastGoodData.current = { ...data, source: 'on-chain-fallback' }
                    setPosition(lastGoodData.current)
                    setError(null)
                } else if (lastGoodData.current) {
                    // Keep last known good data instead of zeroing out
                    setPosition(lastGoodData.current)
                    setError(null)
                }
            } catch (err2) {
                // Even on total failure, keep last good data
                if (lastGoodData.current) {
                    setPosition(lastGoodData.current)
                }
                setError(err2.message)
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Force update from external source (e.g., after creating a position)
    const forceUpdate = useCallback((newData) => {
        if (newData && newData.entryPrice > 0) {
            lastGoodData.current = { ...newData, source: 'local-update' }
            setPosition(lastGoodData.current)
            setIsLoading(false)
            setError(null)
        }
    }, [])

    useEffect(() => {
        load()
        const interval = setInterval(load, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [load])

    return { ...position, isLoading, error, refresh: load, forceUpdate }
}
