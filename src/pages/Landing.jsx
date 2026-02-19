/**
 * Landing page — fixed redirect, premium hero, How It Works, Why AEGIS, live ticker, footer.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import WalletConnectButton from '../components/WalletConnectButton'
import OnboardingModal from '../components/OnboardingModal'
import MatrixRain from '../components/MatrixRain'
import { useLivePrice } from '../hooks/useLivePrice'

// Word-by-word headline reveal
const WORDS_LINE1 = ['Know', 'Your', 'True', 'P&L.']
const WORDS_LINE2 = ['Automate', 'Your', 'Range.']
const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
})

// ── Formula Bar ──────────────────────────
function FormulaBar() {
    const items = [
        { label: 'Fees', sign: '+', clr: '#10B981' },
        { label: 'IL', sign: '−', clr: '#EF4444' },
        { label: 'Swaps', sign: '−', clr: '#EF4444' },
        { label: 'Gas', sign: '−', clr: '#6B7280' },
    ]
    return (
        <motion.div {...fadeUp(1.25)} style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap',
            justifyContent: 'center', gap: 0,
            margin: '28px auto 36px', padding: '16px 28px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, maxWidth: 580,
        }}>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', marginRight: 14 }}>Net P&amp;L =</span>
            {items.map((item, i) => (
                <React.Fragment key={i}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: item.clr, fontWeight: 700, marginBottom: 2 }}>{item.sign}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.label}</span>
                    </div>
                    {i < items.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 14, padding: '0 2px', alignSelf: 'flex-end', paddingBottom: 1 }}></span>}
                </React.Fragment>
            ))}
        </motion.div>
    )
}

// ── Features ──────────────────────────────
const features = [
    { icon: '◉', title: 'Live Price Feed', desc: 'ALGO/USDC spot from Vestige.fi, polled every 30s. No proxies, no caches.', tag: 'Vestige.fi' },
    { icon: '◈', title: 'On-chain Position Storage', desc: 'LP parameters stored in an AVM smart contract on Algorand Testnet. Fully auditable.', tag: 'AlgoKit · Puya' },
    { icon: '◇', title: 'Accurate IL Formula', desc: 'IL = 2√k/(1+k)−1 computed in-browser. Mathematically exact, not an estimate.', tag: 'Math, not guesswork' },
    { icon: '⬡', title: 'Decision Engine', desc: 'Recommends rebalance only when 7-day fee projection exceeds rebalance cost.', tag: 'Profitable only' },
    { icon: '⊕', title: 'Pera Wallet Signing', desc: 'Rebalances sign a real ABI method call on-chain via Pera. Non-custodial.', tag: '@perawallet/connect' },
    { icon: '▣', title: 'Indexer History', desc: 'Transaction history from Algorand Testnet Indexer populates rebalance tables.', tag: 'testnet-idx.algonode' },
]

// ── How It Works ──────────────────────────
const steps = [
    { n: '01', title: 'Connect Wallet', desc: 'Link your Pera Wallet in one click. No seed phrase exposed — Pera handles all signing.' },
    { n: '02', title: 'Set Position', desc: 'Enter your LP entry price, range bounds, and capital. AEGIS stores it on-chain.' },
    { n: '03', title: 'AEGIS Monitors', desc: 'Live price tracking, IL tracking, and rebalance decisions — fully autonomous.' },
]

// ── Why AEGIS ─────────────────────────────
const comparisons = [
    { label: 'Gross fees shown', other: true, aegis: true },
    { label: 'After-IL net P&L', other: false, aegis: true },
    { label: 'Swap cost accounting', other: false, aegis: true },
    { label: 'Profitable-only rebalance', other: false, aegis: true },
    { label: 'On-chain position storage', other: false, aegis: true },
    { label: 'Live price feed', other: false, aegis: true },
]

export default function Landing({ wallet }) {
    const navigate = useNavigate()
    const { currentPrice, isLoading } = useLivePrice()
    const [showOnboarding, setShowOnboarding] = useState(false)

    // Single effect — handles all post-connect routing atomically
    useEffect(() => {
        if (!wallet.isConnected || wallet.isConnecting) return
        const onboarded = localStorage.getItem('aegis_onboarded')
        if (!onboarded) {
            // First time ever — show onboarding modal
            setShowOnboarding(true)
        } else {
            // Already onboarded — go straight to dashboard
            navigate('/dashboard', { replace: true })
        }
    }, [wallet.isConnected, wallet.isConnecting, navigate])

    function handleOnboardingDone() {
        localStorage.setItem('aegis_onboarded', '1')
        setShowOnboarding(false)
        navigate('/dashboard', { replace: true })
    }

    return (
        <div className="page-base" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            {/* Matrix rain background */}
            <MatrixRain opacity={0.10} />

            {/* All content above the animation */}
            <div style={{ position: 'relative', zIndex: 1 }}>
                <Navbar wallet={wallet} isDashboard={false} />

                {/* ── LIVE TICKER ──────────────────── */}
                <div style={{
                    background: 'rgba(0,200,150,0.04)',
                    borderBottom: '1px solid rgba(0,200,150,0.1)',
                    padding: '7px 0', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', gap: 48,
                    whiteSpace: 'nowrap',
                }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: i === 0 ? 32 : 0 }}>
                            <span style={{ color: 'var(--accent-primary)' }}>◉</span>
                            ALGO/USDC
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                {isLoading ? '…' : `$${currentPrice.toFixed(4)}`}
                            </span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 12px' }}>·</span>
                            Testnet <span style={{ color: 'var(--accent-positive)', marginLeft: 4 }}>●</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 12px' }}>·</span>
                            AlgoKit v2 <span style={{ color: 'var(--accent-primary)', marginLeft: 4 }}>◈</span>
                        </span>
                    ))}
                </div>

                {/* ── HERO ─────────────────────────── */}
                <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 40px 56px', maxWidth: 860, margin: '0 auto' }}>
                    <motion.div {...fadeUp(0.1)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 16px', marginBottom: 32,
                        background: 'rgba(0,200,150,0.07)', border: '1px solid rgba(0,200,150,0.18)',
                        borderRadius: 999, fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: 'var(--accent-primary)',
                    }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', animation: 'livePulse 2s infinite', display: 'inline-block' }} />
                        {isLoading ? 'Fetching ALGO/USDC…' : `ALGO / USDC · $${currentPrice.toFixed(4)}`}
                    </motion.div>

                    <motion.p {...fadeUp(0.2)} className="stat-label" style={{ marginBottom: 22, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
                        Algorand Liquidity Intelligence
                    </motion.p>

                    <h1 style={{ fontSize: 60, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.07, marginBottom: 22 }}>
                        <div style={{ display: 'block', marginBottom: 4 }}>
                            {WORDS_LINE1.map((w, i) => (
                                <motion.span key={w} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.45, delay: 0.36 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ display: 'inline-block', marginRight: '0.28em' }}>{w}</motion.span>
                            ))}
                        </div>
                        <div style={{ display: 'block' }}>
                            {WORDS_LINE2.map((w, i) => (
                                <motion.span key={w} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.45, delay: 0.72 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ display: 'inline-block', marginRight: '0.28em', color: i === 2 ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{w}</motion.span>
                            ))}
                        </div>
                    </h1>

                    <motion.p {...fadeUp(1.05)} style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 540, lineHeight: 1.75 }}>
                        AEGIS monitors your Algorand liquidity positions, calculates real net P&amp;L after impermanent loss,
                        and rebalances — only when profitable.
                    </motion.p>

                    <FormulaBar />

                    <motion.div {...fadeUp(1.45)} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <WalletConnectButton wallet={wallet} />
                        <button className="btn-secondary" onClick={() => navigate('/dashboard')}>View Dashboard →</button>
                    </motion.div>
                </section>

                {/* ── HOW IT WORKS ─────────────────── */}
                <section style={{ padding: '64px 40px', borderTop: '1px solid var(--border)', background: 'rgba(14,18,24,0.5)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                        <motion.p {...fadeUp(0)} className="section-label" style={{ textAlign: 'center', marginBottom: 8 }}>How It Works</motion.p>
                        <motion.h2 {...fadeUp(0.08)} style={{ textAlign: 'center', fontSize: 28, marginBottom: 48 }}>Three steps to true LP intelligence</motion.h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
                            {steps.map((s, i) => (
                                <motion.div key={s.n} {...fadeUp(i * 0.1)} style={{
                                    padding: '28px 24px', background: 'var(--bg-card)',
                                    border: '1px solid var(--border)', borderRadius: 10,
                                }}>
                                    <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: 'var(--accent-primary)', marginBottom: 14, letterSpacing: '0.06em' }}>{s.n}</div>
                                    <h3 style={{ fontSize: 17, marginBottom: 10 }}>{s.title}</h3>
                                    <p style={{ fontSize: 13, lineHeight: 1.7 }}>{s.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── WHY AEGIS ────────────────────── */}
                <section style={{ padding: '64px 40px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ maxWidth: 800, margin: '0 auto' }}>
                        <motion.p {...fadeUp(0)} className="section-label" style={{ textAlign: 'center', marginBottom: 8 }}>Why AEGIS</motion.p>
                        <motion.h2 {...fadeUp(0.08)} style={{ textAlign: 'center', fontSize: 28, marginBottom: 40 }}>Other tools vs AEGIS</motion.h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }} />
                            <div style={{ padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Other LP tools</div>
                            <div style={{ padding: '12px 20px', background: 'rgba(0,200,150,0.05)', borderBottom: '1px solid var(--border)', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)' }}>AEGIS ◈</div>
                            {comparisons.map((row, i) => (
                                <React.Fragment key={row.label}>
                                    <div style={{ padding: '13px 20px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: i < comparisons.length - 1 ? '1px solid rgba(30,39,48,0.5)' : undefined, background: 'var(--bg-card)' }}>{row.label}</div>
                                    <div style={{ padding: '13px 20px', textAlign: 'center', borderBottom: i < comparisons.length - 1 ? '1px solid rgba(30,39,48,0.5)' : undefined, background: 'var(--bg-card)' }}><span style={{ color: row.other ? 'var(--accent-positive)' : 'var(--accent-negative)', fontSize: 16 }}>{row.other ? '✓' : '✗'}</span></div>
                                    <div style={{ padding: '13px 20px', textAlign: 'center', borderBottom: i < comparisons.length - 1 ? '1px solid rgba(30,39,48,0.5)' : undefined, background: 'rgba(0,200,150,0.025)' }}><span style={{ color: 'var(--accent-positive)', fontSize: 16 }}>✓</span></div>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FEATURE GRID ─────────────────── */}
                <section style={{ padding: '64px 40px', borderTop: '1px solid var(--border)', background: 'rgba(14,18,24,0.5)' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                        <motion.p {...fadeUp(0)} className="section-label" style={{ textAlign: 'center', marginBottom: 48 }}>Built on real infrastructure</motion.p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                            {features.map((f, i) => (
                                <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 * i, ease: 'easeOut' }}
                                    style={{ padding: '22px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, transition: 'border-color 0.2s' }}
                                    whileHover={{ borderColor: 'rgba(0,200,150,0.25)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ fontSize: 20, color: 'var(--accent-primary)' }}>{f.icon}</span>
                                        <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-muted)', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 4 }}>{f.tag}</span>
                                    </div>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 7 }}>{f.title}</h3>
                                    <p style={{ fontSize: 12, lineHeight: 1.65 }}>{f.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FOOTER ───────────────────────── */}
                <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 40px' }}>
                    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <polygon points="12,2 22,20 2,20" stroke="#00C896" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                                <circle cx="12" cy="13" r="2.5" fill="#00C896" />
                            </svg>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>AEGIS</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Autonomous LP Manager · Algorand Testnet</span>
                        </div>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                            <a href="https://github.com" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>GitHub</a>
                            <a href={`https://lora.algokit.io/testnet/application/${import.meta.env.VITE_APP_ID || '755777633'}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>Testnet Explorer</a>
                            <a href="https://developer.algorand.org/algokit/" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                                <span>◈</span> AlgoKit
                            </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--accent-primary)' }}>◉</span> Data by Vestige.fi
                            <span style={{ margin: '0 8px' }}>·</span>
                            Built for RIFT 2026
                        </div>
                    </div>
                </footer>

            </div>{/* end content wrapper above matrix rain */}

            {/* ── ONBOARDING MODAL ─────────────── */}
            <AnimatePresence>
                {showOnboarding && (
                    <OnboardingModal wallet={wallet} onDone={handleOnboardingDone} />
                )}
            </AnimatePresence>
        </div>
    )
}
