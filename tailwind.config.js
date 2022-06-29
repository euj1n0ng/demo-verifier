module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        yellow: {
          500: '#EFB604'
        }
      }
    }
  },
  plugins: [
    require("tailwindcss-font-inter"),
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography")
  ]
}
