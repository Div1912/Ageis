/**
 * Smart contract interaction service.
 * Reads AEGIS position data from global state and builds transactions.
 *
 * Global state keys (ABI-encoded):
 *   entry_price, lower_bound, upper_bound, capital_usdc,
 *   open_timestamp, total_rebalances, last_rebalance_timestamp
 */
import algosdk from 'algosdk'
import { algodClient } from './algorandClient'

const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633

/**
 * Decodes a base64-encoded global state value to uint64.
 * @param {string} b64 - Base64 string from indexer/algod response
 * @returns {number}
 */
function decodeUint64(b64) {
    try {
        const bytes = atob(b64)
        let value = 0
        for (let i = 0; i < bytes.length; i++) {
            value = value * 256 + bytes.charCodeAt(i)
        }
        return value
    } catch {
        return 0
    }
}

/**
 * Reads position data from smart contract global state.
 * @param {number} [appId=APP_ID]
 * @returns {Promise<{
 *   entryPrice: number,
 *   lowerBound: number,
 *   upperBound: number,
 *   capitalUsdc: number,
 *   openTimestamp: number,
 *   totalRebalances: number,
 *   lastRebalanceTimestamp: number
 * }>}
 */
export async function readPosition(appId = APP_ID) {
    try {
        const appInfo = await algodClient.getApplicationByID(appId).do()
        const globalState = appInfo['params']?.['global-state'] ?? []

        const state = {}
        for (const kv of globalState) {
            const key = atob(kv.key)
            const value = kv.value
            state[key] = value.type === 1
                ? atob(value.bytes ?? '')
                : (value.uint ?? 0)
        }

        return {
            entryPrice: (state['entry_price'] ?? 0) / 1000,
            lowerBound: (state['lower_bound'] ?? 0) / 1000,
            upperBound: (state['upper_bound'] ?? 0) / 1000,
            capitalUsdc: (state['capital_usdc'] ?? 0) / 100,
            openTimestamp: state['open_timestamp'] ?? 0,
            totalRebalances: state['total_rebalances'] ?? 0,
            lastRebalanceTimestamp: state['last_rebalance_timestamp'] ?? 0,
        }
    } catch (err) {
        console.warn('[contractService] readPosition failed:', err.message)
        return {
            entryPrice: 0,
            lowerBound: 0,
            upperBound: 0,
            capitalUsdc: 0,
            openTimestamp: 0,
            totalRebalances: 0,
            lastRebalanceTimestamp: 0,
        }
    }
}

/**
 * Builds an unsigned set_position application call transaction.
 * @param {number} appId
 * @param {number} entryPrice  - in USDC (will be scaled x1000)
 * @param {number} lowerBound  - in USDC (will be scaled x1000)
 * @param {number} upperBound  - in USDC (will be scaled x1000)
 * @param {number} capitalUsdc - in USD (will be stored in cents)
 * @param {string} senderAddress
 * @returns {Promise<algosdk.Transaction>}
 */
export async function setPosition(appId, entryPrice, lowerBound, upperBound, capitalUsdc, senderAddress) {
    const suggestedParams = await algodClient.getTransactionParams().do()

    const methodABI = algosdk.ABIMethod.fromSignature('set_position(uint64,uint64,uint64,uint64)void')
    const atc = new algosdk.AtomicTransactionComposer()

    atc.addMethodCall({
        appID: appId,
        method: methodABI,
        methodArgs: [
            BigInt(Math.round(entryPrice * 1000)),
            BigInt(Math.round(lowerBound * 1000)),
            BigInt(Math.round(upperBound * 1000)),
            BigInt(Math.round(capitalUsdc * 100)),
        ],
        sender: senderAddress,
        suggestedParams,
        signer: algosdk.makeEmptyTransactionSigner(),
    })

    const txns = atc.buildGroup()
    return txns[0].txn
}

/**
 * Builds an unsigned trigger_rebalance application call transaction.
 * @param {number} appId
 * @param {number} newLower  - in USDC (will be scaled x1000)
 * @param {number} newUpper  - in USDC (will be scaled x1000)
 * @param {string} senderAddress
 * @returns {Promise<algosdk.Transaction>}
 */
export async function triggerRebalance(appId, newLower, newUpper, senderAddress) {
    const suggestedParams = await algodClient.getTransactionParams().do()

    const methodABI = algosdk.ABIMethod.fromSignature('trigger_rebalance(uint64,uint64)void')
    const atc = new algosdk.AtomicTransactionComposer()

    atc.addMethodCall({
        appID: appId,
        method: methodABI,
        methodArgs: [
            BigInt(Math.round(newLower * 1000)),
            BigInt(Math.round(newUpper * 1000)),
        ],
        sender: senderAddress,
        suggestedParams,
        signer: algosdk.makeEmptyTransactionSigner(),
    })

    const txns = atc.buildGroup()
    return txns[0].txn
}
