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
                "primary": "#4a78c2", // Professional Pastel Blue
                "strawberry-cream": "#b0c4de", // Light Steel Blue
                "background-light": "#f0f4f8", // Very light blue-gray
                "background-dark": "#1e293b", // Dark Slate
                "soft-pink": "#e2ecfc", // Soft ice blue
                "white-pink": "#f8fafc",
                "pastel-pink": "#dbeafe",
                "pastel-peach": "#e0f2fe",
                "pastel-lavender": "#f1f5f9",
                "soft-rose": "#6495ed", // Cornflower Blue
                "cute-peach": "#e2e8f0",
                "cute-lavender": "#f1f5f9",
                "cloud-white": "#ffffff",
                "cream": "#f8fafc",
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
