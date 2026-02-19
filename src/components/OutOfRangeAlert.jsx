/**
 * OutOfRangeAlert — dashboard banner when price exits LP range.
 * Shows distance to boundary, time since exit, fee loss estimate, and rebalance CTA.
 */
import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function OutOfRangeAlert({ inRange, currentPrice, lowerBound, upperBound, capitalUsdc, onRebalanceClick }) {
    const [dismissed, setDismissed] = useState(false)

    const info = useMemo(() => {
        if (inRange || !currentPrice || !lowerBound || !upperBound) return null
        const side = currentPrice < lowerBound ? 'below' : 'above'
        const boundary = side === 'below' ? lowerBound : upperBound
        const distancePct = ((Math.abs(currentPrice - boundary) / boundary) * 100).toFixed(1)
        const dailyFeeLoss = (capitalUsdc || 5000) * 0.003 // ~0.3% daily fee that's being missed
        const suggestedLower = (currentPrice * 0.82).toFixed(4)
        const suggestedUpper = (currentPrice * 1.22).toFixed(4)
        return { side, distancePct, dailyFeeLoss, suggestedLower, suggestedUpper }
    }, [inRange, currentPrice, lowerBound, upperBound, capitalUsdc])

    if (inRange || dismissed || !info) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -12, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(239,68,68,0.04) 100%)',
                    borderBottom: '1px solid rgba(245,158,11,0.2)',
                    padding: '14px 32px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    {/* Left: Warning info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 300 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'rgba(245,158,11,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, flexShrink: 0,
                        }}>
                            ⚠
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
                                    Position Out of Range
                                </span>
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: '2px 6px',
                                    borderRadius: 3, background: 'rgba(239,68,68,0.1)',
                                    color: '#EF4444', letterSpacing: '0.05em',
                                }}>
                                    FEES PAUSED
                                </span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                Price is <strong style={{ color: '#F59E0B' }}>{info.distancePct}%</strong> {info.side} your {info.side === 'below' ? 'lower' : 'upper'} bound — losing ~<strong style={{ color: '#EF4444' }}>${info.dailyFeeLoss.toFixed(2)}/day</strong> in fees.
                            </span>
                        </div>
                    </div>

                    {/* Center: Price info */}
                    <div style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                        color: 'var(--text-muted)', padding: '6px 12px',
                        border: '1px solid rgba(245,158,11,0.15)', borderRadius: 5,
                        background: 'rgba(245,158,11,0.03)',
                        whiteSpace: 'nowrap',
                    }}>
                        <span style={{ color: '#F59E0B' }}>${currentPrice.toFixed(4)}</span>
                        <span style={{ margin: '0 6px', opacity: 0.4 }}>|</span>
                        <span>range ${lowerBound.toFixed(4)}–${upperBound.toFixed(4)}</span>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {onRebalanceClick && (
                            <button
                                onClick={onRebalanceClick}
                                style={{
                                    padding: '6px 14px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                                    background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(245,158,11,0.2)'
                                    e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(245,158,11,0.12)'
                                    e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'
                                }}
                            >
                                ⟳ Rebalance Now
                            </button>
                        )}
                        <button
                            onClick={() => setDismissed(true)}
                            style={{
                                background: 'none', border: 'none',
                                color: 'var(--text-muted)', cursor: 'pointer',
                                fontSize: 16, lineHeight: 1, padding: '4px',
                                opacity: 0.6, transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                        >×</button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
