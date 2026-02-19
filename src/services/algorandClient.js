/**
 * Algorand client initialization for Testnet.
 * Exports algodClient and indexerClient for use across the app.
 */
import algosdk from 'algosdk'

const ALGO_NODE = import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud'
const INDEXER_URL = import.meta.env.VITE_INDEXER || 'https://testnet-idx.algonode.cloud'

/** Algod client connected to Testnet */
export const algodClient = new algosdk.Algodv2('', ALGO_NODE, '')

/** Indexer client connected to Testnet */
export const indexerClient = new algosdk.Indexer('', INDEXER_URL, '')
