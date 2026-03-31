import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "ssh2",
    "ssh2-sftp-client",
    "basic-ftp",
    "kafkajs",
    "mqtt",
    "amqplib",
    "ioredis",
    "pg",
    "mysql2",
    "mongodb",
    "pdfkit",
    "sharp",
    "pdf-parse",
    // pdfjs-dist removed — it's a client-only lib and must be bundled by webpack for the browser
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // pdfjs-dist tries to require('canvas') in Node envs; stub it out for the browser bundle
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, unknown>),
        canvas: false,
      };
    }
    // pdfjs-dist v5 ships ESM-only .mjs files; tell webpack to handle them in
    // auto mode so it doesn't apply strict ESM rules that break Object.defineProperty
    config.module.rules.push({
      test: /node_modules[\\/]pdfjs-dist[\\/].*\.mjs$/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    });
    return config;
  },
};

export default nextConfig;
