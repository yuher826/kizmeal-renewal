/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.wixstatic.com',
        pathname: '/media/**',
      },
    ],
  },
  async redirects() {
    return [
      // 식단 자동화 (와일드카드 금지 — 개별 명시)
      { source: '/board/admin/diet-automation',         destination: '/erp/diet',    permanent: false },
      { source: '/board/admin/diet-automation/review',  destination: '/erp/review',  permanent: false },
      { source: '/board/admin/diet-automation/upload',  destination: '/erp/upload',  permanent: false },
      { source: '/board/admin/diet-automation/history', destination: '/erp/history', permanent: false },
      // 운영 문의 (하위 경로 와일드카드 허용)
      { source: '/board/admin/inquiries',               destination: '/erp/inquiries',              permanent: false },
      { source: '/board/admin/inquiries/:path*',        destination: '/erp/inquiries/:path*',        permanent: false },
      // 원 관리
      { source: '/board/admin/branches',                destination: '/erp/centers',  permanent: false },
      { source: '/board/admin/branches/:path*',         destination: '/erp/centers/:path*', permanent: false },
      // 통계
      { source: '/board/admin/stats',                   destination: '/erp/stats',    permanent: false },
    ]
  },
};

export default nextConfig;
