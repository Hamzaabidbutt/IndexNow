import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#060B1C", 900: "#0A1128", 800: "#101A3A", 700: "#1A2750" },
        brand: { DEFAULT: "#2563EB", light: "#3B82F6", cyan: "#06B6D4" },
      },
      borderRadius: { card: "16px" },
    },
  },
  plugins: [],
};
export default config;
