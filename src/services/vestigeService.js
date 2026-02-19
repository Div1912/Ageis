/**
 * Vestige.fi price feed service.
 * Fetches live ALGO/USDC price from the public Vestige API.
 * No API key required.
 */
import axios from 'axios'

const VESTIGE_BASE = import.meta.env.VITE_VESTIGE || 'https://free-api.vestige.fi'

let lastKnownPrice = 0.18

/**
 * Fetches the current ALGO/USDC price from Vestige.fi.
 * Falls back to last known price on error.
 * @returns {Promise<number>} Current ALGO price in USDC
 */
export async function fetchAlgoPrice() {
    try {
        const url = `${VESTIGE_BASE}/asset/0/prices?currency=usdc`
        const response = await axios.get(url, { timeout: 8000 })
        const data = response.data

        // Vestige returns array of price points; take the latest
        let price = 0
        if (Array.isArray(data) && data.length > 0) {
            const latest = data[data.length - 1]
            price = latest.price ?? latest.close ?? latest.value ?? 0
        } else if (data && typeof data.price === 'number') {
            price = data.price
        } else if (data && typeof data === 'number') {
            price = data
        }

        if (price > 0) {
            lastKnownPrice = price
            return price
        }
        return lastKnownPrice
    } catch (err) {
        console.warn('[vestigeService] Price fetch failed, using last known price:', err.message)
        return lastKnownPrice
    }
}

/**
 * Returns the last successfully fetched price without making a new request.
 * @returns {number}
 */
export function getLastKnownPrice() {
    return lastKnownPrice
}
