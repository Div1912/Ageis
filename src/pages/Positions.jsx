/**
 * Positions page — LP positions with live on-chain data.
 * Shows the active on-chain position + closed positions from localStorage.
 * Supports: New Position, Add Liquidity, Remove Liquidity.
 */
import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import CreatePositionModal from '../components/CreatePositionModal'
import AddLiquidityModal from '../components/AddLiquidityModal'
import RemoveLiquidityModal from '../components/RemoveLiquidityModal'
import { useLivePrice } from '../hooks/useLivePrice'
import { usePosition } from '../hooks/usePosition'
import { formatUSD, computeFeesEarned, computeILDollar } from '../services/pnlCalculator'
import { getClosedPositions, archiveCurrentPosition, trackNewPosition } from '../services/positionStore'
import { getPositions } from '../services/supabaseService'

const STATUS_BADGE = {
    active: { label: 'Active', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    out_of_range: { label: 'Out of Range', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    closed: { label: 'Closed', color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
}

function SkeletonCard() {
    return (
        <div className="card" style={{ padding: 24 }}>
            <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: 12, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: '25%', height: 10, marginBottom: 18, borderRadius: 4 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}>
                        <div className="skeleton" style={{ width: 50, height: 8, marginBottom: 6, borderRadius: 3 }} />
                        <div className="skeleton" style={{ width: 70, height: 14, borderRadius: 3 }} />
                    </div>
                ))}
            </div>
        </div>
    )
}

