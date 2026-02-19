/**
 * NetPnLPanel — hero stat card showing net P&L with full breakdown.
 * Displayed wider than other stat cards.
 */
import React from 'react'
import { motion } from 'framer-motion'
import { useCountUp } from '../hooks/useCountUp'
import { formatUSD } from '../services/pnlCalculator'

export default function NetPnLPanel({ netPnL, feesEarned, ilDollar, swapLosses, index = 2 }) {
    const animatedPnL = useCountUp(Math.abs(netPnL || 0), 1400)
    const isPositive = (netPnL || 0) >= 0

    const pnlFormatted = animatedPnL.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    return (
        <motion.div
            className="card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
            style={{
                padding: '20px 24px',
                border: `1px solid ${isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                background: isPositive
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, var(--bg-card) 50%)'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.04) 0%, var(--bg-card) 50%)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="stat-label">Net P&L</div>
                <span title="Fee & IL figures are model projections based on on-chain position data" style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 3,
                    background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                    fontWeight: 600, letterSpacing: '0.04em', cursor: 'help',
                }}> PROJECTED</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '4px 0 12px' }}>
                <span style={{ fontSize: 13, color: isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)' }}>
                    {isPositive ? '+$' : '-$'}
                </span>
                <span style={{
                    fontSize: 42,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: isPositive ? 'var(--accent-positive)' : 'var(--accent-negative)',
                }}>
                    {pnlFormatted}
                </span>
            </div>

            <div style={{
                display: 'flex',
                gap: 20,
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="stat-label">Fees</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-positive)' }}>
                        +{formatUSD(feesEarned)}
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="stat-label">IL</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-negative)' }}>
                        -{formatUSD(ilDollar)}
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="stat-label">Swaps</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                        -{formatUSD(swapLosses)}
                    </span>
                </div>
            </div>
        </motion.div>
    )
}
