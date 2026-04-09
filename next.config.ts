import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
  },
  assetPrefix: "../",
  reactStrictMode: false,
  trailingSlash: true,
  experimental: {
    optimizeCss: false,
  },
  async headers() {
    return [
      {
        // Allow Safe App to embed this dApp in an iframe
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://app.safe.global https://*.safe.global",
          },
        ],
      },
      {
        source: "/pay/",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};

export default nextConfig;
