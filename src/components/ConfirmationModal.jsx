/**
 * ConfirmationModal — full transaction preview before submitting rebalance.
 * Shows current range → new range, fee projections, cost breakdown, network info.
 */
import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatUSD, computeFeesEarned } from '../services/pnlCalculator'

const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633

export default function ConfirmationModal({
    open, onConfirm, onCancel, isSubmitting, txId, error,
    currentPrice, lowerBound, upperBound, avgSwapCost, capitalUsdc,
}) {
    if (!open) return null

    const preview = useMemo(() => {
        const newLower = parseFloat((currentPrice * 0.82).toFixed(4))
        const newUpper = parseFloat((currentPrice * 1.22).toFixed(4))
        const cap = capitalUsdc || 5000
        const dailyFees = cap * 0.003
        const weeklyFees = dailyFees * 7
        const swapCost = avgSwapCost || 4.20
        const netBenefit = weeklyFees - swapCost
        const rangeWidth = ((newUpper - newLower) / currentPrice * 100).toFixed(0)
        return { newLower, newUpper, dailyFees, weeklyFees, swapCost, netBenefit, rangeWidth }
    }, [currentPrice, capitalUsdc, avgSwapCost])

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(8,11,15,0.85)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                }}
                onClick={onCancel}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="card"
                    style={{ width: '100%', maxWidth: 460, padding: 28 }}
                    onClick={e => e.stopPropagation()}
                >
                    {txId ? (
                        /* ── Success State ── */
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: 'rgba(16,185,129,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 24, margin: '0 auto 16px',
                            }}>
                                ✓
                            </div>
                            <h3 style={{ color: 'var(--accent-positive)', fontWeight: 700, marginBottom: 4 }}>
                                Rebalance Submitted
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                Transaction confirmed on Algorand Testnet
                            </p>

                            <div style={{
                                background: 'var(--bg-surface)', borderRadius: 6,
                                padding: '12px 14px', marginBottom: 16, textAlign: 'left',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>TX ID</span>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent-primary)', wordBreak: 'break-all' }}>
                                        {txId.length > 20 ? `${txId.slice(0, 12)}…${txId.slice(-8)}` : txId}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>New Range</span>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-primary)' }}>
                                        ${preview.newLower.toFixed(4)} → ${preview.newUpper.toFixed(4)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Network</span>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-primary)' }}>
                                        Algorand Testnet
                                    </span>
                                </div>
                            </div>

                            <a
                                href={`https://lora.algokit.io/testnet/transaction/${txId}`}
                                target="_blank" rel="noreferrer"
                                className="btn-primary"
                                style={{ width: '100%', justifyContent: 'center', display: 'flex', marginBottom: 8 }}
                            >
                                View on Explorer →
                            </a>
                            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onCancel}>
                                Close
                            </button>
                        </div>
                    ) : (
                        /* ── Transaction Preview ── */
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 6,
                                    background: 'rgba(0,200,150,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14,
                                }}>
                                    ⟳
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Confirm Rebalance</h3>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                                This will call <code style={{ color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>trigger_rebalance()</code> on App ID <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{APP_ID}</code>
                            </p>

                            {/* Range comparison */}
                            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '16px', marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                                    Range Update
                                </div>

                                {/* Current → New */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Current</div>
                                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text-secondary)' }}>
                                            ${lowerBound?.toFixed(4)} → ${upperBound?.toFixed(4)}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>→</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginBottom: 3 }}>New</div>
                                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)' }}>
                                            ${preview.newLower.toFixed(4)} → ${preview.newUpper.toFixed(4)}
                                        </div>
                                    </div>
                                </div>

                                {/* Centered on current price */}
                                <div style={{
                                    fontSize: 10, color: 'var(--text-muted)', padding: '6px 10px',
                                    background: 'rgba(0,200,150,0.04)', borderRadius: 4,
                                    border: '1px solid rgba(0,200,150,0.08)',
                                }}>
                                    Centered on current price <strong style={{ color: 'var(--text-primary)' }}>${currentPrice?.toFixed(4)}</strong> · ±{preview.rangeWidth}% width
                                </div>
                            </div>

                            {/* Fee projection */}
                            <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                                    Fee Projection
                                </div>
                                {[
                                    { l: 'Daily fee capture', v: `+${formatUSD(preview.dailyFees)}`, c: 'var(--accent-positive)' },
                                    { l: 'Weekly fee capture', v: `+${formatUSD(preview.weeklyFees)}`, c: 'var(--accent-positive)' },
                                    { l: 'Rebalance cost', v: `-${formatUSD(preview.swapCost)}`, c: 'var(--accent-negative)' },
                                    { l: 'Net benefit (7d)', v: preview.netBenefit >= 0 ? `+${formatUSD(preview.netBenefit)}` : formatUSD(preview.netBenefit), c: preview.netBenefit >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)' },
                                ].map(({ l, v, c }) => (
                                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</span>
                                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: c, fontWeight: 600 }}>{v}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Network info */}
                            <div style={{
                                display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center',
                            }}>
                                {[
                                    { l: 'Network', v: 'Testnet' },
                                    { l: 'Method', v: 'trigger_rebalance' },
                                    { l: 'Signer', v: 'Pera Wallet' },
                                ].map(({ l, v }) => (
                                    <span key={l} style={{
                                        fontSize: 10, padding: '3px 8px', borderRadius: 4,
                                        background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }}>
                                        {l}: {v}
                                    </span>
                                ))}
                            </div>

                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5, textAlign: 'center' }}>
                                Pera Wallet will prompt you to sign this transaction.
                            </p>

                            {/* Error display */}
                            {error && (
                                <div style={{
                                    background: 'rgba(248,113,113,0.1)',
                                    border: '1px solid rgba(248,113,113,0.3)',
                                    borderRadius: 8, padding: '12px 14px', marginBottom: 12,
                                    color: '#f87171', fontSize: 12, lineHeight: 1.5,
                                }}>
                                    <strong>Error:</strong> {error}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn-secondary"
                                    style={{ flex: 1, justifyContent: 'center' }}
                                    onClick={onCancel}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <motion.button
                                    className="btn-primary"
                                    style={{ flex: 2, justifyContent: 'center' }}
                                    onClick={() => onConfirm(preview.newLower, preview.newUpper)}
                                    disabled={isSubmitting}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="spin-arc" style={{ width: 14, height: 14 }} />
                                            {' '}Signing…
                                        </>
                                    ) : '⟳ Confirm & Sign'}
                                </motion.button>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
