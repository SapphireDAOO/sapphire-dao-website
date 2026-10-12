import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: "../",
  reactStrictMode: false,
  trailingSlash: true,
  // Pinned to the commit so builds are reproducible; the default id is random.
  generateBuildId: async () => process.env.SOURCE_COMMIT || "dev",
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
            value:
              "frame-ancestors 'self' https://app.safe.global https://*.safe.global",
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
    // Optional deps of the wallet SDKs that never run in a browser.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    // Deterministic ids: by default they race
    // between builds of identical source.
    config.optimization = {
      ...config.optimization,
      moduleIds: "deterministic",
    };
    return config;
  },
};

export default nextConfig;
