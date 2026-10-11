import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: "../",
  reactStrictMode: false,
  trailingSlash: true,
  // Reproducible builds: the default build id is random, which changes the
  // static/<id>/ directory name and every manifest on every build. Pin it to
  // the commit being built so two builds of one commit are byte-identical.
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
    // Optional imports in the wallet SDKs that never run in a browser:
    // MetaMask's React Native storage and pino's pretty printer. Resolving
    // them to empty modules keeps webpack quiet without installing either,
    // and async-storage would otherwise pull in all of React Native.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    // Server chunks otherwise get module ids assigned in compilation-finish
    // order, which races: ids swap between builds of identical source.
    config.optimization = {
      ...config.optimization,
      moduleIds: "deterministic",
    };
    return config;
  },
};

export default nextConfig;
