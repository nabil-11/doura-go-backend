import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    serverActions: {
      // Driver onboarding uploads up to 5 documents (4 MB each) in one form.
      bodySizeLimit: "24mb",
    },
    // Proxy buffers request bodies; keep it above the server action limit.
    proxyClientMaxBodySize: "25mb",
  },
  async headers() {
    return [
      {
        // Android only offers to install a file it is handed with this type;
        // served as a generic download it just sits in the Downloads folder.
        source: "/downloads/:file*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="doura-go-driver.apk"' },
          // A new build replaces the file at the same URL.
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
