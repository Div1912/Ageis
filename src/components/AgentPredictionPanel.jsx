/**
 * AgentPredictionPanel — shows AI agent's price prediction and rebalance signals.
 * Computes momentum, volatility, and range proximity to generate actionable signals.
 * Visual design inspired by trading terminal prediction panels.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useLivePrice } from '../hooks/useLivePrice'
import { usePosition } from '../hooks/usePosition'

const SIGNALS = {
    STRONG_HOLD: { label: 'STRONG HOLD', color: '#10B981', icon: '🟢', desc: 'Price stable within range. Fees accumulating.' },
    HOLD: { label: 'HOLD', color: '#4ade80', icon: '🟡', desc: 'Position healthy. No action needed.' },
    WATCH: { label: 'WATCH', color: '#FBBF24', icon: '⚠️', desc: 'Price approaching range boundary.' },
    REBALANCE_SOON: { label: 'REBALANCE LIKELY', color: '#F97316', icon: '🔶', desc: 'Price near edge. Agent may trigger rebalance.' },
    REBALANCE_NOW: { label: 'REBALANCE', color: '#EF4444', icon: '🔴', desc: 'Price out of range. Rebalance recommended.' },
}

function MiniSparkline({ data, color, height = 32 }) {
    if (!data || data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 120
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = height - ((v - min) / range) * (height - 4) - 2
        return `${x},${y}`
    }).join(' ')

    return (
        <svg width={w} height={height} style={{ opacity: 0.8 }}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Current price dot at end */}
            {data.length > 0 && (() => {
                const lastX = w
                const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2
                return <circle cx={lastX - 1} cy={lastY} r="3" fill={color} />
            })()}
        </svg>
    )
}

function ConfidenceBar({ value, label, color }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color, fontFamily: 'JetBrains Mono,monospace' }}>{value}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ height: '100%', background: color, borderRadius: 2 }}
                />
            </div>
        </div>
    )
}

