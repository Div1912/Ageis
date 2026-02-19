/**
 * Algorand Indexer service.
 * Fetches wallet balances and app transaction history from Testnet indexer.
 */
import { indexerClient } from './algorandClient'

/**
 * Fetches ALGO balance for a given wallet address.
 * @param {string} address - Algorand wallet address
 * @returns {Promise<number>} Balance in ALGO (not microAlgo)
 */
export async function fetchWalletBalance(address) {
    try {
        const info = await indexerClient.lookupAccountByID(address).do()
        const microAlgos = info['account']?.amount ?? 0
        return microAlgos / 1e6
    } catch (err) {
        console.warn('[indexerService] Balance fetch failed:', err.message)
        return 0
    }
}

/**
 * Fetches all transactions for a given App ID.
 * @param {number|string} appId - Algorand application ID
 * @returns {Promise<Array>} List of transactions
 */
export async function fetchAppTransactions(appId) {
    try {
        const result = await indexerClient
            .searchForTransactions()
            .applicationID(Number(appId))
            .limit(50)
            .do()
        return result.transactions ?? []
    } catch (err) {
        console.warn('[indexerService] App tx fetch failed:', err.message)
        return []
    }
}

/**
 * Parses raw indexer transactions to extract rebalance events.
 * Looks for ApplicationCall transactions with 'trigger_rebalance' in the args.
 * @param {Array} transactions - Raw transaction array from indexer
 * @returns {Array<{txId: string, timestamp: number, roundTime: number}>}
 */
export function parseRebalanceHistory(transactions) {
    return transactions
        .filter(tx => {
            if (tx['tx-type'] !== 'appl') return false
            const args = tx['application-transaction']?.['application-args'] ?? []
            if (args.length === 0) return false
            // ABI method selector for trigger_rebalance(uint64,uint64)void
            // Base64 of first 4 bytes of SHA-512/256("trigger_rebalance(uint64,uint64)void")
            const TRIGGER_SELECTOR = 'DhG20w=='
            return args[0] === TRIGGER_SELECTOR
        })
        .map(tx => ({
            txId: tx.id,
            timestamp: tx['round-time'] ?? 0,
            roundTime: tx['round-time'] ?? 0,
            fee: (tx.fee ?? 0) / 1e6,
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
}
