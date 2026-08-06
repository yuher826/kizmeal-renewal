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
      // 원 관리 (구 board 화면·/erp/centers 삭제 — 정식 후계는 /erp/branches.
      //  하위 경로는 ID 체계가 달라 :path* 그대로 매핑하면 404가 나므로 목록으로 고정)
      { source: '/board/admin/branches',                destination: '/erp/branches', permanent: false },
      { source: '/board/admin/branches/:path*',         destination: '/erp/branches', permanent: false },
      { source: '/erp/centers',                         destination: '/erp/branches', permanent: false },
      { source: '/erp/centers/:path*',                  destination: '/erp/branches', permanent: false },
      // 통계
      { source: '/board/admin/stats',                   destination: '/erp/stats',    permanent: false },
    ]
  },
};

export default nextConfig;
