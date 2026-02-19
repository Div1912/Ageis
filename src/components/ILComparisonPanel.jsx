/**
 * ILComparisonPanel — full-width bar showing fees earned vs IL incurred.
 */
import React from 'react'
import { motion } from 'framer-motion'
import { formatUSD } from '../services/pnlCalculator'
import { useCountUp } from '../hooks/useCountUp'

export default function ILComparisonPanel({ feesEarned, ilDollar, netAfterIL, entryPrice }) {
    const animFees = useCountUp(feesEarned || 0, 1200)
    const animIL = useCountUp(ilDollar || 0, 1200)
    const animNet = useCountUp(Math.abs(netAfterIL || 0), 1400)

    const total = (feesEarned || 0) + (ilDollar || 0)
    const feePct = total > 0 ? ((feesEarned || 0) / total) * 100 : 50
    const ilPct = total > 0 ? ((ilDollar || 0) / total) * 100 : 50

    const netPositive = (netAfterIL || 0) >= 0

    return (
        <div className="card" style={{ padding: '24px 28px', marginTop: 12 }}>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="section-label">Impermanent Loss vs Fee Performance</span>
                <span title="Calculated from position parameters, not live pool data" style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 3,
                    background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                    fontWeight: 600, letterSpacing: '0.04em', cursor: 'help',
                }}> PROJECTED</span>
            </div>

            {/* Side-by-side bars */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Fees Earned</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-positive)', fontWeight: 600 }}>
                            +{formatUSD(animFees)}
                        </span>
                    </div>
                    <motion.div
                        style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}
                    >
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${feePct}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                            style={{ height: '100%', background: 'var(--accent-positive)', borderRadius: 4 }}
                        />
                    </motion.div>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total IL Incurred</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-negative)', fontWeight: 600 }}>
                            -{formatUSD(animIL)}
                        </span>
                    </div>
                    <motion.div
                        style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}
                    >
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${ilPct}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.35 }}
                            style={{ height: '100%', background: 'var(--accent-negative)', borderRadius: 4, opacity: 0.7 }}
                        />
                    </motion.div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <span className="stat-label" style={{ marginBottom: 4, display: 'block' }}>Net After IL</span>
                    <span style={{
                        fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
                        color: netPositive ? 'var(--accent-positive)' : 'var(--accent-negative)',
                    }}>
                        {netPositive ? '+$' : '-$'}{animNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                <p style={{ maxWidth: 420, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'right' }}>
                    Impermanent loss calculated using the standard IL formula against your entry price of{' '}
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${entryPrice?.toFixed(4) ?? '—'}</span>.{' '}
                    AEGIS only recommends rebalance when projected fees exceed IL + swap costs.
                </p>
            </div>
        </div>
    )
}
