/**
 * APRComparisonChart — side-by-side bar chart comparing LP APR vs HODL return.
 */
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{payload[0].name}</p>
            <p style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: payload[0].fill }}>{payload[0].value.toFixed(2)}% APR</p>
        </div>
    )
}

export default function APRComparisonChart({ feesEarned, capitalUsdc, elapsedDays, hodlValue }) {
    const lpAPR = elapsedDays > 0 && capitalUsdc > 0
        ? ((feesEarned / capitalUsdc) * (365 / elapsedDays)) * 100
        : 35

    const hodlPct = capitalUsdc > 0
        ? ((hodlValue - capitalUsdc) / capitalUsdc) * (365 / Math.max(elapsedDays, 1)) * 100
        : 0

    const data = [
        { name: 'LP APR', value: Math.max(0, lpAPR), fill: '#00C896' },
        { name: 'HODL APR', value: Math.abs(hodlPct), fill: '#4B5563' },
    ]

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="card"
            style={{ padding: '18px 20px', marginTop: 10 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span className="section-label">APR vs HODL</span>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: lpAPR > Math.abs(hodlPct) ? 'var(--accent-positive)' : 'var(--accent-negative)' }}>
                    LP {lpAPR > Math.abs(hodlPct) ? 'outperforming' : 'underperforming'} ↑
                </span>
            </div>
            <ResponsiveContainer width="100%" height={110}>
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 'dataMax + 5']} tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8B97A8' }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    )
}
