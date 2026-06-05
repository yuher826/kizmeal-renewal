import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#E8F5E9] to-white">
      <div className="text-center max-w-md">
        <Link href="/" className="inline-flex items-center justify-center w-14 h-14 bg-[#2D6A4F] rounded-2xl mb-6 shadow-lg">
          <span className="text-white font-bold text-2xl font-serif">K</span>
        </Link>
        <h1 className="font-serif font-bold text-8xl text-[#2D6A4F] leading-none mb-4">404</h1>
        <p className="font-serif font-semibold text-xl text-[#1B4332] mb-2">
          페이지를 찾을 수 없어요 🍱
        </p>
        <p className="text-gray-500 mb-8">요청하신 페이지가 존재하지 않습니다.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            홈으로 돌아가기
          </Link>
          <Link
            href="/inquiry"
            className="inline-flex items-center justify-center border-2 border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#2D6A4F] hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            문의하기
          </Link>
        </div>
      </div>
    </div>
  );
}
