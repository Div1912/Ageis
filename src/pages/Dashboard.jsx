import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useWallet } from '../hooks/useWallet'
import { useLivePrice } from '../hooks/useLivePrice'
import { usePosition } from '../hooks/usePosition'
import { useDerivedStats } from '../hooks/useDerivedStats'
import { useSafeToast } from '../hooks/useSafeToast'
import { fetchRebalanceHistoryFromAPI } from '../services/apiService'
import { fetchAssetBalance } from '../services/indexerService'
import RebalanceTriggerButton from '../components/RebalanceTriggerButton'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

// Testnet USDC Asset ID
const USDC_ASSET_ID = 10458941

// Check for missing env vars (common cause of persistence failure)
function EnvVarAlert() {
    const missing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!missing) return null
    return (
        <div style={{
            background: '#FEF2F2', border: '1px solid #F87171', color: '#B91C1C',
            padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13,
            maxWidth: 600, margin: '20px auto 0', textAlign: 'left'
        }}>
            <strong>⚠️ Configuration Error:</strong> Supabase keys are missing.<br />
            Positions will not be saved across devices.<br />
            Please add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your Vercel Project Settings.
        </div>
    )
}

function WalletEmptyState({ wallet }) {
    const navigate = useNavigate()
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 'calc(100vh - 112px)', textAlign: 'center', padding: 40,
        }}>
            <EnvVarAlert />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: 28, opacity: 0.5 }}>
                    <circle cx="60" cy="60" r="58" stroke="var(--border)" strokeWidth="2" />
                    <path d="M60 30V90M30 60H90" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <h2 style={{ fontSize: 22, marginBottom: 10 }}>Connect your wallet</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 28px', lineHeight: 1.7 }}>
                    Connect your Pera Wallet to view your balance and join the global liquidity pool.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={wallet.connect}>
                        Connect Wallet
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/pool')}>
                        View Pool →
                    </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 20 }}>
                    Testnet only · No mainnet funds at risk
                </p>
            </motion.div>
        </div>
    )
}

