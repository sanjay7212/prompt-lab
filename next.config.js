/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow iframe embedding from any origin
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // Remove Content-Security-Policy frame-ancestors restriction
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
