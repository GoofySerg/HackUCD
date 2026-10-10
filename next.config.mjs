/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit ships its own font .afm files that must be treated as external on the server
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
