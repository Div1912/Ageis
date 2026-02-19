/**
 * LivePulse — animated green indicator dot for active positions.
 */
import React from 'react'

export default function LivePulse({ size = 8, color = '#10B981' }) {
    return (
        <span
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: color,
                animation: 'livePulse 2s ease-in-out infinite',
                flexShrink: 0,
            }}
        />
    )
}
