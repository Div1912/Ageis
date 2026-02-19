/**
 * App.jsx — root with all routes and global state.
 * Toast, wallet, and route context all live here.
 */
import React, { createContext, useContext, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Positions from './pages/Positions'
import Analytics from './pages/Analytics'
import Transactions from './pages/Transactions'
import PoolSwap from './pages/PoolSwap'
import { useWallet } from './hooks/useWallet'
import ToastContainer from './components/ToastContainer'

// ── Toast context ──────────────────────────
export const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

// ── App ────────────────────────────────────
export default function App() {
    const wallet = useWallet()
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ addToast }}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Landing wallet={wallet} />} />
                    <Route path="/dashboard" element={<Dashboard wallet={wallet} />} />
                    <Route path="/positions" element={<Positions wallet={wallet} />} />
                    <Route path="/analytics" element={<Analytics wallet={wallet} />} />
                    <Route path="/transactions" element={<Transactions wallet={wallet} />} />
                    <Route path="/swap" element={<PoolSwap wallet={wallet} />} />
                    {/* Keep unknown routes at / not redirect loop */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <ToastContainer toasts={toasts} onRemove={removeToast} />
            </BrowserRouter>
        </ToastContext.Provider>
    )
}
