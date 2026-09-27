import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NamWatch · เฝ้าน้ำ",
    short_name: "NamWatch",
    description: "Live flood conditions across Bangkok",
    start_url: "/th",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2C3E8F",
    orientation: "portrait",
    categories: ["weather", "news", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