function WalletBalanceCard({ wallet, usdcBalance, currentPrice }) {
    const algoValue = (wallet.balance || 0) * currentPrice
    // USDC is 1:1 USD basically
    const totalValue = algoValue + (usdcBalance || 0)

    return (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                My Wallet Balance
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                {/* ALGO */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 18 }}>A</span>
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>
                            {wallet.balance?.toFixed(2) || '0.00'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ALGO (~${algoValue.toFixed(2)})
                        </div>
                    </div>
                </div>

                {/* USDC */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2775CA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>$</span>
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace' }}>
                            {usdcBalance?.toFixed(2) || '0.00'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            USDC (Testnet)
                        </div>
                    </div>
                </div>

                {/* Total */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>
                            ${totalValue.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Est. Total Value
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ActivePoolCard({ position, navigate }) {
    // Show user's share if they have one
    const userShare = position.capitalUsdc || 0
    const hasShare = userShare > 0

    return (
        <div className="card" style={{ padding: 24, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, padding: '6px 12px', background: 'rgba(16,185,129,0.1)', borderBottomLeftRadius: 10, fontSize: 11, fontWeight: 700, color: '#10B981' }}>
                ACTIVE · AEGIS AGENT
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
                Global AEGIS Pool
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                        ALGO / USDC
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Fee Tier: 0.3% · Auto-Rebalancing
                    </div>
                </div>

                {hasShare ? (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>YOUR SHARE</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>
                            ${userShare.toFixed(2)}
                        </div>
                    </div>
                ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        You have no liquidity in this pool.
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-secondary" onClick={() => navigate('/swap')} style={{ padding: '8px 16px', fontSize: 13 }}>
                        Swap
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/pool')} style={{ padding: '8px 16px', fontSize: 13 }}>
                        {hasShare ? 'Manage Liquidity' : 'Join Pool'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Counts up seconds since a timestamp
function useSecondsAgo(ts) {
    const [secs, setSecs] = useState(0)
    useEffect(() => {
        const iv = setInterval(() => setSecs(Math.floor((Date.now() - ts) / 1000)), 1000)
        return () => clearInterval(iv)
    }, [ts])
    return secs
}

export default function Dashboard({ wallet }) {
    const navigate = useNavigate()
    const { currentPrice, isLoading: priceLoading, lastFetched } = useLivePrice()
    const position = usePosition(wallet?.address)  // wallet-scoped, but falls back to Global
    const stats = useDerivedStats({ position, currentPrice })
    const addToast = useSafeToast()

    const [usdcBalance, setUsdcBalance] = useState(0)
    const [priceFlash, setPriceFlash] = useState(false)
    const [rebalanceHistory, setRebalanceHistory] = useState([])
    const secsAgo = useSecondsAgo(lastFetched || Date.now())

    // Fetch USDC balance
    useEffect(() => {
        if (wallet?.address) {
            fetchAssetBalance(wallet.address, USDC_ASSET_ID).then(setUsdcBalance)
        } else {
            setUsdcBalance(0)
        }
    }, [wallet?.address, wallet?.balance]) // Re-fetch when ALGO balance changes (signal of activity)

    // Fetch rebalance history
    useEffect(() => {
        fetchRebalanceHistoryFromAPI().then(setRebalanceHistory).catch(() => { })
    }, [])

    // Flash when price updates
    useEffect(() => {
        if (!priceLoading) {
            setPriceFlash(true)
            const t = setTimeout(() => setPriceFlash(false), 800)
            return () => clearTimeout(t)
        }
    }, [currentPrice])

    // Still resolving session from storage
    if (wallet.isReconnecting) {
        return (
            <div className="page-base" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="refresh-spinner" style={{ width: 32, height: 32, borderWidth: 3, margin: '0 auto 16px' }} />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Restoring session…</p>
                </div>
            </div>
        )
    }

    // Show empty state if wallet disconnected
    if (!wallet.isConnected) {
        return (
            <div className="page-base">
                <Navbar wallet={wallet} isDashboard={true} />
                <WalletEmptyState wallet={wallet} />
            </div>
        )
    }

    return (
        <div className="page-base">
            <Navbar wallet={wallet} isDashboard={true} />
            <EnvVarAlert />

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 40px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Overview of your wallet and pool activity</p>
                    </div>
                    {/* Live price badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px',
                        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6,
                        fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 700,
                        color: priceFlash ? 'var(--accent-primary)' : 'var(--text-primary)',
                        transition: 'color 0.4s',
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block', animation: 'livePulse 2s infinite' }} />
                        ${currentPrice.toFixed(4)}
                    </div>
                </div>

                {/* 1. Wallet Balance */}
                <WalletBalanceCard wallet={wallet} usdcBalance={usdcBalance} currentPrice={currentPrice} />

                {/* 2. Active Pool Status */}
                <ActivePoolCard position={position} navigate={navigate} />

                {/* 3. Agent Status (ReadOnly) */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Agent Activity
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
                                <span style={{ fontWeight: 600, fontSize: 13 }}>Agent Online</span>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {rebalanceHistory.length > 0
                                    ? `Last action ${useSecondsAgo(rebalanceHistory[0].timestamp * 1000)}s ago`
                                    : 'No recent actions'}
                            </span>
                        </div>

                        {/* Simple list of recent actions */}
                        {rebalanceHistory.slice(0, 3).map((tx, i) => (
                            <div key={tx.txId} style={{
                                padding: '10px 0', borderTop: '1px solid var(--border)',
                                display: 'flex', justifyContent: 'space-between', fontSize: 12
                            }}>
                                <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>REBALANCE</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    TX: <a href={`https://lora.algokit.io/testnet/transaction/${tx.txId}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{tx.txId.slice(0, 8)}…</a>
                                </span>
                            </div>
                        ))}
                        {rebalanceHistory.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Atomic agent is monitoring price...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
