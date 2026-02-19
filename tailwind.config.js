/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    base: '#080B0F',
                    surface: '#0F1318',
                    card: '#161C24',
                    hover: '#1A2130',
                },
                border: {
                    DEFAULT: '#1E2730',
                },
                accent: {
                    primary: '#00C896',
                    positive: '#10B981',
                    negative: '#EF4444',
                    warning: '#F59E0B',
                    neutral: '#6B7280',
                },
                text: {
                    primary: '#F1F5F9',
                    secondary: '#94A3B8',
                    muted: '#475569',
                    label: '#64748B',
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
        },
    },
    plugins: [],
}