function PositionCard({ pos, currentPrice, index, onAddLiquidity, onRemoveLiquidity, isLive }) {
    const navigate = useNavigate()
    const fees = computeFeesEarned(pos.capital, 0.35, pos.openDays)
    const il = computeILDollar(pos.capital, pos.entry, pos.status === 'closed' ? pos.entry * 1.05 : currentPrice)
    const net = fees - il - pos.rebalances * 4.2
    const badge = STATUS_BADGE[pos.status] || STATUS_BADGE.closed
    const inRange = currentPrice >= pos.lower && currentPrice <= pos.upper
    const rangePct = pos.upper > pos.lower
        ? Math.max(0, Math.min(100, ((currentPrice - pos.lower) / (pos.upper - pos.lower)) * 100))
        : 50

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="card"
            style={{ padding: 24, position: 'relative', overflow: 'hidden' }}
        >
            {/* Top accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: badge.color, opacity: 0.5 }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{pos.pair}</h3>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 7px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'JetBrains Mono,monospace' }}>{pos.pool}</span>
                        {isLive && <span style={{ fontSize: 9, color: '#10B981', fontWeight: 700, letterSpacing: '0.06em' }}>● LIVE</span>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {pos.status === 'closed'
                            ? `Closed · ${pos.openDays} days`
                            : pos.openDays < 1 ? 'Opened today' : `Opened ${pos.openDays} days ago`
                        } · {pos.rebalances} rebalances
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isLive && pos.status !== 'closed' && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onAddLiquidity?.() }} style={{
                                padding: '4px 10px', fontSize: 10, fontWeight: 700,
                                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: 4, color: '#10B981', cursor: 'pointer',
                            }}>+ Add</button>
                            <button onClick={(e) => { e.stopPropagation(); onRemoveLiquidity?.() }} style={{
                                padding: '4px 10px', fontSize: 10, fontWeight: 700,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 4, color: '#EF4444', cursor: 'pointer',
                            }}>- Remove</button>
                        </>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 4, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
                        {badge.label}
                    </span>
                </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
                {[
                    { l: 'Capital', v: formatUSD(pos.capital), c: 'var(--text-primary)' },
                    { l: 'Fees', v: `+${formatUSD(fees)}`, c: 'var(--accent-positive)' },
                    { l: 'IL', v: `-${formatUSD(il)}`, c: 'var(--accent-negative)' },
                    { l: 'Net P&L', v: net >= 0 ? `+${formatUSD(net)}` : formatUSD(net), c: net >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)' },
                ].map(({ l, v, c }) => (
                    <div key={l}>
                        <div className="section-label" style={{ marginBottom: 4 }}>{l}</div>
                        <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 600, color: c }}>{v}</div>
                    </div>
                ))}
            </div>

            {/* Mini range gauge */}
            {pos.status !== 'closed' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, fontFamily: 'JetBrains Mono,monospace' }}>
                        <span>${pos.lower.toFixed(4)}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>${currentPrice.toFixed(4)}</span>
                        <span>${pos.upper.toFixed(4)}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '35%', width: '30%', background: 'rgba(16,185,129,0.1)' }} />
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(2, rangePct)}%` }}
                            transition={{ duration: 0.7, delay: 0.3 + index * 0.1, ease: 'easeOut' }}
                            style={{ height: '100%', background: inRange ? 'var(--accent-positive)' : '#F59E0B', borderRadius: 2 }}
                        />
                    </div>
                </div>
            )}

            {/* Click to dashboard for active */}
            {isLive && pos.status !== 'closed' && (
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <button onClick={() => navigate('/dashboard')} style={{
                        background: 'none', border: 'none', color: 'var(--accent-primary)',
                        fontSize: 11, cursor: 'pointer', fontWeight: 600,
                    }}>View Dashboard →</button>
                </div>
            )}
        </motion.div>
    )
}


export default function Positions({ wallet }) {
    const navigate = useNavigate()
    const { currentPrice } = useLivePrice()
    const position = usePosition(wallet?.address)  // wallet-scoped

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showRemoveModal, setShowRemoveModal] = useState(false)

    // Build live position from on-chain data
    const livePosition = useMemo(() => {
        if (position.isLoading || !position.entryPrice) return null
        const openDays = position.openTimestamp > 0
            ? Math.max(1, Math.floor((Date.now() / 1000 - position.openTimestamp) / 86400))
            : 1
        const inRange = currentPrice >= position.lowerBound && currentPrice <= position.upperBound
        return {
            id: 'live',
            pair: 'ALGO / USDC',
            pool: 'Pact CLMM',
            entry: position.entryPrice,
            lower: position.lowerBound,
            upper: position.upperBound,
            capital: position.capitalUsdc,
            openDays,
            rebalances: position.totalRebalances,
            status: inRange ? 'active' : 'out_of_range',
            isLive: true,
        }
    }, [position, currentPrice])

    // Closed positions from localStorage
    const closedPositions = useMemo(() => {
        return getClosedPositions().map(p => ({
            id: p.id,
            pair: p.pair || 'ALGO / USDC',
            pool: p.pool || 'Pact CLMM',
            entry: p.entryPrice,
            lower: p.lowerBound,
            upper: p.upperBound,
            capital: p.capitalUsdc,
            openDays: p.openTimestamp > 0
                ? Math.max(1, Math.floor(((p.closedAt || Date.now()) / 1000 - p.openTimestamp) / 86400))
                : 1,
            rebalances: p.totalRebalances || 0,
            status: 'closed',
            isLive: false,
        })).reverse() // newest first
    }, [position]) // re-derive when position refreshes

    // Combine all positions
    const allPositions = useMemo(() => {
        const list = []
        if (livePosition) list.push(livePosition)
        list.push(...closedPositions)
        return list
    }, [livePosition, closedPositions])

    // Compute summary
    const summary = useMemo(() => {
        let totalCap = 0, totalFees = 0, totalIl = 0
        for (const pos of allPositions) {
            totalCap += pos.capital
            totalFees += computeFeesEarned(pos.capital, 0.35, pos.openDays)
            totalIl += computeILDollar(pos.capital, pos.entry, pos.status === 'closed' ? pos.entry * 1.05 : currentPrice)
        }
        const rebalanceCost = allPositions.reduce((s, p) => s + p.rebalances * 4.2, 0)
        const netPnl = totalFees - totalIl - rebalanceCost
        return { totalCap, totalFees, totalIl, netPnl }
    }, [allPositions, currentPrice])

    // Handlers for New Position success
    const handleCreateSuccess = useCallback(({ entry, lower, upper, capital, positionData }) => {
        // Archive current on-chain position if one exists
        if (position.entryPrice > 0) {
            archiveCurrentPosition(position)
        }
        // Track the new position in localStorage
        trackNewPosition({ entryPrice: entry, lowerBound: lower, upperBound: upper, capitalUsdc: capital })

        // Force-update position immediately so UI shows it now (don't wait for 30s refresh)
        if (positionData && position.forceUpdate) {
            position.forceUpdate(positionData)
        } else {
            position.refresh()
        }
    }, [position])

    const handleAddSuccess = useCallback(() => { position.refresh() }, [position])
    const handleRemoveSuccess = useCallback(() => { position.refresh() }, [position])

    return (
        <div className="page-base">
            <Navbar wallet={wallet} isDashboard={true} />
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                    <div>
                        <h2 style={{ fontSize: 22, marginBottom: 4 }}>LP Positions</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {position.isLoading ? 'Loading…' : `${allPositions.length} position${allPositions.length !== 1 ? 's' : ''} · ${allPositions.filter(p => p.status === 'active' || p.status === 'out_of_range').length} active · Algorand Testnet`}
                        </p>
                    </div>
                    <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                        + New Position
                    </button>
                </div>

                {/* Summary row */}
                {position.isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="card" style={{ padding: '14px 18px' }}>
                                <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 8 }} />
                                <div className="skeleton" style={{ width: 100, height: 20 }} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
                        {[
                            { l: 'Total Capital', v: formatUSD(summary.totalCap), c: 'var(--text-primary)' },
                            { l: 'Total Fees', v: `+${formatUSD(summary.totalFees)}`, c: 'var(--accent-positive)' },
                            { l: 'Total IL', v: `-${formatUSD(summary.totalIl)}`, c: 'var(--accent-negative)' },
                            { l: 'Net P&L', v: summary.netPnl >= 0 ? `+${formatUSD(summary.netPnl)}` : formatUSD(summary.netPnl), c: summary.netPnl >= 0 ? 'var(--accent-positive)' : 'var(--accent-negative)' },
                        ].map(({ l, v, c }) => (
                            <div key={l} className="card" style={{ padding: '14px 18px' }}>
                                <span className="section-label" style={{ marginBottom: 6, display: 'block' }}>{l}</span>
                                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 18, fontWeight: 700, color: c }}>{v}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Active Positions Section */}
                {livePosition && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Active Position</div>
                        <PositionCard
                            pos={livePosition}
                            currentPrice={currentPrice}
                            index={0}
                            isLive={true}
                            onAddLiquidity={() => setShowAddModal(true)}
                            onRemoveLiquidity={() => setShowRemoveModal(true)}
                        />
                    </div>
                )}

                {/* Closed Positions */}
                {closedPositions.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                            Position History ({closedPositions.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {closedPositions.map((pos, i) => (
                                <PositionCard key={pos.id} pos={pos} currentPrice={currentPrice} index={i + 1} isLive={false} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!position.isLoading && allPositions.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="card" style={{ padding: 48, textAlign: 'center' }}
                    >
                        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.15 }}>◇</div>
                        <h3 style={{ fontSize: 16, marginBottom: 8 }}>No Positions Yet</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', marginBottom: 16 }}>
                            Create your first LP position to start earning fees with AEGIS autonomous management.
                        </p>
                        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                            + Create First Position
                        </button>
                    </motion.div>
                )}

                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20, textAlign: 'center' }}>
                    Live on-chain data from Algorand Testnet ·{' '}
                    <a href="/dashboard" style={{ color: 'var(--accent-primary)' }}>View dashboard →</a>
                </p>
            </div>

            {/* Modals */}
            <CreatePositionModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                wallet={wallet}
                onSuccess={handleCreateSuccess}
            />
            <AddLiquidityModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                wallet={wallet}
                position={position}
                onSuccess={handleAddSuccess}
            />
            <RemoveLiquidityModal
                isOpen={showRemoveModal}
                onClose={() => setShowRemoveModal(false)}
                wallet={wallet}
                position={position}
                onSuccess={handleRemoveSuccess}
            />
        </div>
    )
}
