/**
 * Analytics page — historical charts computed from real position data + live price.
 * Uses on-chain position data, live price feed, and P&L calculations.
 */
import React, { useState, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useLivePrice } from '../hooks/useLivePrice'
import { usePosition } from '../hooks/usePosition'
import { computeILDollar, computeFeesEarned } from '../services/pnlCalculator'

const RANGES = ['7D', '30D', 'All Time']

/**
 * Build analytics data from real position parameters.
 * Uses actual entry price, capital, and elapsed time from on-chain state
 * combined with the live price feed to compute real fee/IL curves.
 */
function buildAnalyticsData(days, position, currentPrice, priceHistory) {
    const { entryPrice = 0, capitalUsdc = 0, openTimestamp = 0 } = position || {}

    // If no position data, return empty
    if (!entryPrice || !capitalUsdc) return []

    const nowSec = Math.floor(Date.now() / 1000)
    const positionAgeDays = openTimestamp > 0 ? (nowSec - openTimestamp) / 86400 : 0
    const effectiveDays = Math.min(days, Math.max(Math.ceil(positionAgeDays), 1))

    // Use live price history if available, otherwise interpolate from entry → current
    const pricePoints = priceHistory && priceHistory.length > 1
        ? priceHistory
        : null

    return Array.from({ length: effectiveDays }, (_, i) => {
        const dayFraction = (i + 1) / effectiveDays
        const elapsedDays = dayFraction * effectiveDays

        // Price at this point: interpolate from entry to current
        let price
        if (pricePoints && pricePoints.length > 0) {
            // Sample from real price history
            const idx = Math.min(
                Math.floor(dayFraction * (pricePoints.length - 1)),
                pricePoints.length - 1
            )
            price = pricePoints[idx]?.price || pricePoints[idx] || currentPrice
        } else {
            // Linear interpolation from entry to current
            price = entryPrice + (currentPrice - entryPrice) * dayFraction
        }

        const fees = computeFeesEarned(capitalUsdc, 0.35, elapsedDays)
        const il = computeILDollar(capitalUsdc, entryPrice, price)
        const net = fees - il

        const date = new Date(nowSec * 1000 - (effectiveDays - i) * 86400000)
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        return {
            label,
            price: parseFloat((typeof price === 'number' ? price : currentPrice).toFixed(4)),
            fees: parseFloat(fees.toFixed(2)),
            il: parseFloat(il.toFixed(2)),
            net: parseFloat(net.toFixed(2)),
        }
    })
}

const TT = ({ active, payload, label, prefix = '$' }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
            {payload.map(p => (
                <p key={p.dataKey} style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace', color: p.stroke || p.fill }}>{prefix}{typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</p>
            ))}
        </div>
    )
}

export default function Analytics({ wallet }) {
    const [range, setRange] = useState('30D')
    const { currentPrice, priceHistory } = useLivePrice()
    const { position, isLoading } = usePosition()
    const days = range === '7D' ? 7 : range === '30D' ? 30 : 90
    const data = useMemo(
        () => buildAnalyticsData(days, position, currentPrice, priceHistory),
        [days, position, currentPrice, priceHistory]
    )
    const tickEvery = days <= 7 ? 1 : days <= 30 ? 5 : 10

    const lastPoint = data.length > 0 ? data[data.length - 1] : null

    return (
        <div className="page-base">
            <Navbar wallet={wallet} isDashboard={true} />

            <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 32px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Analytics</h2>
                        <p style={{ fontSize: 13 }}>Historical performance · Fees, IL, and net P&L over time</p>
                    </div>
                    {/* Date range toggle */}
                    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7 }}>
                        {RANGES.map(r => (
                            <button key={r} onClick={() => setRange(r)} style={{
                                padding: '5px 14px', borderRadius: 5, fontSize: 12, fontWeight: 600,
                                background: range === r ? 'var(--accent-primary)' : 'transparent',
                                color: range === r ? '#000' : 'var(--text-secondary)',
                                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                            }}>{r}</button>
                        ))}
                    </div>
                </div>

                {/* No position state */}
                {!isLoading && (!position?.entryPrice || !position?.capitalUsdc) ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="card" style={{ padding: 48, textAlign: 'center' }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                        <h3 style={{ fontSize: 16, marginBottom: 8 }}>No Position Data</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
                            Connect your wallet and open a position to see real-time analytics.
                            Charts will populate with live fee, IL, and P&L data.
                        </p>
                    </motion.div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                            {lastPoint && [
                                { l: 'Fees Earned', v: `+$${lastPoint.fees.toFixed(2)}`, c: 'var(--accent-positive)' },
                                { l: 'IL Incurred', v: `-$${lastPoint.il.toFixed(2)}`, c: 'var(--accent-negative)' },
                                { l: 'Net P&L', v: `${lastPoint.net >= 0 ? '+' : ''} $${lastPoint.net.toFixed(2)}`, c: lastPoint.net >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)' },
                                { l: 'Avg Daily Fee', v: `+$${(lastPoint.fees / Math.max(data.length, 1)).toFixed(2)}`, c: 'var(--text-primary)' },
                            ].map(({ l, v, c }) => (
                                <div key={l} className="card" style={{ padding: '14px 18px' }}>
                                    <span className="section-label" style={{ marginBottom: 6, display: 'block' }}>{l}</span>
                                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, fontWeight: 700, color: c }}>{v}</span>
                                </div>
                            ))}
                        </div>

                        {/* Fees vs IL chart */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: '18px 20px' }}>
                                <span className="section-label" style={{ marginBottom: 14, display: 'block' }}>Fees Earned vs Impermanent Loss</span>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gFee" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gIL" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,39,48,0.5)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} interval={tickEvery - 1} />
                                        <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={45} />
                                        <Tooltip content={<TT />} />
                                        <Area type="monotone" dataKey="fees" stroke="#10B981" strokeWidth={2} fill="url(#gFee)" name="Fees" />
                                        <Area type="monotone" dataKey="il" stroke="#EF4444" strokeWidth={2} fill="url(#gIL)" name="IL" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </motion.div>

                            {/* Vertical net fee bars */}
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card" style={{ padding: '18px 20px' }}>
                                <span className="section-label" style={{ marginBottom: 14, display: 'block' }}>Net After IL (by period)</span>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={data.filter((_, i) => i % (tickEvery) === 0)} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(0)}`} width={40} />
                                        <Tooltip content={<TT />} />
                                        <Bar dataKey="net" radius={[3, 3, 0, 0]} maxBarSize={20}>
                                            {data.filter((_, i) => i % tickEvery === 0).map((entry, i) => (
                                                <Cell key={i} fill={entry.net >= 0 ? '#10B981' : '#EF4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </motion.div>
                        </div>

                        {/* Price over time */}
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card" style={{ padding: '18px 20px' }}>
                            <span className="section-label" style={{ marginBottom: 14, display: 'block' }}>ALGO/USDC Price History</span>
                            <ResponsiveContainer width="100%" height={140}>
                                <LineChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,39,48,0.5)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} interval={tickEvery - 1} />
                                    <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v.toFixed(3)}`} width={52} domain={['auto', 'auto']} />
                                    <Tooltip content={<TT prefix="$" />} />
                                    <Line type="monotone" dataKey="price" stroke="#00C896" strokeWidth={2} dot={false} name="Price" />
                                </LineChart>
                            </ResponsiveContainer>
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    )
}
