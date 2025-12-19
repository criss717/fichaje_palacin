/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./App.{js,jsx,ts,tsx}",
        "./src/**/*.{js,jsx,ts,tsx}"
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#1E3A8A',
                    dark: '#1e40af',
                    light: '#3B82F6',
                },
                secondary: '#3B82F6',
                accent: '#60A5FA',
                background: '#F0F9FF',
                textPrimary: '#1F2937',
                success: '#10B981',
                error: '#EF4444',
            },
        },
    },
    plugins: [],
}
