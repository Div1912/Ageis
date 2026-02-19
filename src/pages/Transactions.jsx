/**
 * Transactions page — full transaction history with Indexer data.
 * Shows deposits, withdrawals, rebalances, and position updates.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import { fetchRebalanceHistoryFromAPI, fetchDecisionLogFromAPI } from '../services/apiService'
import { fetchAppTransactions } from '../services/indexerService'

const TYPE_FILTERS = ['All', 'Rebalance', 'Deposit', 'Withdraw', 'Position Set']
const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633

function classifyTransaction(tx) {
    const args = tx['application-transaction']?.['application-args'] ?? []
    if (args.length === 0) return 'Unknown'
    // ABI method selectors are the first 4 bytes of the hash
    // We approximate by checking arg count
    const argCount = args.length - 1 // first arg is method selector
    if (argCount === 2) return 'Rebalance'
    if (argCount === 4) return 'Position Set'
    if (argCount === 2) return 'Deposit'
    return 'App Call'
}

const TYPE_BADGE = {
    'Rebalance': { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: '⟳' },
    'Deposit': { color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: '↓' },
    'Withdraw': { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: '↑' },
    'Position Set': { color: '#00C896', bg: 'rgba(0,200,150,0.08)', icon: '◈' },
    'App Call': { color: '#8B97A8', bg: 'rgba(139,151,168,0.07)', icon: '•' },
    'Unknown': { color: '#4B5563', bg: 'rgba(75,85,99,0.07)', icon: '?' },
}

function SkeletonRow() {
    return (
        <tr>
            {Array.from({ length: 6 }).map((_, i) => (
                <td key={i}><div className="skeleton" style={{ height: 14, width: i === 0 ? 60 : i === 3 ? 180 : 80 }} /></td>
            ))}
        </tr>
    )
}

function EmptyState() {
    return (
        <div style={{
            textAlign: 'center', padding: '48px 24px',
        }}>
            <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>◇</div>
            <h3 style={{ fontSize: 16, marginBottom: 8, color: 'var(--text-secondary)' }}>No transactions yet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto' }}>
                Transactions will appear here once you deploy a contract and start interacting with it on Testnet.
            </p>
        </div>
    )
}

export default function Transactions({ wallet }) {
    const navigate = useNavigate()
    const [transactions, setTransactions] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState('All')
    const [searchTx, setSearchTx] = useState('')

    useEffect(() => {
        async function load() {
            setIsLoading(true)
            try {
                const txns = await fetchAppTransactions(APP_ID)
                const enriched = txns.map(tx => ({
                    ...tx,
                    _type: classifyTransaction(tx),
                    _time: tx['round-time'] ? new Date(tx['round-time'] * 1000) : new Date(),
                    _fee: (tx.fee ?? 0) / 1e6,
                }))
                setTransactions(enriched)
            } catch (err) {
                console.warn('[Transactions] Failed to load:', err.message)
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [])

    const filtered = useMemo(() => {
        let list = transactions
        if (filter !== 'All') {
            list = list.filter(tx => tx._type === filter)
        }
        if (searchTx.trim()) {
            const q = searchTx.toLowerCase()
            list = list.filter(tx => tx.id?.toLowerCase().includes(q))
        }
        return list
    }, [transactions, filter, searchTx])

    return (
        <div className="page-base">
            <Navbar wallet={wallet} isDashboard={true} />

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Transaction History</h2>
                        <p style={{ fontSize: 13 }}>
                            {isLoading ? 'Loading…' : `${transactions.length} transactions · App ID ${APP_ID}`}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <a
                            href={`https://lora.algokit.io/testnet/application/${APP_ID}`}
                            target="_blank" rel="noreferrer"
                            className="btn-secondary" style={{ fontSize: 12 }}
                        >
                            View on Explorer ↗
                        </a>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Type filter */}
                    <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
                        {TYPE_FILTERS.map(f => (
                            <button key={f} onClick={() => setFilter(f)} style={{
                                padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                background: filter === f ? 'var(--accent-primary)' : 'transparent',
                                color: filter === f ? '#000' : 'var(--text-secondary)',
                                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                            }}>{f}</button>
                        ))}
                    </div>

                    {/* Search */}
                    <div style={{ flex: 1, maxWidth: 300 }}>
                        <input
                            type="text" placeholder="Search TX ID…"
                            value={searchTx} onChange={e => setSearchTx(e.target.value)}
                            style={{
                                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 6, padding: '7px 12px', fontSize: 12,
                                fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)',
                                outline: 'none', transition: 'border-color 0.15s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'rgba(0,200,150,0.4)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    {/* Count */}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {filtered.length} results
                    </span>
                </div>

                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                        { l: 'Total TXs', v: transactions.length, c: 'var(--text-primary)' },
                        { l: 'Rebalances', v: transactions.filter(t => t._type === 'Rebalance').length, c: 'var(--accent-warning)' },
                        { l: 'Deposits', v: transactions.filter(t => t._type === 'Deposit').length, c: 'var(--accent-positive)' },
                        { l: 'Total Fees', v: `${transactions.reduce((s, t) => s + t._fee, 0).toFixed(4)} ALGO`, c: 'var(--text-secondary)' },
                    ].map(({ l, v, c }) => (
                        <div key={l} className="card" style={{ padding: '14px 18px' }}>
                            <span className="section-label" style={{ marginBottom: 6, display: 'block' }}>{l}</span>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: c }}>{v}</span>
                        </div>
                    ))}
                </div>

                {/* Transaction table */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="card"
                >
                    {isLoading ? (
                        <div style={{ padding: 20 }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Type</th><th>TX ID</th><th>Time</th><th>Round</th><th>Fee</th><th>Explorer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
                                </tbody>
                            </table>
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="table-container" style={{ maxHeight: 520 }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>TX ID</th>
                                        <th>Time</th>
                                        <th>Round</th>
                                        <th>Fee</th>
                                        <th>Explorer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {filtered.map((tx, i) => {
                                            const badge = TYPE_BADGE[tx._type] || TYPE_BADGE['Unknown']
                                            return (
                                                <motion.tr
                                                    key={tx.id || i}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.02, duration: 0.2 }}
                                                >
                                                    <td>
                                                        <span style={{
                                                            fontSize: 10, fontWeight: 700, padding: '3px 8px',
                                                            borderRadius: 4, color: badge.color,
                                                            background: badge.bg,
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        }}>
                                                            {badge.icon} {tx._type}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="mono" style={{ fontSize: 11 }}>
                                                            {tx.id ? `${tx.id.slice(0, 8)}…${tx.id.slice(-6)}` : '—'}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                                        {tx._time.toLocaleString()}
                                                    </td>
                                                    <td>
                                                        <span className="mono" style={{ fontSize: 11 }}>
                                                            {tx['confirmed-round'] ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                            {tx._fee.toFixed(4)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <a
                                                            href={`https://lora.algokit.io/testnet/transaction/${tx.id}`}
                                                            target="_blank" rel="noreferrer"
                                                            style={{
                                                                fontSize: 11, color: 'var(--accent-primary)',
                                                                textDecoration: 'none',
                                                            }}
                                                        >
                                                            View ↗
                                                        </a>
                                                    </td>
                                                </motion.tr>
                                            )
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>

                {/* Footer */}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
                    Data from Algorand Testnet Indexer · Showing latest 50 transactions
                </p>
            </div>
        </div>
    )
}
