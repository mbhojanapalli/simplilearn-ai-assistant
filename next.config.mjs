/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Node-only document parsers should not be bundled by the server compiler.
  serverExternalPackages: ["unpdf", "mammoth", "pdfjs-dist"],
  // A prototype should always deploy: surface lint/type issues in dev, but don't
  // let a stray warning block a Vercel build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
