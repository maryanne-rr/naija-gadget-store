import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photos are 900x675. Without this, next/image picks its srcset
    // widths for the largest common display size and requests w=3840 - an
    // upscale of a 900px file, which is slow to download and no sharper.
    // Capping deviceSizes at 750 means the browser picks something sane for the
    // ~330px card columns this grid actually uses.
    deviceSizes: [640, 750, 1080, 1200, 1920],
    imageSizes: [96, 128, 192, 256, 384],

    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
