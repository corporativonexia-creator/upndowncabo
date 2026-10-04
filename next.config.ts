import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xlkjztcxqlsegboivccg.supabase.co",
        pathname: "/storage/v1/object/public/site-content/**",
      },
    ],
  },
};

export default nextConfig;
