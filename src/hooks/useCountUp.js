/**
 * useCountUp — animates a number from 0 to target value.
 * Uses requestAnimationFrame for smooth 60fps animation.
 *
 * @param {number} targetValue - Final value to animate to
 * @param {number} [duration=1200] - Animation duration in ms
 * @returns {number} Current animated value
 */
import { useState, useEffect, useRef } from 'react'

export function useCountUp(targetValue, duration = 1200) {
    const [current, setCurrent] = useState(0)
    const rafRef = useRef(null)
    const startTimeRef = useRef(null)
    const startValueRef = useRef(0)

    useEffect(() => {
        if (targetValue === undefined || targetValue === null) return

        const startValue = startValueRef.current
        const delta = targetValue - startValue

        // Only re-animate if the change is significant (> $0.50)
        if (Math.abs(delta) < 0.5) {
            setCurrent(targetValue)
            startValueRef.current = targetValue
            return
        }

        startTimeRef.current = null

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp
            const elapsed = timestamp - startTimeRef.current
            const progress = Math.min(elapsed / duration, 1)

            // easeOut cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            const value = startValue + delta * eased

            setCurrent(value)

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate)
            } else {
                setCurrent(targetValue)
                startValueRef.current = targetValue
            }
        }

        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(animate)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [targetValue, duration])

    return current
}
