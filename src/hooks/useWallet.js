/**
 * useWallet — manages Pera Wallet connection state.
 * Handles connect, disconnect, address, and ALGO balance.
 */
import { useState, useCallback, useEffect } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'
import { fetchWalletBalance } from '../services/indexerService'

const peraWallet = new PeraWalletConnect({
    shouldShowSignTxnToast: true,
})

export function useWallet() {
    const [address, setAddress] = useState(null)
    const [balance, setBalance] = useState(0)
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isReconnecting, setIsReconnecting] = useState(true)  // true until initial reconnect resolves
    const [error, setError] = useState(null)

    // Reconnect existing session on mount
    useEffect(() => {
        peraWallet.reconnectSession().then(accounts => {
            if (accounts.length > 0) {
                const addr = accounts[0]
                setAddress(addr)
                setIsConnected(true)
                loadBalance(addr)
            }
        }).catch(() => {
            // No previous session — silent
        }).finally(() => {
            setIsReconnecting(false)
        })

        peraWallet.connector?.on('disconnect', () => {
            handleDisconnect()
        })
    }, [])

    async function loadBalance(addr) {
        const bal = await fetchWalletBalance(addr)
        setBalance(bal)
    }

    const connect = useCallback(async () => {
        setIsConnecting(true)
        setError(null)
        try {
            const accounts = await peraWallet.connect()
            const addr = accounts[0]
            setAddress(addr)
            setIsConnected(true)
            await loadBalance(addr)
        } catch (err) {
            if (!err.message?.includes('Modal closed')) {
                setError(err.message ?? 'Connection failed')
            }
        } finally {
            setIsConnecting(false)
        }
    }, [])

    const disconnect = useCallback(async () => {
        try {
            await peraWallet.disconnect()
        } catch (_) { /* silent */ }
        handleDisconnect()
    }, [])

    function handleDisconnect() {
        setAddress(null)
        setBalance(0)
        setIsConnected(false)
    }

    /**
     * Signs and submits a transaction via Pera Wallet.
     * @param {algosdk.Transaction} txn
     * @param {algosdk.Algodv2} algodClient
     * @returns {Promise<string>} Transaction ID
     */
    const signAndSubmit = useCallback(async (txn, algodClient) => {
        if (!address) throw new Error('Wallet not connected')

        try {
            // Pera expects [[{ txn: Transaction, signers: [addr] }]]
            const signedTxns = await peraWallet.signTransaction([
                [{ txn, signers: [address] }]
            ])

            if (!signedTxns || !signedTxns.length || !signedTxns[0]) {
                throw new Error('No signed transaction returned. Did you approve in Pera?')
            }

            // Submit
            const result = await algodClient.sendRawTransaction(signedTxns[0]).do()
            const txid = result.txId || result.txid || result

            // Wait for confirmation
            try {
                await algosdk.waitForConfirmation(algodClient, txid, 5)
            } catch (_) { /* tx may still succeed */ }

            return txid
        } catch (err) {
            if (err.message?.includes('cancelled') || err.message?.includes('rejected') || err.message?.includes('closed')) {
                throw new Error('Transaction rejected in Pera Wallet')
            }
            throw new Error(`Signing failed: ${err.message}`)
        }
    }, [address])

    const truncateAddress = (addr) => {
        if (!addr) return ''
        return `${addr.slice(0, 4)}...${addr.slice(-4)}`
    }

    return {
        address,
        balance,
        isConnected,
        isConnecting,
        isReconnecting,
        error,
        connect,
        disconnect,
        signAndSubmit,
        truncateAddress,
        peraWallet,
    }
}