export default function AgentPredictionPanel() {
    const { currentPrice, priceHistory } = useLivePrice()
    const position = usePosition()
    const [priceBuffer, setPriceBuffer] = useState([])

    // Accumulate price samples
    useEffect(() => {
        if (currentPrice > 0) {
            setPriceBuffer(prev => {
                const next = [...prev, currentPrice]
                return next.slice(-30) // keep last 30 samples
            })
        }
    }, [currentPrice])

    // Compute all prediction metrics
    const prediction = useMemo(() => {
        const lower = position.lowerBound || 0
        const upper = position.upperBound || 0
        const price = currentPrice || 0
        const rangeWidth = upper - lower || 1

        // Price position within range (0-100%)
        const positionInRange = lower > 0 && upper > 0
            ? Math.max(0, Math.min(100, ((price - lower) / rangeWidth) * 100))
            : 50

        // Distance to nearest boundary (%)
        const distToLower = price > 0 && lower > 0 ? ((price - lower) / price) * 100 : 50
        const distToUpper = price > 0 && upper > 0 ? ((upper - price) / price) * 100 : 50
        const distToNearest = Math.min(distToLower, distToUpper)

        // Momentum (price trending up or down based on recent samples)
        const samples = priceBuffer.length >= 3 ? priceBuffer : [price, price, price]
        const recentAvg = samples.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, samples.length)
        const olderAvg = samples.slice(0, Math.max(1, Math.floor(samples.length / 2))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(samples.length / 2))
        const momentum = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0

        // Volatility (std dev of recent prices)
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length
        const variance = samples.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / samples.length
        const volatility = Math.sqrt(variance) / mean * 100

        // Price direction
        const direction = momentum > 0.05 ? 'up' : momentum < -0.05 ? 'down' : 'neutral'

        // Determine signal
        let signal
        const inRange = price >= lower && price <= upper
        if (!inRange) {
            signal = SIGNALS.REBALANCE_NOW
        } else if (distToNearest < 2) {
            signal = SIGNALS.REBALANCE_SOON
        } else if (distToNearest < 5) {
            signal = SIGNALS.WATCH
        } else if (distToNearest > 15) {
            signal = SIGNALS.STRONG_HOLD
        } else {
            signal = SIGNALS.HOLD
        }

        // Confidence scores
        const holdConfidence = Math.min(99, Math.max(5, Math.round(
            inRange ? (distToNearest * 3 + (100 - volatility * 20)) / 2 : 10
        )))
        const rebalanceChance = Math.min(95, Math.max(5, 100 - holdConfidence))
        const rangeHealth = Math.min(99, Math.max(5, Math.round(
            inRange ? 40 + distToNearest * 4 : 5
        )))

        // Projected 24h fee capture
        const capital = position.capitalUsdc || 0
        const dailyFee = capital * 0.35 / 365
        const feeEfficiency = inRange ? Math.max(0.3, 1 - (Math.abs(positionInRange - 50) / 50) * 0.4) : 0

        return {
            signal, direction, momentum, volatility,
            positionInRange, distToNearest, distToLower, distToUpper,
            holdConfidence, rebalanceChance, rangeHealth,
            dailyFee, feeEfficiency, inRange,
        }
    }, [currentPrice, position, priceBuffer])

    const directionArrow = prediction.direction === 'up' ? '▲' : prediction.direction === 'down' ? '▼' : '◆'
    const directionColor = prediction.direction === 'up' ? '#10B981' : prediction.direction === 'down' ? '#EF4444' : '#8B97A8'

    return (
        <div className="card" style={{ padding: '20px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Agent Prediction</span>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#00C896', animation: 'livePulse 2s infinite',
                    }} />
                </div>
                <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: `${prediction.signal.color}15`,
                    color: prediction.signal.color,
                    border: `1px solid ${prediction.signal.color}30`,
                }}>
                    {prediction.signal.icon} {prediction.signal.label}
                </span>
            </div>

            {/* Price direction + sparkline */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.2))',
                borderRadius: 8, marginBottom: 14,
            }}>
                <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>PRICE TREND</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <motion.span
                            animate={{ y: prediction.direction === 'up' ? [-1, 1, -1] : prediction.direction === 'down' ? [1, -1, 1] : [0, 0, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            style={{ fontSize: 18, color: directionColor, fontWeight: 800 }}
                        >
                            {directionArrow}
                        </motion.span>
                        <div>
                            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>
                                ${currentPrice > 0 ? currentPrice.toFixed(4) : '—'}
                            </span>
                            <span style={{
                                fontSize: 11, marginLeft: 6, fontWeight: 600,
                                color: directionColor,
                            }}>
                                {prediction.momentum > 0 ? '+' : ''}{prediction.momentum.toFixed(3)}%
                            </span>
                        </div>
                    </div>
                </div>
                <MiniSparkline data={priceBuffer} color={directionColor} />
            </div>

            {/* Signal description */}
            <div style={{
                padding: '8px 12px', marginBottom: 14, borderRadius: 6,
                background: `${prediction.signal.color}08`,
                borderLeft: `3px solid ${prediction.signal.color}`,
                fontSize: 11, color: 'var(--text-secondary)',
            }}>
                {prediction.signal.desc}
            </div>

            {/* Confidence bars */}
            <ConfidenceBar label="Hold Confidence" value={prediction.holdConfidence} color="#10B981" />
            <ConfidenceBar label="Rebalance Chance" value={prediction.rebalanceChance} color="#F97316" />
            <ConfidenceBar label="Range Health" value={prediction.rangeHealth} color="#60a5fa" />

            {/* Metrics grid */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14,
                padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
                <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TO LOWER</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#EF4444' }}>
                        {prediction.distToLower.toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>VOLATILITY</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: prediction.volatility > 2 ? '#FBBF24' : '#8B97A8' }}>
                        {prediction.volatility.toFixed(2)}%
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TO UPPER</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>
                        {prediction.distToUpper.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Fee efficiency meter */}
            <div style={{
                marginTop: 10, padding: '10px 14px',
                background: 'var(--bg-surface, rgba(0,0,0,0.15))', borderRadius: 8,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>FEE CAPTURE EFFICIENCY</span>
                    <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace',
                        color: prediction.feeEfficiency > 0.7 ? '#10B981' : prediction.feeEfficiency > 0.4 ? '#FBBF24' : '#EF4444',
                    }}>
                        {(prediction.feeEfficiency * 100).toFixed(0)}%
                    </span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.feeEfficiency * 100}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                        style={{
                            height: '100%', borderRadius: 3,
                            background: prediction.feeEfficiency > 0.7
                                ? 'linear-gradient(90deg, #10B981, #34d399)'
                                : prediction.feeEfficiency > 0.4
                                    ? 'linear-gradient(90deg, #FBBF24, #F97316)'
                                    : 'linear-gradient(90deg, #EF4444, #F97316)',
                        }}
                    />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    Est. daily: <span style={{ color: '#10B981', fontWeight: 600 }}>+${prediction.dailyFee.toFixed(2)}</span>
                    {' '}× {(prediction.feeEfficiency * 100).toFixed(0)}% = <span style={{ fontWeight: 600 }}>${(prediction.dailyFee * prediction.feeEfficiency).toFixed(2)}</span> effective
                </div>
            </div>
        </div>
    )
}
