/**
 * PoolSwap — Multi-user demo hub for the AEGIS pool.
 * 
 * Features:
 *   1. SWAP: Trade ALGO ↔ USDC through the pool (generates fees for LPs)
 *   2. JOIN POOL: Second user can deposit into the shared vault
 *   3. DEPOSITORS: Shows all participants and their share of the pool
 *   4. FEE TRACKER: Running tally of fees earned from swaps this session
 */
import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import JoinPoolModal from '../components/JoinPoolModal'
import PoolDepositorsPanel from '../components/PoolDepositorsPanel'
import { useLivePrice } from '../hooks/useLivePrice'

const APP_ID = parseInt(import.meta.env.VITE_APP_ID || '755790672')
const USDC_ASSET_ID = 10458941 // Testnet USDC

export default function PoolSwap({ wallet }) {
    const { currentPrice, isLoading: priceLoading } = useLivePrice()
    const location = useLocation()
    const [tab, setTab] = useState('swap') // 'swap' | 'pool'
    const [direction, setDirection] = useState('ALGO_TO_USDC')
    const [amount, setAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [txHistory, setTxHistory] = useState([])
    const [success, setSuccess] = useState(null)
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [depositorsRefresh, setDepositorsRefresh] = useState(0)

    // Parse URL query for tab
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const t = params.get('tab')
        if (t === 'pool' || t === 'swap') {
            setTab(t)
        }
    }, [location.search])

    // Cumulative fee tracking
    const totalFeesEarned = txHistory.reduce((sum, tx) => sum + tx.fee, 0)
    const totalVolume = txHistory.reduce((sum, tx) => sum + tx.amountIn, 0)

    const outputAmount = direction === 'ALGO_TO_USDC'
        ? ((parseFloat(amount) || 0) * currentPrice * 0.997).toFixed(4)
        : ((parseFloat(amount) || 0) / currentPrice * 0.997).toFixed(4)

    const fee = ((parseFloat(amount) || 0) * 0.003).toFixed(6)

    const handleSwap = async () => {
        setError('')
        setSuccess(null)
        const amt = parseFloat(amount)
        if (!amt || amt <= 0) { setError('Enter a positive amount'); return }
        if (!wallet?.address) { setError('Connect your wallet first'); return }

        setSubmitting(true)
        try {
            const algosdk = (await import('algosdk')).default
            const client = new algosdk.Algodv2('', import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud', '')
            const suggestedParams = await client.getTransactionParams().do()
            const POOL_ADDRESS = import.meta.env.VITE_TINYMAN_POOL_ADDRESS || wallet.address

            let txn
            if (direction === 'ALGO_TO_USDC') {
                // ALGO Payment
                txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                    from: wallet.address, to: POOL_ADDRESS,
                    amount: Math.round(amt * 1e6),
                    suggestedParams,
                    note: new TextEncoder().encode(`AEGIS-SWAP:ALGO>${(amt * currentPrice).toFixed(2)}USDC`),
                })
            } else {
                // USDC Asset Transfer
                const algoEquiv = amt / currentPrice
                txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    from: wallet.address,
                    to: POOL_ADDRESS,
                    assetIndex: USDC_ASSET_ID,
                    amount: Math.round(amt * 1e6), // USDC has 6 decimals
                    suggestedParams,
                    note: new TextEncoder().encode(`AEGIS-SWAP:${amt}USDC>ALGO`),
                })
            }

            const txId = await wallet.signAndSubmit(txn, client)
            const newTx = {
                id: txId, direction, amountIn: amt,
                amountOut: parseFloat(outputAmount),
                fee: parseFloat(fee), price: currentPrice,
                timestamp: Date.now(),
            }
            setTxHistory(prev => [newTx, ...prev])
            setSuccess(`Swap executed! TX: ${txId?.slice(0, 12)}…`)
            setAmount('')
        } catch (e) {
            console.error('Swap failed:', e)
            setError(e.message || 'Swap transaction failed')
        }
        setSubmitting(false)
    }

    const handleJoinSuccess = useCallback(({ txId }) => {
        setDepositorsRefresh(n => n + 1)
        setSuccess(`Joined pool! TX: ${txId?.slice(0, 12)}…`)
    }, [])

    return (
        <div className="page-base">
            <Navbar wallet={wallet} isDashboard={true} />

            <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', marginBottom: 28 }}
                >
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Multi-User Pool Demo</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Swap, join the pool, and watch LP positions earn fees in real-time
                    </p>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', marginTop: 12,
                        background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.15)',
                        borderRadius: 999, fontSize: 12, color: 'var(--accent-primary)',
                        fontFamily: 'JetBrains Mono,monospace',
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C896', animation: 'livePulse 2s infinite', display: 'inline-block' }} />
                        ALGO/USDC · ${priceLoading ? '…' : currentPrice.toFixed(4)}
                    </div>
                </motion.div>

                {/* ── Fee Earnings Tracker ── */}
                {txHistory.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                            marginBottom: 16,
                        }}
                    >
                        <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>SWAPS</div>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace' }}>{txHistory.length}</div>
                        </div>
                        <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>VOLUME</div>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: '#60A5FA' }}>
                                {totalVolume.toFixed(2)}
                            </div>
                        </div>
                        <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginBottom: 4 }}>LP FEES EARNED</div>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>
                                +{totalFeesEarned.toFixed(6)}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Tab switcher ── */}
                <div style={{
                    display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10,
                    overflow: 'hidden', border: '1px solid var(--border)',
                }}>
                    {[
                        { key: 'swap', label: '⇄ Swap', color: '#00C896' },
                        { key: 'pool', label: '🏊 Pool', color: '#6366F1' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                flex: 1, padding: '11px 16px', fontSize: 13, fontWeight: 700,
                                background: tab === t.key ? `${t.color}15` : 'transparent',
                                color: tab === t.key ? t.color : 'var(--text-secondary)',
                                border: 'none', borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                        >{t.label}</button>
                    ))}
                </div>

                {/* ── SWAP TAB ── */}
                <AnimatePresence mode="wait">
                    {tab === 'swap' && (
                        <motion.div key="swap"
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="card" style={{ padding: 24 }}>
                                {/* Direction toggle */}
                                <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                    <button onClick={() => setDirection('ALGO_TO_USDC')} style={{
                                        flex: 1, padding: '9px 14px', fontSize: 12, fontWeight: 700,
                                        background: direction === 'ALGO_TO_USDC' ? 'var(--accent-primary)' : 'transparent',
                                        color: direction === 'ALGO_TO_USDC' ? '#000' : 'var(--text-secondary)',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                    }}>ALGO → USDC</button>
                                    <button onClick={() => setDirection('USDC_TO_ALGO')} style={{
                                        flex: 1, padding: '9px 14px', fontSize: 12, fontWeight: 700,
                                        background: direction === 'USDC_TO_ALGO' ? 'var(--accent-primary)' : 'transparent',
                                        color: direction === 'USDC_TO_ALGO' ? '#000' : 'var(--text-secondary)',
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                    }}>USDC → ALGO</button>
                                </div>

                                {/* Input */}
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                        {direction === 'ALGO_TO_USDC' ? 'ALGO AMOUNT' : 'USDC AMOUNT'}
                                    </label>
                                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                                        placeholder="0.00" style={{
                                            width: '100%', padding: '11px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                            border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                            fontSize: 15, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                        {[1, 5, 10, 25, 50].map(v => (
                                            <button key={v} onClick={() => setAmount(String(v))} style={{
                                                padding: '4px 10px', fontSize: 10, fontWeight: 600,
                                                background: amount === String(v) ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${amount === String(v) ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
                                                borderRadius: 4, color: amount === String(v) ? '#00C896' : 'var(--text-secondary)',
                                                cursor: 'pointer',
                                            }}>{v}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* Preview */}
                                <div style={{ padding: '12px 14px', background: 'rgba(0,200,150,0.04)', border: '1px solid rgba(0,200,150,0.1)', borderRadius: 8, marginBottom: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>You receive (est.)</span>
                                        <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color: '#10B981' }}>
                                            {outputAmount} {direction === 'ALGO_TO_USDC' ? 'USDC' : 'ALGO'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Pool fee (0.3%)</span>
                                        <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--accent-negative)' }}>
                                            {fee} {direction === 'ALGO_TO_USDC' ? 'ALGO' : 'USDC'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Rate</span>
                                        <span style={{ fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-secondary)' }}>
                                            1 ALGO = ${currentPrice.toFixed(4)} USDC
                                        </span>
                                    </div>
                                </div>

                                {/* Fee info banner */}
                                <div style={{
                                    padding: '10px 14px', background: 'rgba(245,158,11,0.05)',
                                    border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8, marginBottom: 16,
                                    fontSize: 11, color: '#F59E0B',
                                }}>
                                    ⚡ Your 0.3% fee goes directly to LP depositors. Every swap grows the pool!
                                </div>

                                {error && <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12 }}>{error}</div>}
                                {success && <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981', fontSize: 12 }}>{success}</div>}

                                <motion.button
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    disabled={submitting || !wallet?.address}
                                    onClick={handleSwap}
                                    style={{
                                        width: '100%', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                                        border: 'none', cursor: submitting ? 'wait' : 'pointer',
                                        background: wallet?.address ? 'linear-gradient(135deg, #00C896, #00d4aa)' : 'rgba(255,255,255,0.1)',
                                        color: wallet?.address ? '#000' : 'var(--text-muted)', transition: 'all 0.2s',
                                    }}
                                >
                                    {submitting ? 'Swapping…' : wallet?.address ? `Swap ${direction === 'ALGO_TO_USDC' ? 'ALGO → USDC' : 'USDC → ALGO'}` : 'Connect Wallet First'}
                                </motion.button>
                            </div>

                            {/* Swap history */}
                            {txHistory.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 16, marginTop: 12 }}>
                                    <h4 style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                        SWAP HISTORY ({txHistory.length})
                                    </h4>
                                    {txHistory.map((tx, i) => (
                                        <div key={tx.id || i} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '6px 0', borderBottom: i < txHistory.length - 1 ? '1px solid var(--border)' : 'none',
                                            fontSize: 11,
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 600 }}>{tx.direction === 'ALGO_TO_USDC' ? 'ALGO → USDC' : 'USDC → ALGO'}</span>
                                                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{tx.amountIn.toFixed(2)} → {tx.amountOut.toFixed(4)}</span>
                                                <span style={{ color: '#10B981', marginLeft: 8, fontSize: 10 }}>fee: {tx.fee.toFixed(6)}</span>
                                            </div>
                                            <a href={`https://lora.algokit.io/testnet/transaction/${tx.id}`} target="_blank" rel="noreferrer"
                                                style={{ color: 'var(--accent-primary)', fontSize: 10, textDecoration: 'none' }}
                                            >{tx.id?.slice(0, 8)}… ↗</a>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* ── POOL TAB ── */}
                    {tab === 'pool' && (
                        <motion.div key="pool"
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Join Pool CTA */}
                            <div className="card" style={{ padding: 24, textAlign: 'center', marginBottom: 14 }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>🏊</div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Join the AEGIS Pool</h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, maxWidth: 380, margin: '0 auto 16px' }}>
                                    Deposit ALGO or USDC into the shared vault. The AEGIS agent automatically manages your liquidity position,
                                    rebalancing to maximize fee income. You earn a proportional share of all pool fees.
                                </p>

                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20,
                                }}>
                                    <div style={{ padding: '10px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.1)' }}>
                                        <div style={{ fontSize: 10, color: '#818CF8', fontWeight: 600, marginBottom: 2 }}>POOL</div>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>ALGO/USDC</div>
                                    </div>
                                    <div style={{ padding: '10px', background: 'rgba(16,185,129,0.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.1)' }}>
                                        <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginBottom: 2 }}>FEE TIER</div>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>0.3%</div>
                                    </div>
                                    <div style={{ padding: '10px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.1)' }}>
                                        <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginBottom: 2 }}>AGENT</div>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>AEGIS v2</div>
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowJoinModal(true)}
                                    disabled={!wallet?.address}
                                    style={{
                                        padding: '13px 40px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                                        border: 'none', cursor: wallet?.address ? 'pointer' : 'not-allowed',
                                        background: wallet?.address ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.1)',
                                        color: wallet?.address ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s',
                                    }}
                                >
                                    {wallet?.address ? '🏊 Deposit & Join Pool' : 'Connect Wallet First'}
                                </motion.button>
                            </div>

                            {/* Depositors panel */}
                            <PoolDepositorsPanel refreshTrigger={depositorsRefresh} />

                            {/* How fees work */}
                            <div className="card" style={{ padding: 16, marginTop: 14 }}>
                                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em' }}>
                                    HOW IT WORKS
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { icon: '1️⃣', text: 'You deposit ALGO or USDC into the shared vault' },
                                        { icon: '2️⃣', text: 'AEGIS agent opens a CLMM LP position on Pact' },
                                        { icon: '3️⃣', text: 'Traders swap through the pool → fees accumulate' },
                                        { icon: '4️⃣', text: 'Agent monitors price & rebalances to stay in-range' },
                                        { icon: '5️⃣', text: 'You earn a proportional share of all trading fees' },
                                    ].map(step => (
                                        <div key={step.icon} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)' }}>
                                            <span>{step.icon}</span>
                                            <span>{step.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>
                    Algorand Testnet · App ID {APP_ID} · Pool fees accrue to active LP positions
                </p>
            </div>

            {/* Join Pool Modal */}
            <JoinPoolModal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                wallet={wallet}
                onSuccess={handleJoinSuccess}
            />
        </div>
    )
}
