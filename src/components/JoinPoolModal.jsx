/**
 * JoinPoolModal — second user can deposit into the AEGIS vault.
 * Demonstrates multi-user LP: multiple depositors share the same pool position.
 * Tracks depositors in Supabase (or localStorage fallback).
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../services/supabaseClient'

const APP_ID = parseInt(import.meta.env.VITE_APP_ID || '755790672')

export default function JoinPoolModal({ isOpen, onClose, wallet, onSuccess }) {
    const [algoAmount, setAlgoAmount] = useState('')
    const [usdcAmount, setUsdcAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleJoin = async () => {
        setError('')
        const algo = parseFloat(algoAmount) || 0
        const usdc = parseFloat(usdcAmount) || 0

        if (algo <= 0 && usdc <= 0) {
            setError('Enter at least one amount to deposit')
            return
        }
        if (!wallet?.address) {
            setError('Connect your wallet first')
            return
        }

        setSubmitting(true)
        try {
            const algosdk = (await import('algosdk')).default
            const client = new algosdk.Algodv2('', import.meta.env.VITE_ALGO_NODE || 'https://testnet-api.algonode.cloud', '')
            const suggestedParams = await client.getTransactionParams().do()

            // Build deposit ABI call — same contract, second user deposits into vault
            const contract = new algosdk.ABIContract({
                name: 'AegisPosition',
                methods: [{
                    name: 'deposit',
                    args: [{ type: 'uint64', name: 'algo_amount' }, { type: 'uint64', name: 'usdc_amount' }],
                    returns: { type: 'void' },
                }],
            })

            const atc = new algosdk.AtomicTransactionComposer()
            atc.addMethodCall({
                appID: APP_ID,
                method: contract.getMethodByName('deposit'),
                methodArgs: [
                    Math.round(algo * 1e6),
                    Math.round(usdc * 1e6),
                ],
                sender: wallet.address,
                suggestedParams,
                signer: algosdk.makeEmptyTransactionSigner(),
            })

            const txGroup = atc.buildGroup().map(t => t.txn)
            const txn = txGroup[0]
            const txId = await wallet.signAndSubmit(txn, client)

            // Record depositor in Supabase
            await _saveDepositor(wallet.address, algo, usdc, txId)

            onSuccess?.({ txId, algo, usdc, address: wallet.address })
            onClose()
        } catch (e) {
            console.error('Join pool failed:', e)
            setError(e.message || 'Transaction failed')
        }
        setSubmitting(false)
    }

    if (!isOpen) return null

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
                        borderRadius: 16, width: 460, padding: 32,
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Join Pool</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Become an LP · earn fees from every swap</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                        }}>✕</button>
                    </div>

                    {/* How it works */}
                    <div style={{
                        padding: '12px 14px', marginBottom: 20,
                        background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)',
                        borderRadius: 8, fontSize: 11, color: '#60A5FA', lineHeight: 1.5,
                    }}>
                        🏊 <strong>Multi-user LP:</strong> Your deposit joins the shared vault managed by AEGIS.
                        The autonomous agent rebalances the pool position to maximize yield.
                        You earn a proportional share of all trading fees.
                    </div>

                    {/* Pool info */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20,
                    }}>
                        <div style={{
                            padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                            borderRadius: 8, border: '1px solid var(--border)',
                        }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>POOL</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>ALGO / USDC</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Pact CLMM</div>
                        </div>
                        <div style={{
                            padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                            borderRadius: 8, border: '1px solid var(--border)',
                        }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>AGENT</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>AEGIS v2</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Autonomous</div>
                        </div>
                    </div>

                    {/* ALGO amount */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            ALGO AMOUNT
                        </label>
                        <input
                            type="number" step="0.01" value={algoAmount}
                            onChange={e => setAlgoAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                        />
                    </div>

                    {/* USDC amount */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            USDC AMOUNT
                        </label>
                        <input
                            type="number" step="0.01" value={usdcAmount}
                            onChange={e => setUsdcAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                                width: '100%', padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,0.3))',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                                fontSize: 14, fontFamily: 'JetBrains Mono,monospace', outline: 'none',
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '8px 12px', marginBottom: 14, borderRadius: 6,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#EF4444', fontSize: 12,
                        }}>{error}</div>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                        disabled={submitting || !wallet?.address}
                        onClick={handleJoin}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                            border: 'none', cursor: submitting ? 'wait' : 'pointer',
                            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                            color: '#fff', transition: 'all 0.2s',
                        }}
                    >
                        {submitting ? 'Joining Pool...' : '🏊 Join Pool & Start Earning'}
                    </motion.button>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

// ── Helper: Save depositor ────────────────────
async function _saveDepositor(address, algo, usdc, txId) {
    const depositor = {
        address,
        algo_amount: algo,
        usdc_amount: usdc,
        tx_id: txId,
        joined_at: Date.now(),
    }

    if (supabase) {
        try {
            await supabase.from('depositors').upsert({
                wallet_address: address,
                algo_deposited: algo,
                usdc_deposited: usdc,
                join_tx: txId,
                joined_at: new Date().toISOString(),
            }, { onConflict: 'wallet_address' })
        } catch (err) {
            console.warn('[JoinPoolModal] Supabase depositor save failed:', err)
        }
    }

    // Also save to localStorage as fallback
    const key = 'aegis_depositors'
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = existing.findIndex(d => d.address === address)
    if (idx >= 0) {
        existing[idx].algo_amount += algo
        existing[idx].usdc_amount += usdc
    } else {
        existing.push(depositor)
    }
    localStorage.setItem(key, JSON.stringify(existing))
}
