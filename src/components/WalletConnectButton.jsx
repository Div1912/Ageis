/**
 * WalletConnectButton — Pera Wallet connect/disconnect with premium styling.
 */
import React from 'react'

function truncate(addr) {
    if (!addr) return ''
    return `${addr.slice(0, 5)}…${addr.slice(-4)}`
}

export default function WalletConnectButton({ wallet }) {
    const { isConnected, address, balance, connect, disconnect, isConnecting } = wallet

    if (isConnected && address) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* balance */}
                <div style={{
                    padding: '5px 12px', borderRadius: 5,
                    border: '1px solid var(--border)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11, color: 'var(--text-secondary)',
                }}>
                    {balance !== null ? `${balance.toFixed(3)} ALGO` : '…'}
                </div>
                {/* address + disconnect */}
                <button
                    onClick={disconnect}
                    title="Click to disconnect"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 5,
                        border: '1px solid rgba(0,200,150,0.25)',
                        background: 'rgba(0,200,150,0.06)',
                        cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11, color: 'var(--accent-primary)',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = 'var(--accent-negative)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,200,150,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,200,150,0.25)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
                    {truncate(address)}
                </button>
            </div>
        )
    }

    return (
        <button
            className="btn-primary"
            onClick={connect}
            disabled={isConnecting}
        >
            {isConnecting ? (
                <>
                    <span className="spin-arc" />
                    Connecting…
                </>
            ) : (
                <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 12V22H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                    </svg>
                    Connect Wallet
                </>
            )}
        </button>
    )
}
