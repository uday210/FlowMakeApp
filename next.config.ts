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
  ],
};

export default nextConfig;
