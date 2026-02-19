/**
 * RemoveLiquidityModal — confirms and executes position closure.
 * Zeroes out the on-chain position via set_position(0,0,0,0) and saves to localStorage.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { setPosition } from '../services/contractService'
import { closeActivePosition } from '../services/positionStore'

const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633

export default function RemoveLiquidityModal({ isOpen, onClose, wallet, position, onSuccess }) {
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [confirmed, setConfirmed] = useState(false)

    async function handleRemove() {
        if (!wallet?.address) { setError('Connect wallet first'); return }
        setSubmitting(true)
        setError(null)
        try {
            // Zero out on-chain position
            const txn = await setPosition(APP_ID, 0, 0, 0, 0, wallet.address)
            const algosdk = (await import('algosdk')).default
            const client = new algosdk.Algodv2('', import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud', '')
            const txId = await wallet.signAndSubmit(txn, client)

            // Mark as closed in localStorage
            closeActivePosition()
            onSuccess?.({ txId })
            onClose()
        } catch (e) {
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
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#EF4444' }}>Remove Liquidity</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Close position & withdraw funds</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                        }}>✕</button>
                    </div>

                    {/* Position summary */}
                    <div style={{
                        background: 'var(--bg-surface, rgba(0,0,0,0.2))', borderRadius: 8,
                        padding: '14px 16px', marginBottom: 20, fontSize: 12,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Entry Price</span>
                            <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>${position?.entryPrice?.toFixed(4)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Range</span>
                            <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>${position?.lowerBound?.toFixed(4)} — ${position?.upperBound?.toFixed(4)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Capital</span>
                            <span style={{ fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>${position?.capitalUsdc?.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Rebalances</span>
                            <span style={{ fontWeight: 600 }}>{position?.totalRebalances || 0}</span>
                        </div>
                    </div>

                    {/* Warning */}
                    <div style={{
                        padding: '10px 14px', marginBottom: 20, borderRadius: 8,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        fontSize: 12, color: '#EF4444', lineHeight: 1.5,
                    }}>
                        ⚠️ This will zero out your on-chain position. ALGO and USDC in the pool will need to be withdrawn separately via Pact CLMM.
                    </div>

                    {/* Confirmation checkbox */}
                    <label style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                        cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
                    }}>
                        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ accentColor: '#EF4444' }} />
                        I understand this will close my position on-chain
                    </label>

                    {error && (
                        <div style={{
                            padding: '8px 12px', marginBottom: 16, borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#EF4444', fontSize: 12,
                        }}>{error}</div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                        }}>Cancel</button>
                        <motion.button
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                            disabled={!confirmed || submitting || !wallet?.address}
                            onClick={handleRemove}
                            style={{
                                flex: 1, padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                                background: confirmed && wallet?.address
                                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                    : 'rgba(255,255,255,0.08)',
                                border: 'none', cursor: confirmed ? 'pointer' : 'not-allowed',
                                color: confirmed ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {submitting ? 'Removing...' : 'Remove Liquidity'}
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
