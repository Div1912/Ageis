/**
 * MatrixRain — green hacker-style falling code animation.
 * Canvas-based for performance. Uses AEGIS accent green (#00C896).
 * Renders behind content with proper z-indexing.
 */
import React, { useEffect, useRef } from 'react'

// Characters to rain: mix of katakana, digits, and code symbols
const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF{}[]<>=/+-*#@!$%&|~'

export default function MatrixRain({ opacity = 0.12 }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        let animationId
        let columns = []
        const fontSize = 14
        const speed = 0.6

        function resize() {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight

            const colCount = Math.floor(canvas.width / fontSize)
            columns = Array.from({ length: colCount }, () => ({
                y: Math.random() * canvas.height / fontSize * -1, // start above screen at random heights
                speed: 0.3 + Math.random() * speed,
                chars: Array.from({ length: Math.ceil(canvas.height / fontSize) + 10 }, () =>
                    CHARS[Math.floor(Math.random() * CHARS.length)]
                ),
            }))
        }

        function draw() {
            // Semi-transparent black overlay to create fade trail
            ctx.fillStyle = 'rgba(0, 0, 0, 0.06)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            columns.forEach((col, i) => {
                const x = i * fontSize
                const charIndex = Math.floor(col.y) % col.chars.length
                const char = col.chars[Math.abs(charIndex)]

                // Head character — bright green
                const headY = col.y * fontSize
                ctx.fillStyle = `rgba(0, 200, 150, ${0.95})`
                ctx.font = `${fontSize}px 'JetBrains Mono', monospace`
                ctx.fillText(char, x, headY)

                // Trail characters — fading green
                for (let j = 1; j < 20; j++) {
                    const trailY = (col.y - j) * fontSize
                    if (trailY < 0) continue
                    const trailAlpha = Math.max(0, 0.5 - j * 0.03)
                    ctx.fillStyle = `rgba(0, 200, 150, ${trailAlpha})`
                    const trailChar = col.chars[Math.abs((charIndex - j) % col.chars.length)]
                    ctx.fillText(trailChar, x, trailY)
                }

                // Move column down
                col.y += col.speed

                // Randomly change a character in the trail
                if (Math.random() < 0.02) {
                    const randIdx = Math.floor(Math.random() * col.chars.length)
                    col.chars[randIdx] = CHARS[Math.floor(Math.random() * CHARS.length)]
                }

                // Reset column when it goes past the bottom
                if (col.y * fontSize > canvas.height + 200) {
                    col.y = Math.random() * -20
                    col.speed = 0.3 + Math.random() * speed
                }
            })

            animationId = requestAnimationFrame(draw)
        }

        resize()
        draw()

        window.addEventListener('resize', resize)
        return () => {
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animationId)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                pointerEvents: 'none',
                opacity,
            }}
        />
    )
}
