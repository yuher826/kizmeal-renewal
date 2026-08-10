import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => {
  // 개발 모드(next dev)에서만 적용 — 프로덕션 빌드/배포에는 영향 없음.
  // Windows에서 여러 워커가 동시에 공용 청크 파일에 쓰기 경합을 벌이며
  // 발생하는 "-4094 UNKNOWN open layout.js" 에러 대응.
  // workerThreads/cpus 제한만으로는 -4094 UNKNOWN / pack.gz rename ENOENT가
  // 계속 발생 — 근본 원인은 웹팩 디스크 캐시(.next/cache/webpack) 파일 쓰기
  // 시점의 경합이므로, 아래 webpack() 훅에서 디스크 캐시를 끄고 메모리 캐시만 쓴다.
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    experimental: {
      serverComponentsExternalPackages: ['puppeteer'],
      ...(isDev
        ? {
            workerThreads: false,
            cpus: 1,
          }
        : {}),
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
    webpack: (config) => {
      if (isDev) {
        // 디스크 캐시(.next/cache/webpack/*.pack.gz) 대신 메모리 캐시만 사용.
        // 여러 워커/프로세스가 같은 캐시 파일에 동시에 쓰기·rename을 시도하며
        // 나던 -4094 UNKNOWN, pack.gz rename ENOENT를 파일 쓰기 자체를
        // 없애서 해결한다. 빌드 속도에 영향 없도록 dev 전용으로만 적용.
        config.cache = false;
      }
      return config;
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
};

export default nextConfig;
