/**
 * API Service — connects the frontend to the AEGIS FastAPI backend.
 * Falls back to direct on-chain reads if backend is unavailable.
 */
import axios from 'axios'
import { readPosition } from './contractService'
import { fetchAppTransactions, parseRebalanceHistory } from './indexerService'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const api = axios.create({ baseURL: API_BASE, timeout: 8000 })

let backendAvailable = null // null = unknown, true/false = tested

/**
 * Check if backend is up. Caches result for 60 seconds.
 */
let lastHealthCheck = 0
async function checkBackend() {
    const now = Date.now()
    if (backendAvailable !== null && now - lastHealthCheck < 60000) return backendAvailable
    try {
        await api.get('/api/health')
        backendAvailable = true
    } catch {
        backendAvailable = false
    }
    lastHealthCheck = now
    return backendAvailable
}

/**
 * Fetch position data — tries backend first, falls back to direct on-chain read.
 */
export async function fetchPositionFromAPI() {
    try {
        if (await checkBackend()) {
            const { data } = await api.get('/api/position')
            return {
                entryPrice: data.entry_price,
                lowerBound: data.lower_bound,
                upperBound: data.upper_bound,
                capitalUsdc: data.capital_usdc,
                openTimestamp: data.open_timestamp,
                totalRebalances: data.total_rebalances,
                lastRebalanceTimestamp: data.last_rebalance_timestamp,
                depositedAlgo: data.deposited_algo,
                depositedUsdc: data.deposited_usdc,
                totalDeposits: data.total_deposits,
                totalWithdrawals: data.total_withdrawals,
                agentAuthorized: data.agent_authorized,
                totalDecisions: data.total_decisions,
                lastDecisionTimestamp: data.last_decision_timestamp,
                lastDecisionAction: data.last_decision_action,
                appId: data.app_id,
                source: 'backend',
            }
        }
    } catch (err) {
        console.warn('[apiService] Backend fetch failed, falling back to on-chain:', err.message)
    }

    // Fallback to direct on-chain read
    const pos = await readPosition()
    return { ...pos, source: 'on-chain' }
}

/**
 * Fetch rebalance history — tries backend first, falls back to Indexer.
 */
export async function fetchRebalanceHistoryFromAPI() {
    try {
        if (await checkBackend()) {
            const { data } = await api.get('/api/rebalance-history')
            return data.map(e => ({
                txId: e.tx_id,
                timestamp: e.timestamp,
                roundTime: e.round_time,
                fee: e.fee,
                newLower: e.new_lower,
                newUpper: e.new_upper,
            }))
        }
    } catch (err) {
        console.warn('[apiService] Rebalance history fetch failed:', err.message)
    }

    // Fallback
    const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633
    const txns = await fetchAppTransactions(APP_ID)
    return parseRebalanceHistory(txns)
}

/**
 * Fetch decision log from backend.
 */
export async function fetchDecisionLogFromAPI() {
    try {
        if (await checkBackend()) {
            const { data } = await api.get('/api/decision-log')
            return data.map(e => ({
                timestamp: e.timestamp,
                action: e.action,
                price: e.price,
                reason: e.reason,
                result: e.result,
                txId: e.tx_id,
            }))
        }
    } catch (err) {
        console.warn('[apiService] Decision log fetch failed:', err.message)
    }
    return null // null = use local generation
}

/**
 * Trigger a manual rebalance via backend.
 */
export async function triggerRebalanceViaAPI(newLower, newUpper, reason = 'Manual override') {
    try {
        const { data } = await api.post('/api/trigger-rebalance', {
            new_lower: newLower,
            new_upper: newUpper,
            reason,
        })
        return data
    } catch (err) {
        console.warn('[apiService] Trigger rebalance failed:', err.message)
        throw err
    }
}

/**
 * Fetch backend health status.
 */
export async function fetchHealthStatus() {
    try {
        const { data } = await api.get('/api/health')
        return data
    } catch {
        return { status: 'offline', app_id: 0 }
    }
}
