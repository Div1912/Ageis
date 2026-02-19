/**
 * useDerivedStats — computes all dashboard statistics from position + live price.
 * Values are stable (rounded to nearest hour) to prevent flickering.
 * Fee/IL figures are PROJECTIONS based on position parameters, not live pool data.
 * 
 * FIX: Uses computeNetPnL from pnlCalculator for consistency.
 */
import { useMemo } from 'react'
import {
    computePositionValue,
    computeHODLValue,
    computeNetPnL,
    computeFeesEarned,
    computeILDollar,
    computeIL,
} from '../services/pnlCalculator'

const AVG_SWAP_COST_USD = 4.20

export function useDerivedStats({ position, currentPrice }) {
    return useMemo(() => {
        const {
            entryPrice = 0,
            capitalUsdc = 0,
            openTimestamp = 0,
            totalRebalances = 0,
            lowerBound = 0,
            upperBound = 0,
        } = position

        const price = currentPrice || entryPrice || 0

        // Days elapsed — rounded to nearest HOUR to prevent sub-second flickering
        const nowSec = Math.floor(Date.now() / 1000)
        const elapsedSec = openTimestamp > 0 ? nowSec - openTimestamp : 0
        const elapsedHours = Math.floor(elapsedSec / 3600)
        const elapsedDays = Math.max(elapsedHours / 24, 0.01)

        const positionValue = computePositionValue(capitalUsdc, entryPrice, price)
        const hodlValue = computeHODLValue(capitalUsdc, entryPrice, price)
        const feesEarned = computeFeesEarned(capitalUsdc, 0.35, elapsedDays)
        const swapLosses = totalRebalances * AVG_SWAP_COST_USD
        const ilDollar = computeILDollar(capitalUsdc, entryPrice, price)
        const ilFraction = computeIL(entryPrice, price)

        // Net P&L accounts for all costs — use the canonical formula
        const netPnL = computeNetPnL(capitalUsdc, entryPrice, price, swapLosses)

        // Range status
        const inRange = price >= lowerBound && price <= upperBound

        // Daily fee estimate
        const dailyFee = computeFeesEarned(capitalUsdc, 0.35, 1)

        // Decision engine net rebalance value (7-day outlook)
        const netRebalanceValue = dailyFee * 7 - AVG_SWAP_COST_USD

        // Recommendation
        const shouldRebalance = !inRange || netRebalanceValue > 0

        // Position trend vs entry (simple price appreciation measure)
        const trendPct = entryPrice > 0 ? (price - entryPrice) / entryPrice : 0

        return {
            positionValue,
            hodlValue,
            netPnL,
            feesEarned,
            swapLosses,
            ilDollar,
            ilFraction,
            inRange,
            dailyFee,
            netRebalanceValue,
            shouldRebalance,
            elapsedDays,
            trendPct,
            avgSwapCost: AVG_SWAP_COST_USD,
        }
    }, [position, currentPrice])
}
