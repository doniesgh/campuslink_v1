import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest and linked from every page).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CampusLink",
    short_name: "CampusLink",
    description: "Your campus in one app: forum, notifications and your account, even offline.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#253C6D",
    background_color: "#FFFFFF",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Forum", short_name: "Forum", url: "/dashboard/forum", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notifications", short_name: "Notifications", url: "/dashboard/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My account", short_name: "Account", url: "/dashboard/account", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      // Admins only (others are sent to /dashboard).
      { name: "Users", short_name: "Users", url: "/dashboard/admin/users", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
