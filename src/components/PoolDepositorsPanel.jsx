/**
 * PoolDepositorsPanel — shows all users who have deposited into the vault.
 * Reads from Supabase depositors table or localStorage fallback.
 * Renders as a compact card with address, amount, and share.
 */
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../services/supabaseClient'

export default function PoolDepositorsPanel({ refreshTrigger }) {
    const [depositors, setDepositors] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDepositors()
    }, [refreshTrigger])

    async function loadDepositors() {
        setLoading(true)
        let data = []

        // Try Supabase first
        if (supabase) {
            try {
                const result = await supabase
                    .from('depositors')
                    .select('*')
                    .order('joined_at', { ascending: true })
                    .limit(20)

                if (result.data?.length) {
                    data = result.data.map(d => ({
                        address: d.wallet_address,
                        algo: d.algo_deposited || 0,
                        usdc: d.usdc_deposited || 0,
                        joinedAt: d.joined_at,
                    }))
                }
            } catch (err) {
                console.warn('[PoolDepositorsPanel] Supabase read failed:', err)
            }
        }

        // Fallback to localStorage
        if (!data.length) {
            const stored = JSON.parse(localStorage.getItem('aegis_depositors') || '[]')
            data = stored.map(d => ({
                address: d.address,
                algo: d.algo_amount || 0,
                usdc: d.usdc_amount || 0,
                joinedAt: d.joined_at,
            }))
        }

        setDepositors(data)
        setLoading(false)
    }

    // Calculate total TVL and shares
    const totalAlgo = depositors.reduce((s, d) => s + d.algo, 0)
    const totalUsdc = depositors.reduce((s, d) => s + d.usdc, 0)
    const totalValue = totalAlgo + totalUsdc // simplified

    if (loading) {
        return (
            <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading depositors…</div>
            </div>
        )
    }

    if (depositors.length === 0) {
        return (
            <div className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>No depositors yet</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Be the first to join the pool!</div>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{ padding: 18 }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                        POOL DEPOSITORS
                    </h4>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {depositors.length} participant{depositors.length !== 1 ? 's' : ''}
                    </div>
                </div>
                <div style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    color: '#818CF8', fontFamily: 'JetBrains Mono,monospace',
                }}>
                    TVL: {totalAlgo.toFixed(2)} ALGO + {totalUsdc.toFixed(2)} USDC
                </div>
            </div>

            {/* Depositor list */}
            {depositors.map((d, i) => {
                const share = totalValue > 0
                    ? (((d.algo + d.usdc) / totalValue) * 100).toFixed(1)
                    : '0.0'

                return (
                    <div key={d.address} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: i < depositors.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Avatar circle */}
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: `hsl(${hashCode(d.address) % 360}, 60%, 45%)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 800, color: '#fff',
                            }}>
                                {d.address.slice(0, 2)}
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>
                                    {d.address.slice(0, 6)}…{d.address.slice(-4)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    {d.algo > 0 ? `${d.algo.toFixed(2)} ALGO` : ''}
                                    {d.algo > 0 && d.usdc > 0 ? ' + ' : ''}
                                    {d.usdc > 0 ? `${d.usdc.toFixed(2)} USDC` : ''}
                                </div>
                            </div>
                        </div>

                        {/* Share badge */}
                        <div style={{
                            padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                            color: '#10B981', fontFamily: 'JetBrains Mono,monospace',
                        }}>
                            {share}%
                        </div>
                    </div>
                )
            })}

            {/* Share bar */}
            <div style={{
                height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12,
                display: 'flex', background: 'rgba(255,255,255,0.05)',
            }}>
                {depositors.map((d, i) => {
                    const pct = totalValue > 0 ? ((d.algo + d.usdc) / totalValue) * 100 : 0
                    return (
                        <div key={d.address} style={{
                            width: `${pct}%`,
                            background: `hsl(${hashCode(d.address) % 360}, 60%, 50%)`,
                            transition: 'width 0.5s ease',
                        }} />
                    )
                })}
            </div>
        </motion.div>
    )
}

function hashCode(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0
    }
    return Math.abs(hash)
}
