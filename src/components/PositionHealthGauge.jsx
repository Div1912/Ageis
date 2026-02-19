/**
 * PositionHealthGauge — visual gauge showing % distance from nearest range boundary.
 * Also shows risk level: Low / Medium / High.
 */
import React from 'react'
import { motion } from 'framer-motion'

function getRisk(pct) {
    if (pct > 25) return { label: 'Low Risk', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' }
    if (pct > 10) return { label: 'Medium Risk', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' }
    return { label: 'High Risk', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' }
}

export default function PositionHealthGauge({ currentPrice, lowerBound, upperBound, inRange }) {
    const hasRange = lowerBound > 0 && upperBound > 0

    // % position within range (0 = lower edge, 100 = upper edge)
    const rangePct = hasRange
        ? Math.max(0, Math.min(100, ((currentPrice - lowerBound) / (upperBound - lowerBound)) * 100))
        : 50

    // Distance to nearest boundary
    const distToLower = hasRange ? ((currentPrice - lowerBound) / lowerBound) * 100 : 100
    const distToUpper = hasRange ? ((upperBound - currentPrice) / upperBound) * 100 : 100
    const minDist = Math.min(Math.abs(distToLower), Math.abs(distToUpper))

    const risk = getRisk(minDist)

    // Mid-point safety zone (40-60%)
    const isInSafeZone = rangePct >= 35 && rangePct <= 65

    return (
        <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span className="section-label">Position Health</span>
                <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                    color: inRange ? risk.color : '#EF4444',
                    background: inRange ? risk.bg : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${inRange ? risk.border : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {inRange ? risk.label : '⚠ OUT OF RANGE'}
                </span>
            </div>

            {/* Range track */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
                {/* Background track */}
                <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    {/* Safe zone highlight */}
                    <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: '35%', width: '30%',
                        background: 'rgba(16,185,129,0.12)',
                    }} />
                    {/* Fill bar */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, rangePct)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{
                            height: '100%',
                            background: inRange
                                ? `linear-gradient(90deg, rgba(16,185,129,0.4) 0%, ${risk.color} 100%)`
                                : '#EF4444',
                            borderRadius: 4,
                        }}
                    />
                </div>
                {/* Price pin */}
                <motion.div
                    initial={{ left: '50%' }}
                    animate={{ left: `${Math.max(2, Math.min(98, rangePct))}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                        position: 'absolute', top: -4, transform: 'translateX(-50%)',
                        width: 16, height: 16, borderRadius: '50%',
                        background: inRange ? risk.color : '#EF4444',
                        border: '2px solid var(--bg-card)',
                        boxShadow: `0 0 8px ${inRange ? risk.color : '#EF4444'}66`,
                    }}
                />
            </div>

            {/* Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 12 }}>
                <span>${hasRange ? lowerBound.toFixed(3) : '—'}</span>
                <span style={{ color: 'var(--text-secondary)' }}>${currentPrice.toFixed(4)} now</span>
                <span>${hasRange ? upperBound.toFixed(3) : '—'}</span>
            </div>

            {/* Distance stat */}
            <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: risk.color }}>{Math.abs(distToLower).toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>from lower</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: risk.color }}>{Math.abs(distToUpper).toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>from upper</div>
                </div>
            </div>
        </div>
    )
}
