/**
 * AgentStatusPanel — shows agent running state with start/stop controls.
 * No terminal needed — everything from the dashboard.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ACTION_COLORS = {
    HOLD: '#4ade80',
    REBALANCE: '#60a5fa',
    SKIP: '#fbbf24',
    ALERT: '#f87171',
}

export default function AgentStatusPanel() {
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [backendReachable, setBackendReachable] = useState(true)
    const [actionError, setActionError] = useState(null)

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/agent/status`)
            const data = await res.json()
            setStatus(data)
            setBackendReachable(true)
        } catch {
            setStatus({ running: false, total_decisions: 0, recent_decisions: [], last_decision: null })
            setBackendReachable(false)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        setLoading(true)
        fetchStatus()
        const interval = setInterval(fetchStatus, 10_000)
        return () => clearInterval(interval)
    }, [fetchStatus])

    const handleStart = async () => {
        setActionLoading(true)
        setActionError(null)
        try {
            const res = await fetch(`${API}/api/agent/start`, { method: 'POST' })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.detail || `Server error ${res.status}`)
            }
            await new Promise(r => setTimeout(r, 1500))
            await fetchStatus()
        } catch (e) {
            console.error('Start failed:', e)
            if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
                setActionError('Backend server not running. Start it with: py -3.10 -m uvicorn main:app --port 8000')
            } else {
                setActionError(e.message || 'Failed to start agent')
            }
        }
        setActionLoading(false)
    }

    const handleStop = async () => {
        setActionLoading(true)
        setActionError(null)
        try {
            await fetch(`${API}/api/agent/stop`, { method: 'POST' })
            await new Promise(r => setTimeout(r, 500))
            await fetchStatus()
        } catch (e) {
            console.error('Stop failed:', e)
            setActionError('Failed to stop agent')
        }
        setActionLoading(false)
    }

    const formatUptime = (s) => {
        if (!s) return '0s'
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = s % 60
        if (h > 0) return `${h}h ${m}m`
        if (m > 0) return `${m}m ${sec}s`
        return `${sec}s`
    }

    const formatTime = (ts) => {
        if (!ts) return '--'
        const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
        const diff = Math.floor((Date.now() - d.getTime()) / 1000)
        if (diff < 60) return `${diff}s ago`
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        return `${Math.floor(diff / 3600)}h ago`
    }

    if (loading && !status) {
        return (
            <div className="card" style={{ padding: '20px 24px' }}>
                <div className="skeleton" style={{ height: 20, width: 160, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 40, width: '100%' }} />
            </div>
        )
    }

    const running = status?.running || false
    const lastDec = status?.last_decision

    return (
        <div className="card" style={{ padding: '20px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>AEGIS Agent</span>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: running ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                        color: running ? '#4ade80' : '#f87171',
                        border: `1px solid ${running ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                    }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: running ? '#4ade80' : '#f87171',
                            animation: running ? 'livePulse 2s infinite' : 'none',
                        }} />
                        {running ? 'RUNNING' : 'STOPPED'}
                    </span>
                </div>

                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={actionLoading}
                    onClick={running ? handleStop : handleStart}
                    style={{
                        padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: actionLoading ? 'wait' : 'pointer',
                        background: running
                            ? 'rgba(248,113,113,0.15)'
                            : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #00d4aa))',
                        color: running ? '#f87171' : '#000',
                    }}
                >
                    {actionLoading ? 'Working...' : running ? 'Stop Agent' : 'Start Agent'}
                </motion.button>
            </div>

            {/* Backend unreachable warning */}
            {!backendReachable && (
                <div style={{
                    padding: '8px 12px', marginBottom: 12, borderRadius: 6,
                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                    fontSize: 11, color: '#FBBF24', lineHeight: 1.5,
                }}>
                    ⚠️ Backend not reachable. Start it:
                    <code style={{ display: 'block', marginTop: 4, padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, fontFamily: 'JetBrains Mono,monospace', fontSize: 10 }}>
                        cd backend && py -3.10 -m uvicorn main:app --port 8000
                    </code>
                </div>
            )}

            {/* Action error */}
            {actionError && (
                <div style={{
                    padding: '8px 12px', marginBottom: 12, borderRadius: 6,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    fontSize: 11, color: '#EF4444', lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                    {actionError}
                </div>
            )}

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Uptime</div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>
                        {running ? formatUptime(status?.uptime_seconds) : '--'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Decisions</div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>
                        {status?.total_decisions || 0}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Last Action</div>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>
                        {lastDec ? (
                            <span style={{ color: ACTION_COLORS[lastDec.action] || 'var(--text-primary)' }}>
                                {lastDec.action}
                            </span>
                        ) : '--'}
                    </div>
                </div>
            </div>

            {/* Recent decisions mini-log */}
            {status?.recent_decisions?.length > 0 && (
                <div style={{
                    background: 'var(--bg-surface, rgba(0,0,0,0.2))', borderRadius: 8,
                    padding: '10px 12px', maxHeight: 120, overflowY: 'auto',
                }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                        RECENT ACTIVITY
                    </div>
                    {status.recent_decisions.slice(0, 5).map((d, i) => (
                        <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '4px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            fontSize: 11,
                        }}>
                            <span style={{
                                color: ACTION_COLORS[d.action] || 'var(--text-secondary)',
                                fontWeight: 600, minWidth: 70,
                            }}>
                                {d.action}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', flex: 1, paddingLeft: 8, fontSize: 10 }}>
                                {d.reason || '--'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono,monospace' }}>
                                {formatTime(d.timestamp)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {!running && !status?.recent_decisions?.length && (
                <div style={{
                    textAlign: 'center', padding: '16px 0',
                    color: 'var(--text-muted)', fontSize: 12
                }}>
                    Click "Start Agent" to begin autonomous monitoring.
                    <br />
                    <span style={{ fontSize: 10 }}>The agent polls every 40s and decides whether to rebalance.</span>
                </div>
            )}
        </div>
    )
}
