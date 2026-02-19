/**
 * ToastContainer — global toast notification system.
 * Used via useToast() from App context.
 */
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ICONS = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
}
const COLORS = {
    success: 'var(--accent-positive)',
    error: 'var(--accent-negative)',
    warning: 'var(--accent-warning)',
    info: 'var(--accent-primary)',
}

export default function ToastContainer({ toasts, onRemove }) {
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28,
            display: 'flex', flexDirection: 'column', gap: 10,
            zIndex: 500, pointerEvents: 'none',
        }}>
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: 40, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 40, scale: 0.96 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 18px',
                            background: 'var(--bg-elevated)',
                            border: `1px solid ${COLORS[t.type] || COLORS.info}33`,
                            borderLeft: `3px solid ${COLORS[t.type] || COLORS.info}`,
                            borderRadius: 8,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            pointerEvents: 'all', cursor: 'pointer',
                            maxWidth: 340,
                        }}
                        onClick={() => onRemove(t.id)}
                    >
                        <span style={{ fontSize: 14, color: COLORS[t.type], flexShrink: 0 }}>{ICONS[t.type] || ICONS.info}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.message}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
