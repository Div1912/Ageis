/**
 * DecisionLogTable — shows agent decision events.
 * Fetches agent decisions from backend API. Shows empty state when no data.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchDecisionLogFromAPI } from '../services/apiService'

const ACTION_BADGE = {
    HOLD: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: '●' },
    REBALANCE: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: '⟳' },
    ALERT: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: '⚠' },
    SKIP: { color: '#6B7280', bg: 'rgba(107,114,128,0.07)', icon: '—' },
}


export default function DecisionLogTable({ position, currentPrice }) {
    const [events, setEvents] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        async function load() {
            setIsLoading(true)
            try {
                const apiData = await fetchDecisionLogFromAPI()
                if (apiData && apiData.length > 0) {
                    setEvents(apiData)
                } else {
                    setEvents([])
                }
            } catch {
                setEvents([])
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [position?.totalRebalances, currentPrice])

    const displayed = showAll ? events : events.slice(0, 5)

    return (
        <div className="card" style={{ padding: '20px 24px', marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span className="section-label">Agent Decision Log</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-muted)' }}>LIVE</span>
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12 }}>
                            <div className="skeleton" style={{ width: 60, height: 18, borderRadius: 4 }} />
                            <div className="skeleton" style={{ flex: 1, height: 18 }} />
                            <div className="skeleton" style={{ width: 80, height: 18 }} />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <div className="table-container" style={{ maxHeight: showAll ? 400 : 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Action</th>
                                    <th>Price</th>
                                    <th>Reason</th>
                                    <th>Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {displayed.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28, fontSize: 13 }}>
                                                No agent decisions yet — start the agent to begin monitoring
                                            </td>
                                        </tr>
                                    ) : displayed.map((event, i) => {
                                        const badge = ACTION_BADGE[event.action] || ACTION_BADGE['SKIP']
                                        const time = new Date(event.timestamp * 1000)
                                        const ago = Math.floor((Date.now() / 1000 - event.timestamp) / 60)
                                        const timeStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.floor(ago / 60)}h ago` : `${Math.floor(ago / 1440)}d ago`

                                        return (
                                            <motion.tr
                                                key={`${event.timestamp}-${i}`}
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.04, duration: 0.2 }}
                                            >
                                                <td>
                                                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: 'var(--text-muted)' }}>
                                                        {timeStr}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                                        borderRadius: 4, color: badge.color, background: badge.bg,
                                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                                    }}>
                                                        {badge.icon} {event.action}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="mono" style={{ fontSize: 11 }}>
                                                        {event.price ? `$${event.price.toFixed(4)}` : '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {event.reason}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: 10, color: event.result === 'Success' ? '#10B981' : 'var(--text-muted)' }}>
                                                        {event.result}
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        )
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>

                    {events.length > 5 && (
                        <button onClick={() => setShowAll(!showAll)} style={{
                            width: '100%', padding: '8px', marginTop: 8,
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'color 0.15s',
                        }}>
                            {showAll ? 'Show less' : `Show all ${events.length} decisions`}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}
