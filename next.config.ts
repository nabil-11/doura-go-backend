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
};

export default nextConfig;
