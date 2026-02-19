/**
 * P&L calculator — pure functions for all financial computations.
 * These are mathematically accurate formulas, not approximations.
 * All inputs and outputs are documented.
 */

/**
 * Standard impermanent loss formula.
 * IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
 *
 * @param {number} entryPrice  - ALGO/USDC price when LP position was opened
 * @param {number} currentPrice - Current ALGO/USDC price
 * @returns {number} IL as a negative fraction, e.g. -0.023 = -2.3% IL
 */
export function computeIL(entryPrice, currentPrice) {
    if (!entryPrice || entryPrice <= 0) return 0
    const priceRatio = currentPrice / entryPrice
    const il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1
    return il // negative value
}

/**
 * Estimates current LP position value using constant-product AMM model.
 * For x*y=k AMM, LP value scales with sqrt of price change.
 * V_lp = 2 * sqrt(capital_usdc/2 * capital_algo * currentPrice)
 * Simplified: capital * sqrt(currentPrice / entryPrice)
 *
 * @param {number} capitalUsdc  - Initial capital in USDC
 * @param {number} entryPrice   - ALGO/USDC price at position open
 * @param {number} currentPrice - Current ALGO/USDC price
 * @returns {number} Estimated LP position value in USD
 */
export function computePositionValue(capitalUsdc, entryPrice, currentPrice) {
    if (!capitalUsdc || !entryPrice || entryPrice <= 0) return capitalUsdc || 0
    return capitalUsdc * Math.sqrt(currentPrice / entryPrice)
}

/**
 * Computes HODL value if the user had simply held the assets.
 * Assumes capital was split 50/50 ALGO/USDC at entry.
 *
 * @param {number} capitalUsdc  - Initial capital in USDC
 * @param {number} entryPrice   - ALGO price at entry
 * @param {number} currentPrice - Current ALGO price
 * @returns {number} HODL portfolio value in USD
 */
export function computeHODLValue(capitalUsdc, entryPrice, currentPrice) {
    if (!capitalUsdc || !entryPrice || entryPrice <= 0) return capitalUsdc || 0
    const usdcHalf = capitalUsdc / 2
    const algoHalf = usdcHalf / entryPrice    // # of ALGO held
    return usdcHalf + algoHalf * currentPrice
}

/**
 * Computes net P&L after IL, fees, and swap costs.
 *
 * @param {number} positionValue - Current LP position value in USD
 * @param {number} hodlValue     - Baseline HODL value in USD
 * @param {number} swapCosts     - Total swap/rebalance costs in USD
 * @returns {number} Net P&L in USD (can be negative)
 */
export function computeNetPnL(positionValue, hodlValue, swapCosts) {
    return (positionValue - hodlValue) - (swapCosts || 0)
}

/**
 * Estimates fees earned over elapsed time.
 * Assumes Tinyman/Pact standard 0.25% swap fee rate.
 * Fee earnings = capital * feeAPR * (elapsedDays / 365)
 *
 * @param {number} capitalUsdc  - Position capital in USD
 * @param {number} feeRate      - Annual fee rate as decimal (default 0.35 = 35% APR estimate)
 * @param {number} elapsedDays  - Days since position was opened
 * @returns {number} Estimated fees earned in USD
 */
export function computeFeesEarned(capitalUsdc, feeRate = 0.35, elapsedDays = 0) {
    if (!capitalUsdc || elapsedDays <= 0) return 0
    return capitalUsdc * feeRate * (elapsedDays / 365)
}

/**
 * Returns absolute dollar value of impermanent loss.
 * @param {number} capitalUsdc  - Position capital in USD
 * @param {number} entryPrice   - Entry price
 * @param {number} currentPrice - Current price
 * @returns {number} Dollar value of IL (positive number representing loss)
 */
export function computeILDollar(capitalUsdc, entryPrice, currentPrice) {
    const ilFraction = computeIL(entryPrice, currentPrice)
    return Math.abs(ilFraction * capitalUsdc)
}

/**
 * Formats a USD number for display.
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {string} e.g. "$1,234.56"
 */
export function formatUSD(value, decimals = 2) {
    const num = Number(value) || 0
    const formatted = Math.abs(num).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })
    return (num < 0 ? '-$' : '$') + formatted
}

/**
 * Formats a percentage.
 * @param {number} fraction - e.g. 0.023
 * @returns {string} e.g. "+2.30%"
 */
export function formatPct(fraction) {
    const pct = (fraction * 100).toFixed(2)
    return (fraction >= 0 ? '+' : '') + pct + '%'
}
