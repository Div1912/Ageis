/**
 * WithdrawModal — allows users to withdraw funds from the vault.
 * Only the creator can withdraw — agent CANNOT call this.
 * Calls withdraw() on the AEGIS smart contract via Pera wallet.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const APP_ID = parseInt(import.meta.env.VITE_APP_ID || '755777633')

export default function WithdrawModal({ isOpen, onClose, wallet, position, onSuccess }) {
    const [algoAmount, setAlgoAmount] = useState('')
    const [usdcAmount, setUsdcAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const maxAlgo = position?.depositedAlgo || 0
    const maxUsdc = position?.depositedUsdc || 0

    const handleSubmit = async () => {
        setError('')
        const algo = parseFloat(algoAmount) || 0
        const usdc = parseFloat(usdcAmount) || 0

        if (algo <= 0 && usdc <= 0) {
            setError('Enter at least one amount to withdraw')
            return
        }
        if (algo > maxAlgo) {
            setError(`Max ALGO: ${maxAlgo.toFixed(4)}`)
            return
        }
        if (usdc > maxUsdc) {
            setError(`Max USDC: ${maxUsdc.toFixed(2)}`)
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

            const contract = new algosdk.ABIContract({
                name: 'AegisPosition',
                methods: [{
                    name: 'withdraw',
                    args: [{ type: 'uint64', name: 'algo_amount' }, { type: 'uint64', name: 'usdc_amount' }],
                    returns: { type: 'void' },
                }],
            })

            const atc = new algosdk.AtomicTransactionComposer()
            atc.addMethodCall({
                appID: APP_ID,
                method: contract.getMethodByName('withdraw'),
                methodArgs: [
                    Math.round(algo * 1e6),
                    Math.round(usdc * 1e6),
                ],
                sender: wallet.address,
                suggestedParams,
                signer: algosdk.makeEmptyTransactionSigner(),
            })

            const txGroup = atc.buildGroup().map(t => t.txn)
            const txn = txGroup[0]

            const txId = await wallet.signAndSubmit(txn, client)
            onSuccess?.({ txId, algo, usdc })
            onClose()
        } catch (e) {
            console.error('Withdraw failed:', e)
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
                            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Withdraw Funds</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Remove capital from your vault</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                        }}>✕</button>
                    </div>

                    {/* Current vault state */}
                    <div style={{
                        padding: '10px 14px', background: 'rgba(239,68,68,0.04)',
                        border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Available ALGO</span>
                            <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-primary)' }}>
                                {maxAlgo.toFixed(4)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Available USDC</span>
                            <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-primary)' }}>
                                {maxUsdc.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* ALGO amount */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ALGO AMOUNT</label>
                            <button onClick={() => setAlgoAmount(String(maxAlgo))} style={{
                                padding: '2px 8px', fontSize: 9, fontWeight: 700,
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 3, color: '#EF4444', cursor: 'pointer',
                            }}>MAX</button>
                        </div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>USDC AMOUNT</label>
                            <button onClick={() => setUsdcAmount(String(maxUsdc))} style={{
                                padding: '2px 8px', fontSize: 9, fontWeight: 700,
                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 3, color: '#EF4444', cursor: 'pointer',
                            }}>MAX</button>
                        </div>
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
                            background: 'linear-gradient(135deg, #EF4444, #F97316)',
                            color: '#fff', transition: 'all 0.2s',
                        }}
                    >
                        {submitting ? 'Withdrawing...' : '↑ Withdraw'}
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
