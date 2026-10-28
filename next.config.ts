import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  trailingSlash: true,
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Pinned to the commit so builds are reproducible; the default id is random.
  generateBuildId: async () => process.env.SOURCE_COMMIT || "dev",
  experimental: {
    optimizeCss: false,
  },

  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./src/lib/emptyModule.ts",
      "pino-pretty": "./src/lib/emptyModule.ts",
      accounts: "./src/lib/emptyModule.ts",
    },
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    // Optional deps of the wallet SDKs that this app never loads.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
      accounts: false,
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

export default (phase: string): NextConfig => ({
  ...nextConfig,
  // Relative asset URLs let the export be served from any path. Builds only:
  // with a relative prefix, Turbopack's dev client never hydrates.
  ...(phase === PHASE_DEVELOPMENT_SERVER ? {} : { assetPrefix: "../" }),
});
