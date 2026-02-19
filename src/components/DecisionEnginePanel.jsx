/**
 * DecisionEnginePanel — right sidebar showing live computed recommendations.
 * Accepts `rebalanceSlot` render prop to inject the real RebalanceTriggerButton.
 */
import React from 'react'
import LivePulse from './LivePulse'
import { formatUSD } from '../services/pnlCalculator'

const APP_ID = import.meta.env.VITE_APP_ID || '755777633'

const Field = ({ label, value, valueColor }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(30,39,48,0.5)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: valueColor || 'var(--text-primary)', fontWeight: 500 }}>
            {value}
        </span>
    </div>
)

export default function DecisionEnginePanel({
    currentPrice, inRange, dailyFee, avgSwapCost, netRebalanceValue,
    shouldRebalance, lastTxTimestamp, isWalletConnected,
    rebalanceSlot,
}) {
    const lastTx = lastTxTimestamp
        ? new Date(lastTxTimestamp * 1000).toLocaleString()
        : 'No transactions'

    return (
        <div className="card" style={{ padding: '20px 20px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <span className="section-label">Decision Engine</span>
                <LivePulse />
                <span style={{ fontSize: 10, color: 'var(--accent-positive)', fontWeight: 700, letterSpacing: '0.1em' }}>MONITORING</span>
            </div>

            <div>
                <Field label="Current Price" value={`$${(currentPrice || 0).toFixed(4)}`} valueColor="var(--text-primary)" />
                <Field
                    label="Range Status"
                    value={inRange ? 'IN RANGE' : 'OUT OF RANGE'}
                    valueColor={inRange ? 'var(--accent-positive)' : 'var(--accent-warning)'}
                />
                <Field label="Daily Fee Est." value={`+${formatUSD(dailyFee)}`} valueColor="var(--accent-positive)" />
                <Field label="Rebalance Cost" value={`~${formatUSD(avgSwapCost)}`} valueColor="var(--text-muted)" />
                <Field
                    label="7d Net Value"
                    value={netRebalanceValue >= 0 ? `+${formatUSD(netRebalanceValue)}` : formatUSD(netRebalanceValue)}
                    valueColor={netRebalanceValue >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)'}
                />
                <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Recommendation</span>
                    <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                        color: shouldRebalance ? 'var(--accent-warning)' : 'var(--accent-positive)',
                        padding: '4px 10px',
                        background: shouldRebalance ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        border: `1px solid ${shouldRebalance ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        borderRadius: 4,
                    }}>
                        {shouldRebalance ? '⚡ REBALANCE' : '✓ HOLD'}
                    </span>
                </div>
            </div>

            {/* rebalanceSlot: real RebalanceTriggerButton injected from Dashboard */}
            <div style={{ marginTop: 18 }}>
                {rebalanceSlot}
                {!isWalletConnected && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                        Connect wallet to trigger
                    </p>
                )}
            </div>

            <div style={{ marginTop: 16, padding: '14px 0 0', borderTop: '1px solid var(--border)' }}>
                <p className="section-label" style={{ marginBottom: 10 }}>Algorand Details</p>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
                    <div>
                        App ID:{' '}
                        <a
                            href={`https://lora.algokit.io/testnet/application/${APP_ID}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                        >
                            {APP_ID} ↗
                        </a>
                    </div>
                    <div>Network: <span style={{ color: 'var(--text-secondary)' }}>Algorand Testnet</span></div>
                    <div>Last Tx: <span style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{lastTx}</span></div>
                </div>
            </div>
        </div>
    )
}
