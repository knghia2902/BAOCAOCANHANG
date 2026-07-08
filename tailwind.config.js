/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#f0426e", // Consolidated primary pink
                "strawberry-cream": "#ffb3c1",
                "background-light": "#fff9fa",
                "background-dark": "#1a0b0e",
                "soft-pink": "#ffe5ec",
                "white-pink": "#fff9fb",
                "pastel-pink": "#ffe5ec",
                "pastel-peach": "#fff1e6",
                "pastel-lavender": "#f2e9fb",
                "soft-rose": "#fb6f92",
                "cute-peach": "#ffe5d9",
                "cute-lavender": "#f2e9fb",
                "cloud-white": "#ffffff",
                "cream": "#fffcf5",
            },
            fontFamily: {
                "display": ["Space Grotesk", "Fredoka", "sans-serif"],
                "body": ["Noto Sans", "Quicksand", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "1.5rem",
                "lg": "2.5rem",
                "xl": "4rem",
                "full": "9999px",
                "puffy": "2rem",
                "cloud": "3rem"
            },
        },
    },
    plugins: [],
}
