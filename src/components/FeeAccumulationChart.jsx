/**
 * FeeAccumulationChart — area chart showing cumulative fee earnings over time.
 * Computed from fee_rate * capital * elapsed_days.
 */
import React, { useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from 'recharts'

const FEE_APR = 0.35

function generateFeeData(capitalUsdc, openTimestamp, currentFees) {
    const now = Date.now() / 1000
    const startTs = openTimestamp > 0 ? openTimestamp : now - 86400 * 14
    const totalDays = (now - startTs) / 86400
    const points = Math.min(Math.max(Math.floor(totalDays), 1), 30)

    return Array.from({ length: points + 1 }, (_, i) => {
        const day = (totalDays / points) * i
        const fees = capitalUsdc * FEE_APR * (day / 365)
        const date = new Date((startTs + day * 86400) * 1000)
        return {
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            fees: Number(fees.toFixed(2)),
        }
    })
}

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px',
        }}>
            <div style={{ fontSize: 13, color: 'var(--accent-positive)', fontWeight: 600 }}>
                +${payload[0].value.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{payload[0].payload.day}</div>
        </div>
    )
}

export default function FeeAccumulationChart({ capitalUsdc, openTimestamp, feesEarned }) {
    const data = useMemo(
        () => generateFeeData(capitalUsdc, openTimestamp, feesEarned),
        [capitalUsdc, openTimestamp, feesEarned]
    )

    return (
        <div className="card" style={{ padding: '20px 24px', marginTop: 12 }}>
            <div style={{ marginBottom: 16 }}>
                <span className="section-label">Fee Accumulation</span>
                <span style={{ float: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    35% APR estimate · 0.25% swap fee basis
                </span>
            </div>

            <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,39,48,0.8)" />
                    <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `$${v.toFixed(0)}`}
                        width={48}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="fees"
                        stroke="#10B981"
                        strokeWidth={1.5}
                        fill="url(#feeGrad)"
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
