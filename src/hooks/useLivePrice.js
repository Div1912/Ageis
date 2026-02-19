/**
 * useLivePrice — polls Vestige.fi every 30 seconds for ALGO/USDC price.
 * Maintains a rolling 30-point price history for chart rendering.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchAlgoPrice } from '../services/vestigeService'

const POLL_INTERVAL = 30_000
const MAX_HISTORY = 30

export function useLivePrice() {
    const [currentPrice, setCurrentPrice] = useState(0)
    const [priceHistory, setPriceHistory] = useState([])
    const [lastUpdated, setLastUpdated] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const intervalRef = useRef(null)

    const fetchAndUpdate = useCallback(async () => {
        setIsLoading(true)
        try {
            const price = await fetchAlgoPrice()
            if (price > 0) {
                setCurrentPrice(price)
                setLastUpdated(new Date())
                setPriceHistory(prev => {
                    const now = Date.now()
                    const newPoint = { time: now, price, timestamp: new Date().toLocaleTimeString() }
                    const updated = [...prev, newPoint]
                    return updated.slice(-MAX_HISTORY)
                })
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAndUpdate()
        intervalRef.current = setInterval(fetchAndUpdate, POLL_INTERVAL)
        return () => clearInterval(intervalRef.current)
    }, [fetchAndUpdate])

    return { currentPrice, priceHistory, lastUpdated, lastFetched: lastUpdated?.getTime() ?? null, isLoading }
}
