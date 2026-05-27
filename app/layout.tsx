import type { Metadata } from "next";
import { Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSerifKr = Noto_Serif_KR({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-serif",
  preload: false,
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-sans",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "키즈밀 | 아이들을 위한 건강한 급식 솔루션",
  description:
    "키즈밀은 어린이집·유치원·학교를 위한 프리미엄 단체급식 서비스입니다. 영양사가 설계한 균형 잡힌 식단으로 아이들의 건강한 성장을 지원합니다.",
  keywords: [
    "키즈밀",
    "어린이 급식",
    "유치원 급식",
    "어린이집 급식",
    "학교 급식",
    "단체급식",
    "영양사 식단",
    "건강식",
    "KIZMEAL",
  ],
  authors: [{ name: "키즈밀" }],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://kizmeal.com",
    siteName: "키즈밀",
    title: "키즈밀 | 아이들을 위한 건강한 급식 솔루션",
    description:
      "어린이집·유치원·학교를 위한 프리미엄 단체급식 서비스. 영양사가 설계한 균형 잡힌 식단으로 아이들의 건강한 성장을 지원합니다.",
    images: [
      {
        url: "https://static.wixstatic.com/media/6db056_e33d9e5b5e024ff39ec4a5315a34ac5e~mv2.jpg/v1/fit/w_1200,h_630,al_c/6db056_e33d9e5b5e024ff39ec4a5315a34ac5e~mv2.jpg",
        width: 1200,
        height: 630,
        alt: "키즈밀 건강 급식",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "키즈밀 | 아이들을 위한 건강한 급식 솔루션",
    description: "어린이집·유치원·학교를 위한 프리미엄 단체급식 서비스",
    images: [
      "https://static.wixstatic.com/media/6db056_e33d9e5b5e024ff39ec4a5315a34ac5e~mv2.jpg/v1/fit/w_1200,h_630,al_c/6db056_e33d9e5b5e024ff39ec4a5315a34ac5e~mv2.jpg",
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSerifKr.variable} ${notoSansKr.variable}`}>
      <head>
        <meta name="theme-color" content="#2D6A4F" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="키즈밀" />
      </head>
      <body className="antialiased font-sans bg-white text-[#0D1B0F]">
        {children}
      </body>
    </html>
  );
}
