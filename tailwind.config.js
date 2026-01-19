/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'Segoe UI', 'sans-serif'],
                mono: ['SF Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
            },
            colors: {
                // Apple-style palette
                ios: {
                    bg: '#000000',      // Base background (OLED Black)
                    card: '#1C1C1E',    // Secondary background (Cards)
                    border: 'rgba(255, 255, 255, 0.1)',
                    text: '#FFFFFF',
                    subtext: '#98989D',
                    // Light Mode Variants
                    'bg-light': '#F2F2F7',     // System Gray 6
                    'surface-light': '#FFFFFF', // Cards
                    'border-light': 'rgba(0, 0, 0, 0.1)',
                    'text-light': '#000000',
                    'glass-light': 'rgba(255, 255, 255, 0.8)',
                    'glass-dark': 'rgba(28, 28, 30, 0.8)',
                    blue: '#0A84FF',
                    green: '#30D158',
                    indigo: '#5E5CE6',
                    orange: '#FF9F0A',
                    pink: '#FF375F',
                    purple: '#BF5AF2',
                    red: '#FF453A',
                    teal: '#64D2FF',
                    yellow: '#FFD60A',
                    gray: '#8E8E93',
                },
                // Mappings for existing code
                'cyber-dark': '#000000',
                'neon-cyan': '#64D2FF',
                'neon-pink': '#FF375F',
                'neon-purple': '#BF5AF2'
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                'glow': '0 0 20px rgba(255, 255, 255, 0.15)'
            }
        }
    },
    plugins: []
}
