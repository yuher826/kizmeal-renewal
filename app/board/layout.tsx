import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '키즈밀 소통채널',
  description: '키즈밀 1:1 게시판',
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
