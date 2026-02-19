/**
 * Navbar — sticky, blur-backed navigation bar with all page links.
 */
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import WalletConnectButton from './WalletConnectButton'
import LivePulse from './LivePulse'

export default function Navbar({ wallet, isDashboard }) {
    const navigate = useNavigate()
    const location = useLocation()

    return (
        <nav className="navbar">
            {/* Logo */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginRight: 28 }}
                onClick={() => navigate('/')}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <polygon points="12,2 22,20 2,20" stroke="#00C896" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3" fill="#00C896" opacity="0.9" />
                </svg>
                <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                    AEGIS
                </span>
            </div>

            {/* Nav links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                {isDashboard ? (
                    <>
                        <NavLink href="/dashboard" active={location.pathname === '/dashboard'}>Dashboard</NavLink>
                        <NavLink href="/positions" active={location.pathname === '/positions'}>Positions</NavLink>
                        <NavLink href="/analytics" active={location.pathname === '/analytics'}>Analytics</NavLink>
                        <NavLink href="/transactions" active={location.pathname === '/transactions'}>History</NavLink>
                        <NavLink href="/swap" active={location.pathname === '/swap'}>Swap</NavLink>
                    </>
                ) : (
                    <NavLink href="/dashboard" active={false}>Dashboard →</NavLink>
                )}
            </div>

            {/* Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LivePulse />
                    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>TESTNET</span>
                </div>
                <a
                    href={`https://lora.algokit.io/testnet/application/${import.meta.env.VITE_APP_ID || '755777633'}`}
                    target="_blank" rel="noreferrer"
                    title="Verified on Algorand Testnet"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', border: '1px solid var(--border)',
                        borderRadius: 5, fontSize: 10, color: 'var(--text-muted)',
                        fontFamily: 'JetBrains Mono,monospace', textDecoration: 'none',
                        transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'rgba(0,200,150,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                    <span style={{ color: 'var(--accent-primary)' }}>◈</span>
                    AlgoKit · Verified
                </a>
                <WalletConnectButton wallet={wallet} />
            </div>
        </nav>
    )
}

function NavLink({ href, children, active }) {
    return (
        <a
            href={href}
            style={{
                fontSize: 13, fontWeight: active ? 600 : 500,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '5px 12px', borderRadius: 5,
                background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                transition: 'color 0.15s, background 0.15s',
                textDecoration: 'none',
                borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; } }}
        >
            {children}
        </a>
    )
}
