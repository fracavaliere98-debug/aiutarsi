import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "export",
  // I testi legali stanno in ../shared (fonte unica con l'app): Next deve poter importare file fuori da landing/.
  experimental: { externalDir: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
