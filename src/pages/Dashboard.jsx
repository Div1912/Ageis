/**
 * Dashboard — full P&L command center with all features:
 * - Out-of-range alert banner
 * - Position health gauge + risk badge
 * - APR vs HODL chart
 * - Agent status panel with start/stop controls
 * - Live rebalance history + decision log
 * - Last-updated timer (counts up)
 * - Empty state for disconnected wallet
 * - Date range filter on charts
 * - Toast success after rebalance
 */
import React, { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import StatCard from '../components/StatCard'
import NetPnLPanel from '../components/NetPnLPanel'
import PriceRangeChart from '../components/PriceRangeChart'
import ILComparisonPanel from '../components/ILComparisonPanel'
import DecisionEnginePanel from '../components/DecisionEnginePanel'
import RebalanceHistoryTable from '../components/RebalanceHistoryTable'
import RebalanceTriggerButton from '../components/RebalanceTriggerButton'
import OutOfRangeAlert from '../components/OutOfRangeAlert'
import AgentStatusPanel from '../components/AgentStatusPanel'
import DecisionLogTable from '../components/DecisionLogTable'
import PositionHealthGauge from '../components/PositionHealthGauge'
import APRComparisonChart from '../components/APRComparisonChart'
import AgentPredictionPanel from '../components/AgentPredictionPanel'
import DepositModal from '../components/DepositModal'
import WithdrawModal from '../components/WithdrawModal'
import { useLivePrice } from '../hooks/useLivePrice'
import { usePosition } from '../hooks/usePosition'
import { useDerivedStats } from '../hooks/useDerivedStats'
import { fetchRebalanceHistoryFromAPI } from '../services/apiService'
import { ToastContext } from '../App'

const RANGES = ['7D', '30D', 'All Time']

// Safe toast hook — returns noop if context not available
function useSafeToast() {
    const ctx = useContext(ToastContext)
    return ctx?.addToast ?? (() => { })
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

// Full-page empty state when wallet not connected
function WalletEmptyState({ wallet }) {
    const navigate = useNavigate()
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 'calc(100vh - 112px)', textAlign: 'center', padding: 40,
        }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                {/* Illustration */}
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: 28, opacity: 0.5 }}>
                    <circle cx="60" cy="60" r="58" stroke="#1E2730" strokeWidth="2" />
                    <rect x="30" y="45" width="60" height="40" rx="6" stroke="#1E2730" strokeWidth="1.5" />
                    <rect x="30" y="45" width="60" height="14" rx="6" fill="#1E2730" />
                    <circle cx="82" cy="68" r="6" fill="#00C896" opacity="0.6" />
                </svg>
                <h2 style={{ fontSize: 22, marginBottom: 10 }}>Connect your wallet</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 28px', lineHeight: 1.7 }}>
                    Connect your Pera Wallet to view your real-time LP position, P&L, and rebalance triggers.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={wallet.connect}>
                        Connect Wallet
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/positions')}>
                        View Positions →
                    </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 20 }}>
                    Testnet only · No mainnet funds at risk
                </p>
            </motion.div>
        </div>
    )
}

