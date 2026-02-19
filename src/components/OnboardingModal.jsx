/**
 * OnboardingModal — multi-step wizard for new users.
 *
 * Steps:
 *   1. Set range (entry price, lower, upper)
 *   2. Set capital (USDC amount)
 *   3. Deposit funds (ALGO + USDC)
 *   4. Authorize agent key
 *   5. Confirm & deploy
 */
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLivePrice } from '../hooks/useLivePrice'
import { setPosition } from '../services/contractService'

const STEPS = [
    { title: 'Set Price Range', icon: '◈' },
    { title: 'Set Capital', icon: '$' },
    { title: 'Deposit Funds', icon: '↓' },
    { title: 'Authorize Agent', icon: '⚡' },
    { title: 'Confirm & Launch', icon: '✓' },
]

export default function OnboardingModal({ wallet, isOpen, onClose, addToast }) {
    const [step, setStep] = useState(0)
    const { currentPrice } = useLivePrice()
    const [entry, setEntry] = useState('')
    const [lower, setLower] = useState('')
    const [upper, setUpper] = useState('')
    const [capital, setCapital] = useState('')
    const [algoDeposit, setAlgoDeposit] = useState('')
    const [usdcDeposit, setUsdcDeposit] = useState('')
    const [agentAddress, setAgentAddress] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isComplete, setIsComplete] = useState(false)

    useEffect(() => {
        if (currentPrice > 0 && !entry) {
            setEntry(currentPrice.toFixed(4))
            setLower((currentPrice * 0.82).toFixed(4))
            setUpper((currentPrice * 1.22).toFixed(4))
        }
    }, [currentPrice])

    if (!isOpen) return null

    const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
    const prev = () => setStep(s => Math.max(s - 1, 0))

    const handleConfirm = async () => {
        setIsSubmitting(true)
        try {
            const entryVal = Math.round(parseFloat(entry) * 1000)
            const lowerVal = Math.round(parseFloat(lower) * 1000)
            const upperVal = Math.round(parseFloat(upper) * 1000)
            const capitalVal = Math.round(parseFloat(capital) * 100)

            const txns = await setPosition(wallet.address, entryVal, lowerVal, upperVal, capitalVal)
            const result = await wallet.signAndSend(txns)

            setIsComplete(true)
            if (addToast) addToast('Position created successfully! 🎉', 'success')
        } catch (err) {
            if (addToast) addToast(`Error: ${err.message}`, 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    const fieldStyle = {
        width: '100%', padding: '10px 14px', fontSize: 14,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 6, color: 'var(--text-primary)', outline: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        transition: 'border-color 0.15s',
    }

    const labelStyle = {
        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
        marginBottom: 6, display: 'block', letterSpacing: '0.04em',
        textTransform: 'uppercase',
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        }} onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ duration: 0.25 }}
                style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 12, maxWidth: 480, width: '90%', padding: '28px 32px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {isComplete ? (
                    /* Success state */
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                        <h3 style={{ fontSize: 20, marginBottom: 8 }}>Position Created!</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                            Your LP position is now active on Algorand Testnet.
                            AEGIS will start monitoring and rebalancing automatically.
                        </p>
                        <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>
                            Go to Dashboard →
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Step indicator */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
                            {STEPS.map((s, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 700,
                                        background: i <= step ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                        color: i <= step ? '#000' : 'var(--text-muted)',
                                        transition: 'all 0.2s',
                                    }}>
                                        {i < step ? '✓' : s.icon}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div style={{
                                            width: 20, height: 1,
                                            background: i < step ? 'var(--accent-primary)' : 'var(--border)',
                                        }} />
                                    )}
                                </div>
                            ))}
                        </div>

                        <h3 style={{ fontSize: 17, marginBottom: 4 }}>{STEPS[step].title}</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                            Step {step + 1} of {STEPS.length}
                        </p>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Step 1: Price Range */}
                                {step === 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div>
                                            <label style={labelStyle}>Entry Price (ALGO/USDC)</label>
                                            <input type="number" step="0.0001" value={entry} onChange={e => setEntry(e.target.value)} style={fieldStyle}
                                                onFocus={e => e.target.style.borderColor = 'rgba(0,200,150,0.4)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label style={labelStyle}>Lower Bound</label>
                                                <input type="number" step="0.0001" value={lower} onChange={e => setLower(e.target.value)} style={fieldStyle} />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Upper Bound</label>
                                                <input type="number" step="0.0001" value={upper} onChange={e => setUpper(e.target.value)} style={fieldStyle} />
                                            </div>
                                        </div>
                                        <div style={{ padding: '8px 12px', background: 'rgba(0,200,150,0.05)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', border: '1px solid rgba(0,200,150,0.1)' }}>
                                            💡 Range auto-calculated at ±18% from live price (${currentPrice.toFixed(4)})
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Capital */}
                                {step === 1 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div>
                                            <label style={labelStyle}>Capital (USDC)</label>
                                            <input type="number" step="100" value={capital} onChange={e => setCapital(e.target.value)}
                                                placeholder="5000" style={fieldStyle}
                                                onFocus={e => e.target.style.borderColor = 'rgba(0,200,150,0.4)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                            <div className="card" style={{ padding: 12 }}>
                                                <span className="section-label" style={{ display: 'block', marginBottom: 4 }}>Est. Daily Fees</span>
                                                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, fontWeight: 700, color: 'var(--accent-positive)' }}>
                                                    +${((parseFloat(capital) || 0) * 0.003).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="card" style={{ padding: 12 }}>
                                                <span className="section-label" style={{ display: 'block', marginBottom: 4 }}>Est. Weekly</span>
                                                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, fontWeight: 700, color: 'var(--accent-positive)' }}>
                                                    +${((parseFloat(capital) || 0) * 0.003 * 7).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Deposit */}
                                {step === 2 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ padding: '10px 14px', background: 'rgba(0,200,150,0.04)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', border: '1px solid rgba(0,200,150,0.1)' }}>
                                            ⚡ Deposit ALGO and USDC into the AEGIS vault. The agent will manage swaps between these tokens automatically.
                                        </div>
                                        <div>
                                            <label style={labelStyle}>ALGO Amount</label>
                                            <input type="number" step="1" value={algoDeposit} onChange={e => setAlgoDeposit(e.target.value)}
                                                placeholder="15" style={fieldStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>USDC Amount</label>
                                            <input type="number" step="100" value={usdcDeposit} onChange={e => setUsdcDeposit(e.target.value)}
                                                placeholder="2500" style={fieldStyle} />
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            Wallet balance: {wallet?.balance?.toFixed(2) ?? '—'} ALGO
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Authorize Agent */}
                                {step === 3 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, fontSize: 12, color: '#F59E0B', border: '1px solid rgba(245,158,11,0.15)' }}>
                                            🔑 The agent key can ONLY rebalance your position. It CANNOT withdraw your funds. You can revoke at any time.
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Agent Address (Optional)</label>
                                            <input type="text" value={agentAddress} onChange={e => setAgentAddress(e.target.value)}
                                                placeholder="ALGO... (58 character address)" style={{ ...fieldStyle, fontSize: 11 }}
                                                onFocus={e => e.target.style.borderColor = 'rgba(0,200,150,0.4)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: agentAddress ? '#10B981' : '#6B7280' }} />
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {agentAddress ? 'Agent will be authorized on deploy' : 'Skip to authorize later'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Step 5: Confirm */}
                                {step === 4 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div className="card" style={{ padding: 16 }}>
                                            {[
                                                { l: 'Entry Price', v: `$${entry}` },
                                                { l: 'Range', v: `$${lower} → $${upper}` },
                                                { l: 'Capital', v: `$${capital || '0'} USDC` },
                                                { l: 'Deposit', v: `${algoDeposit || '0'} ALGO + ${usdcDeposit || '0'} USDC` },
                                                { l: 'Agent', v: agentAddress ? `${agentAddress.slice(0, 8)}…` : 'Not set' },
                                                { l: 'Network', v: 'Algorand Testnet' },
                                            ].map(({ l, v }) => (
                                                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</span>
                                                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-primary)' }}>{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.05)', borderRadius: 6, fontSize: 11, color: 'var(--accent-positive)', border: '1px solid rgba(16,185,129,0.1)' }}>
                                            ✓ Your funds are secured by the AEGIS vault contract. Only you can withdraw.
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Navigation */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                            <button
                                className="btn-secondary"
                                onClick={step === 0 ? onClose : prev}
                                style={{ fontSize: 12 }}
                            >
                                {step === 0 ? 'Cancel' : '← Back'}
                            </button>

                            {step < STEPS.length - 1 ? (
                                <button className="btn-primary" onClick={next} style={{ fontSize: 12 }}>
                                    Next →
                                </button>
                            ) : (
                                <button
                                    className="btn-primary"
                                    onClick={handleConfirm}
                                    disabled={isSubmitting}
                                    style={{ fontSize: 12, minWidth: 140 }}
                                >
                                    {isSubmitting ? 'Deploying…' : '🚀 Launch Position'}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    )
}
