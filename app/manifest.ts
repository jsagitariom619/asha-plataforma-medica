import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ASHA Integrative Medicine",
    short_name: "ASHA",
    description: "Plataforma médica de ASHA Integrative Medicine",
    start_url: "/",
    display: "standalone",
    background_color: "#f5eee4",
    theme_color: "#f5eee4",
    orientation: "portrait-primary",
    icons: [
      { src: "/asha-icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/asha-icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/asha-icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
