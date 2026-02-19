/**
 * AddLiquidityModal — add more capital to the current active position.
 * Calls set_position with same range but increased capital.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { setPosition } from '../services/contractService'
import { addLiquidityToActive } from '../services/positionStore'

const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633

export default function AddLiquidityModal({ isOpen, onClose, wallet, position, onSuccess }) {
    const [amount, setAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    async function handleAdd() {
        const addAmount = parseFloat(amount)
        if (!addAmount || addAmount <= 0) { setError('Enter an amount'); return }
        if (!wallet?.address) { setError('Connect wallet first'); return }

        setSubmitting(true)
        setError(null)
        try {
            const newCapital = (position?.capitalUsdc || 0) + addAmount
            // Call set_position with same entry/range but new total capital
            const txn = await setPosition(
                APP_ID,
                position.entryPrice,
                position.lowerBound,
                position.upperBound,
                newCapital,
                wallet.address,
            )

            const algosdk = (await import('algosdk')).default
            const client = new algosdk.Algodv2('', import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud', '')
            const txId = await wallet.signAndSubmit(txn, client)

            // Update localStorage
            addLiquidityToActive(addAmount)
            onSuccess?.({ txId, addedAmount: addAmount, newCapital })
            onClose()
        } catch (e) {
            setError(e.message || 'Transaction failed')
        }
        setSubmitting(false)
    }

    if (!isOpen) return null

    const currentCap = position?.capitalUsdc || 0
    const addAmount = parseFloat(amount) || 0
    const newTotal = currentCap + addAmount

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
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>Add Liquidity</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Increase capital in your active position</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                        }}>✕</button>
                    </div>

                    {/* Current position info */}
                    <div style={{
                        background: 'var(--bg-surface, rgba(0,0,0,0.2))', borderRadius: 8,
                        padding: '12px 16px', marginBottom: 20, fontSize: 12,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Range</span>
                            <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>
                                ${position?.lowerBound?.toFixed(4)} — ${position?.upperBound?.toFixed(4)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Current Capital</span>
                            <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>
                                ${currentCap.toFixed(2)} USDC
                            </span>
                        </div>
                    </div>

                    {/* Amount input */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            AMOUNT TO ADD (USDC)
                        </label>
                        <input
                            type="number" step="100" value={amount}
                            onChange={e => setAmount(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 16, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                            placeholder="1000"
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {[500, 1000, 2500, 5000].map(v => (
                                <button key={v} onClick={() => setAmount(String(v))} style={{
                                    padding: '4px 10px', fontSize: 10, fontWeight: 600,
                                    background: amount === String(v) ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${amount === String(v) ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                                    borderRadius: 4, color: amount === String(v) ? '#10B981' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                }}>+${v.toLocaleString()}</button>
                            ))}
                        </div>
                    </div>

                    {/* New total */}
                    <div style={{
                        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                        borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 12,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Current</span>
                            <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>${currentCap.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: '#10B981' }}>+ Adding</span>
                            <span style={{ fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>+${addAmount.toFixed(2)}</span>
                        </div>
                        <div style={{
                            borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: 6, marginTop: 4,
                            display: 'flex', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontWeight: 700 }}>New Total</span>
                            <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#10B981', fontSize: 14 }}>
                                ${newTotal.toFixed(2)} USDC
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '8px 12px', marginBottom: 16, borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#EF4444', fontSize: 12,
                        }}>{error}</div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                        }}>Cancel</button>
                        <motion.button
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                            disabled={submitting || !wallet?.address || !addAmount}
                            onClick={handleAdd}
                            style={{
                                flex: 1, padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                                background: wallet?.address && addAmount
                                    ? 'linear-gradient(135deg, #10B981, #059669)'
                                    : 'rgba(255,255,255,0.08)',
                                border: 'none', cursor: addAmount ? 'pointer' : 'not-allowed',
                                color: wallet?.address && addAmount ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {submitting ? 'Adding...' : 'Add Liquidity'}
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
