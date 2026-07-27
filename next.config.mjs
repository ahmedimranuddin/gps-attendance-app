/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit/exceljs/bcryptjs/jsonwebtoken read files or use Node APIs that
  // don't work bundled for the Edge runtime — keep them external so the
  // Node.js runtime just requires() them normally.
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'exceljs', 'bcryptjs', 'jsonwebtoken']
  }
};

export default nextConfig;
