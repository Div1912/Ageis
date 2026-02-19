/**
 * RebalanceTriggerButton — manages rebalance transaction flow.
 * Opens confirmation modal, builds txn, signs via Pera, submits to Testnet.
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import ConfirmationModal from './ConfirmationModal'
import { triggerRebalance } from '../services/contractService'
import { algodClient } from '../services/algorandClient'

const APP_ID = Number(import.meta.env.VITE_APP_ID) || 755777633

export default function RebalanceTriggerButton({
    isEnabled, wallet, currentPrice, lowerBound, upperBound, avgSwapCost, onSuccess,
}) {
    const [modalOpen, setModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [txId, setTxId] = useState(null)
    const [flashSuccess, setFlashSuccess] = useState(false)
    const [error, setError] = useState(null)

    const handleConfirm = async (newLower, newUpper) => {
        if (!wallet.address) return
        setIsSubmitting(true)
        setError(null)
        try {
            const txn = await triggerRebalance(APP_ID, newLower, newUpper, wallet.address)
            const id = await wallet.signAndSubmit(txn, algodClient)
            setTxId(id)
            setFlashSuccess(true)
            setTimeout(() => setFlashSuccess(false), 2000)
            if (onSuccess) onSuccess(id)
        } catch (err) {
            console.error('[RebalanceTrigger]', err.message)
            setError(err.message || 'Transaction failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <motion.button
                className="btn-primary"
                style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: flashSuccess ? 'var(--accent-primary)' : undefined,
                    transition: 'background-color 0.3s ease',
                }}
                disabled={!isEnabled || !wallet.isConnected}
                onClick={() => { setTxId(null); setError(null); setModalOpen(true) }}
                whileTap={{ scale: 0.97 }}
                animate={flashSuccess ? { backgroundColor: '#00C896' } : {}}
            >
                Trigger Rebalance
            </motion.button>

            <ConfirmationModal
                open={modalOpen}
                onConfirm={handleConfirm}
                onCancel={() => setModalOpen(false)}
                isSubmitting={isSubmitting}
                txId={txId}
                error={error}
                currentPrice={currentPrice}
                lowerBound={lowerBound}
                upperBound={upperBound}
                avgSwapCost={avgSwapCost}
            />
        </>
    )
}
