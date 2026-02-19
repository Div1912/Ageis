/**
 * StatCard — displays a single financial metric with count-up animation.
 * value prop is a raw number (from useDerivedStats) — never a pre-formatted string.
 */
import React from 'react'
import { motion } from 'framer-motion'
import { useCountUp } from '../hooks/useCountUp'

const COLORS = {
    positive: { text: 'var(--accent-positive)', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', stripe: 'var(--accent-positive)' },
    negative: { text: 'var(--accent-negative)', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', stripe: 'var(--accent-negative)' },
    neutral: { text: 'var(--text-primary)', bg: 'var(--bg-card)', border: 'var(--border)', stripe: null },
}

export default function StatCard({ label, value, subLabel, colorClass = 'neutral', index = 0 }) {
    // value is always a raw number from useDerivedStats
    const raw = typeof value === 'number' ? value : parseFloat(value) || 0
    const animated = useCountUp(Math.abs(raw), 900)
    const theme = COLORS[colorClass] || COLORS.neutral

    const isPositive = colorClass === 'positive'
    const isNegative = colorClass === 'negative'
    const isNeg = raw < 0

    const formatted = animated !== null
        ? `$${animated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `$${Math.abs(raw).toFixed(2)}`

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="card"
            style={{
                padding: '18px 20px',
                display: 'flex', flexDirection: 'column', gap: 6,
                background: theme.bg,
                borderColor: theme.border,
                position: 'relative', overflow: 'hidden',
            }}
        >
            {/* Accent top stripe */}
            {theme.stripe && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: theme.stripe, opacity: 0.5,
                }} />
            )}

            <span className="section-label">{label}</span>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {(isNeg || isNegative) && (
                    <span style={{ fontSize: 16, color: theme.text, fontWeight: 700, lineHeight: 1 }}>−</span>
                )}
                <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 22, fontWeight: 700,
                    color: theme.text,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                }}>
                    {formatted}
                </span>
                <span style={{ fontSize: 12, color: theme.text, opacity: 0.7, marginLeft: 2 }}>
                    {isPositive ? '↑' : isNegative ? '↓' : ''}
                </span>
            </div>

            {subLabel && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subLabel}</span>
            )}
        </motion.div>
    )
}
