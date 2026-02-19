/**
 * CreatePositionModal — allows users to set up a new LP position
 * with entry price, range bounds, and capital amount.
 * Calls setPosition() on the AEGIS smart contract.
 */
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLivePrice } from '../hooks/useLivePrice'
import { setPosition } from '../services/contractService'
import { savePosition } from '../services/supabaseService'

const APP_ID = parseInt(import.meta.env.VITE_APP_ID || '755790984')
// Creator address — only this wallet calls set_position on-chain
// Other wallets just save to Supabase (no on-chain tx needed for pool participants)
const CREATOR_ADDRESS = import.meta.env.VITE_CREATOR_ADDRESS || null

export default function CreatePositionModal({ isOpen, onClose, wallet, onSuccess }) {
    const { currentPrice } = useLivePrice()

    // Form state — auto-populate from live price
    const [entryPrice, setEntryPrice] = useState('')
    const [lowerBound, setLowerBound] = useState('')
    const [upperBound, setUpperBound] = useState('')
    const [capitalUsdc, setCapitalUsdc] = useState('5000')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [rangeWidth, setRangeWidth] = useState(20) // ±20% default

    // Auto-fill from live price
    useEffect(() => {
        if (currentPrice > 0 && !entryPrice) {
            const p = currentPrice
            setEntryPrice(p.toFixed(4))
            setLowerBound((p * (1 - rangeWidth / 100)).toFixed(4))
            setUpperBound((p * (1 + rangeWidth / 100)).toFixed(4))
        }
    }, [currentPrice])

    // Update bounds when range width slider changes
    const handleRangeChange = (width) => {
        setRangeWidth(width)
        const p = parseFloat(entryPrice) || currentPrice
        if (p > 0) {
            setLowerBound((p * (1 - width / 100)).toFixed(4))
            setUpperBound((p * (1 + width / 100)).toFixed(4))
        }
    }

    const handleSubmit = async () => {
        setError('')
        const entry = parseFloat(entryPrice)
        const lower = parseFloat(lowerBound)
        const upper = parseFloat(upperBound)
        const capital = parseFloat(capitalUsdc)

        if (!entry || !lower || !upper || !capital) {
            setError('All fields are required')
            return
        }
        if (lower >= upper) {
            setError('Lower bound must be less than upper bound')
            return
        }
        if (entry < lower || entry > upper) {
            setError('Entry price must be within range bounds')
            return
        }
        if (capital <= 0) {
            setError('Capital must be positive')
            return
        }
        if (!wallet?.address) {
            setError('Connect your wallet first')
            return
        }

        setSubmitting(true)
        try {
            const openTimestamp = Math.floor(Date.now() / 1000)
            const isCreator = CREATOR_ADDRESS
                ? wallet.address === CREATOR_ADDRESS
                : false  // if CREATOR_ADDRESS not set, treat all as pool participants

            let txId = 'supabase-only'

            if (isCreator) {
                // ── Creator: call set_position on-chain ─────────────────
                const txn = await setPosition(APP_ID, entry, lower, upper, capital, wallet.address)
                const algosdk = (await import('algosdk')).default
                const client = new algosdk.Algodv2('', import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud', '')
                txId = await wallet.signAndSubmit(txn, client)
            }
            // All wallets (creator + participants): save to Supabase ────
            await savePosition(wallet.address, {
                entryPrice: entry,
                lowerBound: lower,
                upperBound: upper,
                capitalUsdc: capital,
                openTimestamp,
                appId: APP_ID,
            })

            onSuccess?.({
                txId,
                entry,
                lower,
                upper,
                capital,
                openTimestamp,
                positionData: {
                    entryPrice: entry,
                    lowerBound: lower,
                    upperBound: upper,
                    capitalUsdc: capital,
                    openTimestamp,
                    totalRebalances: 0,
                    lastRebalanceTimestamp: 0,
                    depositedAlgo: 0,
                    depositedUsdc: 0,
                    totalDeposits: 0,
                    totalWithdrawals: 0,
                    agentAuthorized: false,
                    totalDecisions: 0,
                    lastDecisionTimestamp: 0,
                    lastDecisionAction: 0,
                    appId: APP_ID,
                    source: 'local-create',
                },
            })
            onClose()
        } catch (e) {
            console.error('setPosition failed:', e)
            setError(e.message || 'Transaction failed')
        }
        setSubmitting(false)
    }

    if (!isOpen) return null

    const rangePercent = ((parseFloat(upperBound) - parseFloat(lowerBound)) / parseFloat(entryPrice) * 100) || 0
    const pricePosInRange = currentPrice > 0 && parseFloat(lowerBound) > 0 && parseFloat(upperBound) > 0
        ? Math.max(0, Math.min(100, ((currentPrice - parseFloat(lowerBound)) / (parseFloat(upperBound) - parseFloat(lowerBound))) * 100))
        : 50

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 16, width: 500, maxHeight: '90vh', overflow: 'auto',
                        padding: 32,
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700 }}>New Position</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>ALGO/USDC · Algorand Testnet</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                        }}>✕</button>
                    </div>

                    {/* Live price indicator */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', background: 'rgba(0,200,150,0.06)',
                        border: '1px solid rgba(0,200,150,0.15)', borderRadius: 8, marginBottom: 20,
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00C896', animation: 'livePulse 2s infinite' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live Price</span>
                        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 16, fontWeight: 700, color: '#00C896', marginLeft: 'auto' }}>
                            ${currentPrice > 0 ? currentPrice.toFixed(4) : '—'}
                        </span>
                    </div>

                    {/* Entry Price */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            ENTRY PRICE (USDC)
                        </label>
                        <input
                            type="number" step="0.0001" value={entryPrice}
                            onChange={e => setEntryPrice(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                            placeholder="0.1888"
                        />
                        <button
                            onClick={() => { setEntryPrice(currentPrice.toFixed(4)); handleRangeChange(rangeWidth) }}
                            style={{
                                marginTop: 6, padding: '4px 10px', fontSize: 10, fontWeight: 600,
                                background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.2)',
                                borderRadius: 4, color: '#00C896', cursor: 'pointer',
                            }}
                        >Use Live Price</button>
                    </div>

                    {/* Range Width Slider */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                RANGE WIDTH
                            </label>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono,monospace' }}>
                                ±{rangeWidth}%
                            </span>
                        </div>
                        <input
                            type="range" min="5" max="50" step="1" value={rangeWidth}
                            onChange={e => handleRangeChange(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                            <span>Tight (±5%)</span>
                            <span>Wide (±50%)</span>
                        </div>
                    </div>

                    {/* Range bounds display */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                LOWER BOUND
                            </label>
                            <input
                                type="number" step="0.0001" value={lowerBound}
                                onChange={e => setLowerBound(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 14px', background: 'rgba(239,68,68,0.05)',
                                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#EF4444',
                                    fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                UPPER BOUND
                            </label>
                            <input
                                type="number" step="0.0001" value={upperBound}
                                onChange={e => setUpperBound(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 14px', background: 'rgba(16,185,129,0.05)',
                                    border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, color: '#10B981',
                                    fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                                }}
                            />
                        </div>
                    </div>

                    {/* Visual range bar */}
                    <div style={{
                        background: 'var(--bg-surface, rgba(0,0,0,0.2))', borderRadius: 8,
                        padding: '12px 16px', marginBottom: 20,
                    }}>
                        <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                            <div style={{
                                position: 'absolute', left: 0, right: 0, height: '100%',
                                background: 'linear-gradient(90deg, #EF4444, #10B981)', borderRadius: 4, opacity: 0.3,
                            }} />
                            <div style={{
                                position: 'absolute', left: `${pricePosInRange}%`, top: -4,
                                width: 16, height: 16, borderRadius: '50%',
                                background: '#00C896', border: '2px solid var(--bg-card)',
                                transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(0,200,150,0.4)',
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, fontFamily: 'JetBrains Mono,monospace' }}>
                            <span style={{ color: '#EF4444' }}>${lowerBound}</span>
                            <span style={{ color: 'var(--text-muted)' }}>Current: ${currentPrice.toFixed(4)}</span>
                            <span style={{ color: '#10B981' }}>${upperBound}</span>
                        </div>
                    </div>

                    {/* Capital */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            CAPITAL (USDC)
                        </label>
                        <input
                            type="number" step="100" value={capitalUsdc}
                            onChange={e => setCapitalUsdc(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                            placeholder="5000"
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {[1000, 2500, 5000, 10000].map(v => (
                                <button key={v} onClick={() => setCapitalUsdc(String(v))} style={{
                                    padding: '4px 10px', fontSize: 10, fontWeight: 600,
                                    background: capitalUsdc === String(v) ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${capitalUsdc === String(v) ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
                                    borderRadius: 4, color: capitalUsdc === String(v) ? '#00C896' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                }}>${v.toLocaleString()}</button>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div style={{
                        background: 'var(--bg-surface, rgba(0,0,0,0.2))', borderRadius: 8,
                        padding: '12px 16px', marginBottom: 20, fontSize: 12,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Range Width</span>
                            <span style={{ fontWeight: 600 }}>{rangePercent.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Est. Daily Fees (35% APR)</span>
                            <span style={{ fontWeight: 600, color: '#10B981' }}>+${((parseFloat(capitalUsdc) || 0) * 0.35 / 365).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Contract</span>
                            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>App ID {APP_ID}</span>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '8px 12px', marginBottom: 16, borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#EF4444', fontSize: 12,
                        }}>{error}</div>
                    )}

                    {/* Submit */}
                    <motion.button
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                        disabled={submitting || !wallet?.address}
                        onClick={handleSubmit}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                            border: 'none', cursor: submitting ? 'wait' : 'pointer',
                            background: wallet?.address
                                ? 'linear-gradient(135deg, #00C896, #00d4aa)'
                                : 'rgba(255,255,255,0.1)',
                            color: wallet?.address ? '#000' : 'var(--text-muted)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {submitting ? 'Submitting Transaction...' : wallet?.address ? 'Create Position' : 'Connect Wallet First'}
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
