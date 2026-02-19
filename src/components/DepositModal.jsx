/**
 * DepositModal — allows any user to deposit additional funds into the vault.
 * Calls deposit() on the AEGIS smart contract via Pera wallet.
 * Contract deposit() is PUBLIC — no creator restriction.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { updatePosition } from '../services/supabaseService'

// Always use the latest deployed contract — 755790984 has public deposit()
const APP_ID = parseInt(import.meta.env.VITE_APP_ID || '755790984')

export default function DepositModal({ isOpen, onClose, wallet, position, onSuccess }) {
    const [algoAmount, setAlgoAmount] = useState('')
    const [usdcAmount, setUsdcAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async () => {
        setError('')
        const algo = parseFloat(algoAmount) || 0
        const usdc = parseFloat(usdcAmount) || 0

        if (algo <= 0 && usdc <= 0) {
            setError('Enter at least one amount to deposit')
            return
        }
        if (!wallet?.address) {
            setError('Connect your wallet first')
            return
        }

        setSubmitting(true)
        try {
            const algosdk = (await import('algosdk')).default
            const client = new algosdk.Algodv2('', import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud', '')
            const suggestedParams = await client.getTransactionParams().do()

            // Build ABI method call for deposit(uint64,uint64)void
            const contract = new algosdk.ABIContract({
                name: 'AegisPosition',
                methods: [{
                    name: 'deposit',
                    args: [{ type: 'uint64', name: 'algo_amount' }, { type: 'uint64', name: 'usdc_amount' }],
                    returns: { type: 'void' },
                }],
            })

            // Build the ABI encoded app call transaction directly
            const method = contract.getMethodByName('deposit')
            const methodSelector = method.getSelector()
            const algoArg = algosdk.encodeUint64(Math.round(algo * 1e6))
            const usdcArg = algosdk.encodeUint64(Math.round(usdc * 1e6))

            const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
                from: wallet.address,
                appIndex: APP_ID,
                onComplete: algosdk.OnApplicationComplete.NoOpOC,
                appArgs: [methodSelector, algoArg, usdcArg],
                suggestedParams,
            })

            // Sign and broadcast via Pera wallet
            const txId = await wallet.signAndSubmit(appCallTxn, client)

            // Update Supabase record if position has an ID
            if (position?._positionId) {
                await updatePosition(position._positionId, {
                    deposited_algo: (position.depositedAlgo || 0) + algo,
                    deposited_usdc: (position.depositedUsdc || 0) + usdc,
                }).catch(() => { })
            }

            onSuccess?.({ txId, algo, usdc })
            onClose()
        } catch (e) {
            console.error('Deposit failed:', e)
            setError(e.message || 'Transaction failed')
        }
        setSubmitting(false)
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 16, width: 440, padding: 32,
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Deposit Funds</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add capital to your vault</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                        }}>✕</button>
                    </div>

                    {/* Current vault state */}
                    <div style={{
                        padding: '10px 14px', background: 'rgba(0,200,150,0.06)',
                        border: '1px solid rgba(0,200,150,0.15)', borderRadius: 8, marginBottom: 20,
                        display: 'flex', justifyContent: 'space-between', fontSize: 12,
                    }}>
                        <span style={{ color: 'var(--text-muted)' }}>Current Vault</span>
                        <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-primary)' }}>
                            {position?.depositedAlgo?.toFixed(4) || '0'} ALGO · {position?.depositedUsdc?.toFixed(2) || '0'} USDC
                        </span>
                    </div>

                    {/* ALGO amount */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            ALGO AMOUNT
                        </label>
                        <input
                            type="number" step="0.01" value={algoAmount}
                            onChange={e => setAlgoAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                        />
                    </div>

                    {/* USDC amount */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            USDC AMOUNT
                        </label>
                        <input
                            type="number" step="0.01" value={usdcAmount}
                            onChange={e => setUsdcAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '8px 12px', marginBottom: 16, borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#EF4444', fontSize: 12,
                        }}>{error}</div>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                        disabled={submitting || !wallet?.address}
                        onClick={handleSubmit}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                            border: 'none', cursor: submitting ? 'wait' : 'pointer',
                            background: 'linear-gradient(135deg, #10B981, #00C896)',
                            color: '#000', transition: 'all 0.2s',
                        }}
                    >
                        {submitting ? 'Depositing...' : '↓ Deposit'}
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