export default function Dashboard({ wallet }) {
    const navigate = useNavigate()
    const { currentPrice, priceHistory, isLoading: priceLoading, lastFetched } = useLivePrice()
    const position = usePosition(wallet?.address)  // wallet-scoped: each user sees their own data
    const stats = useDerivedStats({ position, currentPrice })
    const addToast = useSafeToast()

    const [lastTxTimestamp, setLastTxTimestamp] = useState(null)
    const [range, setRange] = useState('30D')
    const [priceFlash, setPriceFlash] = useState(false)
    const [rebalanceHistory, setRebalanceHistory] = useState([])
    const [showDeposit, setShowDeposit] = useState(false)
    const [showWithdraw, setShowWithdraw] = useState(false)
    const secsAgo = useSecondsAgo(lastFetched || Date.now())

    // Fetch rebalance history
    useEffect(() => {
        fetchRebalanceHistoryFromAPI().then(setRebalanceHistory).catch(() => { })
    }, [lastTxTimestamp])

    // Flash when price updates
    useEffect(() => {
        if (!priceLoading) {
            setPriceFlash(true)
            const t = setTimeout(() => setPriceFlash(false), 800)
            return () => clearTimeout(t)
        }
    }, [currentPrice])

    const rebalanceButton = (
        <RebalanceTriggerButton
            isEnabled={stats.shouldRebalance || !stats.inRange}
            wallet={wallet}
            currentPrice={currentPrice}
            lowerBound={position.lowerBound}
            upperBound={position.upperBound}
            avgSwapCost={stats.avgSwapCost}
            onSuccess={(txId) => {
                setLastTxTimestamp(Math.floor(Date.now() / 1000))
                position.refresh?.()
                addToast(
                    `Rebalance submitted! TX: ${txId?.slice(0, 8)}… — View on explorer`,
                    'success',
                    6000
                )
            }}
        />
    )

    // Still resolving session from storage — show full-page spinner to avoid flash
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

    const isLoading = position.isLoading

    function SkeletonRow() {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ height: 10, width: 80 }} />
                <div className="skeleton" style={{ height: 24, width: 120 }} />
            </div>
        )
    }

    return (
        <div className="page-base">
            <Navbar wallet={wallet} isDashboard={true} />

            {/* ── Out of range alert ── */}
            <OutOfRangeAlert
                inRange={stats.inRange}
                currentPrice={currentPrice}
                lowerBound={position.lowerBound}
                upperBound={position.upperBound}
                capitalUsdc={position.capitalUsdc}
            />

            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>

                {/* ── Top header bar ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Position Dashboard</h2>
                        <span style={{
                            fontSize: 10, fontFamily: 'JetBrains Mono,monospace',
                            padding: '2px 8px', borderRadius: 4,
                            background: 'rgba(0,200,150,0.07)',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(0,200,150,0.15)',
                        }}>
                            ALGO/USDC
                        </span>
                    </div>

                    {/* Right side controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Last updated */}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Price updated{' '}
                            <span style={{ color: priceFlash ? 'var(--accent-primary)' : 'var(--text-secondary)', fontFamily: 'JetBrains Mono,monospace', transition: 'color 0.4s' }}>
                                {secsAgo}s ago
                            </span>
                        </span>
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
                        {/* Date range selector */}
                        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
                            {RANGES.map(r => (
                                <button key={r} onClick={() => setRange(r)} style={{
                                    padding: '4px 11px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                    background: range === r ? 'var(--accent-primary)' : 'transparent',
                                    color: range === r ? '#000' : 'var(--text-secondary)',
                                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                }}>{r}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Section: Position Summary ── */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Position Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="card" style={{ padding: '18px 20px' }}>
                                <SkeletonRow />
                            </div>
                        ))
                    ) : (
                        <>
                            <StatCard label="Position Value" value={stats.positionValue} colorClass="neutral" index={0} subLabel={`${stats.elapsedDays?.toFixed(0)} days open`} />
                            <StatCard label="HODL Value" value={stats.hodlValue} colorClass="neutral" index={1} />
                            <StatCard label="Fees Earned" value={stats.feesEarned} colorClass="positive" index={2} />
                            <StatCard label="Swap Costs" value={stats.swapLosses} colorClass="negative" index={3} subLabel={`${Math.round((stats.swapLosses || 0) / 4.2)} rebalances`} />
                        </>
                    )}
                </div>

                {/* ── Deposit / Withdraw buttons ── */}
                {!isLoading && position.entryPrice > 0 && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => setShowDeposit(true)}
                            style={{
                                flex: 1, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                                color: '#10B981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                        >
                            <span style={{ fontSize: 16 }}>↓</span> Deposit Funds
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => setShowWithdraw(true)}
                            style={{
                                flex: 1, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                                color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                        >
                            <span style={{ fontSize: 16 }}>↑</span> Withdraw Funds
                        </motion.button>
                    </div>
                )}

                {/* ── Net P&L + Health gauge ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
                    {isLoading ? (
                        <div className="card skeleton" style={{ height: 130, gridColumn: 'span 2' }} />
                    ) : (
                        <>
                            <NetPnLPanel
                                netPnL={stats.netPnL}
                                feesEarned={stats.feesEarned}
                                ilDollar={stats.ilDollar}
                                swapLosses={stats.swapLosses}
                            />
                            <PositionHealthGauge
                                currentPrice={currentPrice}
                                lowerBound={position.lowerBound}
                                upperBound={position.upperBound}
                                inRange={stats.inRange}
                            />
                        </>
                    )}
                </div>

                {/* ── Section: Price & Range ── */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Price & Range</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
                    {isLoading ? (
                        <div className="card skeleton" style={{ height: 280, gridColumn: 'span 2' }} />
                    ) : (
                        <>
                            <PriceRangeChart
                                currentPrice={currentPrice}
                                priceHistory={priceHistory}
                                lowerBound={position.lowerBound}
                                upperBound={position.upperBound}
                                isLoading={priceLoading}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <ILComparisonPanel
                                    feesEarned={stats.feesEarned}
                                    ilDollar={stats.ilDollar}
                                    netAfterIL={stats.netPnL ?? 0}
                                    entryPrice={position.entryPrice}
                                />
                                <APRComparisonChart
                                    feesEarned={stats.feesEarned}
                                    capitalUsdc={position.capitalUsdc}
                                    elapsedDays={stats.elapsedDays}
                                    hodlValue={stats.hodlValue}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* ── Section: Agent & Activity ── */}
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Agent & Activity</div>

                {/* ── Agent Status + Decision Engine ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <AgentStatusPanel />
                    <DecisionEnginePanel
                        currentPrice={currentPrice}
                        inRange={stats.inRange}
                        dailyFee={stats.dailyFee}
                        avgSwapCost={stats.avgSwapCost}
                        netRebalanceValue={stats.netRebalanceValue}
                        shouldRebalance={stats.shouldRebalance}
                        lastTxTimestamp={lastTxTimestamp}
                        isWalletConnected={wallet.isConnected}
                        rebalanceSlot={rebalanceButton}
                    />
                </div>

                {/* ── Agent Prediction ── */}
                <div style={{ marginBottom: 14 }}>
                    <AgentPredictionPanel />
                </div>

                {/* ── Rebalance History + Decision Log ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <RebalanceHistoryTable rebalanceTxns={rebalanceHistory} position={position} />
                    <DecisionLogTable />
                </div>

                {/* Quick links */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => navigate('/positions')}>View All Positions →</button>
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => navigate('/analytics')}>Analytics →</button>
                    <a
                        href={`https://lora.algokit.io/testnet/application/${import.meta.env.VITE_APP_ID || '755777633'}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: 'var(--accent-primary)', padding: '8px 16px', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                        App ID {import.meta.env.VITE_APP_ID || '755777633'} ↗
                    </a>
                </div>
            </div>

            {/* ── Deposit / Withdraw Modals ── */}
            <DepositModal
                isOpen={showDeposit}
                onClose={() => setShowDeposit(false)}
                wallet={wallet}
                position={position}
                onSuccess={({ txId }) => {
                    position.refresh?.()
                    addToast(`Deposit submitted! TX: ${txId?.slice(0, 8)}…`, 'success', 5000)
                }}
            />
            <WithdrawModal
                isOpen={showWithdraw}
                onClose={() => setShowWithdraw(false)}
                wallet={wallet}
                position={position}
                onSuccess={({ txId }) => {
                    position.refresh?.()
                    addToast(`Withdrawal submitted! TX: ${txId?.slice(0, 8)}…`, 'success', 5000)
                }}
            />
        </div>
    )
}
