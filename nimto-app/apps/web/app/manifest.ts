import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "myNimto Digital Invitations",
    short_name: "myNimto",
    description: "Create, share, and manage beautiful digital invitations.",
    id: "/",
    start_url: "/events?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2f6",
    theme_color: "#8127d8",
    orientation: "any",
    categories: ["lifestyle", "productivity", "social"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
