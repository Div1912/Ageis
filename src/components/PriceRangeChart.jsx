/**
 * PriceRangeChart — Recharts line chart showing live ALGO/USDC price history
 * with a shaded range band and in/out-of-range status badge.
 */
import React, { useMemo } from 'react'
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    ReferenceArea, ReferenceLine, CartesianGrid,
} from 'recharts'
import LivePulse from './LivePulse'

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px',
        }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                ${payload[0].value.toFixed(4)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{payload[0].payload.timestamp}</div>
        </div>
    )
}

export default function PriceRangeChart({ priceHistory, currentPrice, lowerBound, upperBound, isLoading }) {
    const inRange = currentPrice >= lowerBound && currentPrice <= upperBound

    const chartData = useMemo(() => {
        if (priceHistory.length === 0 && currentPrice > 0) {
            return [{ time: Date.now(), price: currentPrice, timestamp: 'Now' }]
        }
        return priceHistory
    }, [priceHistory, currentPrice])

    const yDomain = useMemo(() => {
        if (!chartData.length) return ['auto', 'auto']
        const prices = chartData.map(d => d.price)
        const allValues = [...prices, lowerBound, upperBound].filter(Boolean)
        const min = Math.min(...allValues) * 0.97
        const max = Math.max(...allValues) * 1.03
        return [min, max]
    }, [chartData, lowerBound, upperBound])

    return (
        <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="section-label">Price vs Range</span>
                    {isLoading && <span className="refresh-spinner" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Lower <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${lowerBound.toFixed(3)}</span>
                        {' · '}
                        Current <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>${currentPrice.toFixed(4)}</span>
                        {' · '}
                        Upper <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${upperBound.toFixed(3)}</span>
                    </span>
                    <span className={inRange ? 'badge-in-range' : 'badge-out-range'}>
                        <LivePulse size={6} color={inRange ? '#10B981' : '#F59E0B'} />
                        {inRange ? 'IN RANGE' : 'OUT OF RANGE'}
                    </span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,39,48,0.8)" />
                    <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={yDomain}
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `$${v.toFixed(3)}`}
                        width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Range band */}
                    {lowerBound > 0 && upperBound > 0 && (
                        <ReferenceArea
                            y1={lowerBound}
                            y2={upperBound}
                            fill={inRange ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.1)'}
                            fillOpacity={1}
                            className={inRange ? 'range-band-active' : 'range-band-warning'}
                        />
                    )}

                    {/* Current price line */}
                    {currentPrice > 0 && (
                        <ReferenceLine
                            y={currentPrice}
                            stroke="rgba(241,245,249,0.5)"
                            strokeDasharray="4 4"
                            strokeWidth={1}
                        />
                    )}

                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#00C896"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, fill: '#00C896', strokeWidth: 0 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
