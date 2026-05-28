'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// ── Images ───────────────────────────────────────────────────────
const HERO_IMG =
  'https://static.wixstatic.com/media/8666db_83dd16294759404992cee96c1cf7815d~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/8666db_83dd16294759404992cee96c1cf7815d~mv2.jpg';

const ZONE_IMG = {
  sanitize:
    'https://static.wixstatic.com/media/8666db_70cb062a7f0d4118b2e6b44a92c729e0~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/8666db_70cb062a7f0d4118b2e6b44a92c729e0~mv2.jpg',
  prep:
    'https://static.wixstatic.com/media/8666db_8fde19a28e7c4e079ad29c447d06ac63~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/8666db_8fde19a28e7c4e079ad29c447d06ac63~mv2.jpg',
  cook:
    'https://static.wixstatic.com/media/8666db_5e75dcce586a421e8ff6c5b39d400b4f~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/8666db_5e75dcce586a421e8ff6c5b39d400b4f~mv2.jpg',
  fridge:
    'https://static.wixstatic.com/media/6db056_216e701b32b0427a8b0180b2a5a4ab1c~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/6db056_216e701b32b0427a8b0180b2a5a4ab1c~mv2.jpg',
  pack:
    'https://static.wixstatic.com/media/8666db_5612e11c08dc4433af03a77dabddbd9e~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/8666db_5612e11c08dc4433af03a77dabddbd9e~mv2.jpg',
  wash:
    'https://static.wixstatic.com/media/8666db_d141d39fc00141ebb2652eda3f5b209f~mv2.jpg/v1/fill/w_1920,h_1080,al_c,q_90/8666db_d141d39fc00141ebb2652eda3f5b209f~mv2.jpg',
};

type GalleryCategory = '위생실' | '전처리실' | '조리실' | '냉장·냉동' | '포장실' | '세척실';
type GalleryItem = { category: GalleryCategory; src: string };

const GALLERY: GalleryItem[] = [
  { category: '위생실', src: 'https://static.wixstatic.com/media/8666db_70cb062a7f0d4118b2e6b44a92c729e0~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_70cb062a7f0d4118b2e6b44a92c729e0~mv2.jpg' },
  { category: '위생실', src: 'https://static.wixstatic.com/media/8666db_1ca95a25f6a8417ab7f76553e3578927~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_1ca95a25f6a8417ab7f76553e3578927~mv2.jpg' },
  { category: '위생실', src: 'https://static.wixstatic.com/media/6db056_c7164b99bb9946b38b5d0da458fff949~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/6db056_c7164b99bb9946b38b5d0da458fff949~mv2.jpg' },
  { category: '전처리실', src: 'https://static.wixstatic.com/media/8666db_8fde19a28e7c4e079ad29c447d06ac63~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_8fde19a28e7c4e079ad29c447d06ac63~mv2.jpg' },
  { category: '전처리실', src: 'https://static.wixstatic.com/media/8666db_81bf49dbf7324348b01c7e9aeb86b1ce~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_81bf49dbf7324348b01c7e9aeb86b1ce~mv2.jpg' },
  { category: '전처리실', src: 'https://static.wixstatic.com/media/8666db_2b7908dc9a2e46b49890369dbe7f0374~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_2b7908dc9a2e46b49890369dbe7f0374~mv2.jpg' },
  { category: '조리실', src: 'https://static.wixstatic.com/media/8666db_83dd16294759404992cee96c1cf7815d~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_83dd16294759404992cee96c1cf7815d~mv2.jpg' },
  { category: '조리실', src: 'https://static.wixstatic.com/media/8666db_5e75dcce586a421e8ff6c5b39d400b4f~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_5e75dcce586a421e8ff6c5b39d400b4f~mv2.jpg' },
  { category: '조리실', src: 'https://static.wixstatic.com/media/6db056_5c5ed7c7699c4c469e98d3371fdd3561~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/6db056_5c5ed7c7699c4c469e98d3371fdd3561~mv2.jpg' },
  { category: '냉장·냉동', src: 'https://static.wixstatic.com/media/6db056_216e701b32b0427a8b0180b2a5a4ab1c~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/6db056_216e701b32b0427a8b0180b2a5a4ab1c~mv2.jpg' },
  { category: '냉장·냉동', src: 'https://static.wixstatic.com/media/6db056_0eb8b35d079a484990f9ace473fb0a56~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/6db056_0eb8b35d079a484990f9ace473fb0a56~mv2.jpg' },
  { category: '냉장·냉동', src: 'https://static.wixstatic.com/media/6db056_a48c8bed19c041c291c4e37f96c7ef42~mv2.jpeg/v1/fill/w_800,h_600,al_c,q_90/6db056_a48c8bed19c041c291c4e37f96c7ef42~mv2.jpeg' },
  { category: '포장실', src: 'https://static.wixstatic.com/media/8666db_5612e11c08dc4433af03a77dabddbd9e~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_5612e11c08dc4433af03a77dabddbd9e~mv2.jpg' },
  { category: '포장실', src: 'https://static.wixstatic.com/media/8666db_43b901d3da89492ea04140517406b20d~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_43b901d3da89492ea04140517406b20d~mv2.jpg' },
  { category: '포장실', src: 'https://static.wixstatic.com/media/8666db_0c63a351f98e4d919bc1740d5ffc3452~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_0c63a351f98e4d919bc1740d5ffc3452~mv2.jpg' },
  { category: '세척실', src: 'https://static.wixstatic.com/media/8666db_d141d39fc00141ebb2652eda3f5b209f~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_d141d39fc00141ebb2652eda3f5b209f~mv2.jpg' },
  { category: '세척실', src: 'https://static.wixstatic.com/media/8666db_ea164c2652884516bb93dcc638b4bd53~mv2.jpg/v1/fill/w_800,h_600,al_c,q_90/8666db_ea164c2652884516bb93dcc638b4bd53~mv2.jpg' },
];

const TABS: ('전체' | GalleryCategory)[] = ['전체', '위생실', '전처리실', '조리실', '냉장·냉동', '포장실', '세척실'];

const ZONES = [
  {
    num: '01',
    name: '위생실',
    promise: '단 하나의 오염물질도\n이 문을 통과할 수 없습니다',
    desc: '에어커튼 설치로 외부 오염 차단. 조리 전 철저한 위생 관리로 청결한 환경을 유지합니다.',
    points: ['에어커튼 설치', '손소독 시스템', '전원 위생복 착용'],
    img: ZONE_IMG.sanitize,
  },
  {
    num: '02',
    name: '전처리실',
    promise: '신선한 것만,\n위생적으로 손질합니다',
    desc: '대기업 식재료를 엄격한 기준으로 세척하고 손질합니다.',
    points: ['전용 위생소독고', '식재료별 구분 처리', '교차오염 완전 차단'],
    img: ZONE_IMG.prep,
  },
  {
    num: '03',
    name: '조리실',
    promise: '내 아이에게 주고 싶은 음식만\n이 공간에서 만들어집니다',
    desc: '전담 영양사의 레시피를 바탕으로 균형 잡힌 영양식을 조리합니다.',
    points: ['영양사 레시피 100% 준수', '75°C 이상 완전 가열', '밥·주메뉴 구역 분리'],
    img: ZONE_IMG.cook,
  },
  {
    num: '04',
    name: '냉장·냉동실',
    promise: '신선함을\n끝까지 지킵니다',
    desc: '워크인 냉장·냉동 시스템으로 식재료의 신선도를 끝까지 보장합니다.',
    points: ['냉장 0~4°C 유지', '냉동 -18°C 이하 유지', '24시간 온도 모니터링'],
    img: ZONE_IMG.fridge,
  },
  {
    num: '05',
    name: '포장실',
    promise: '깨끗하게 담아\n정성스럽게 전달합니다',
    desc: '엔터팩 시스템으로 위생적으로 포장. 최종 품질 검사 후 출고합니다.',
    points: ['엔터팩 위생 포장', '출고 전 품질 검사', '알레르기 표시 확인'],
    img: ZONE_IMG.pack,
  },
  {
    num: '06',
    name: '세척실',
    promise: '다음에도, 또 다음에도\n안전하게 만들겠습니다',
    desc: '모든 도구와 용기를 철저하게 세척하고 소독합니다.',
    points: ['고온 소독 시스템', '전용 세척 구역', '재오염 방지 관리'],
    img: ZONE_IMG.wash,
  },
];

const TIMELINE = [
  { time: 'AM 03:00', icon: '🌙', title: '식재료 입고 및 검수 시작', desc: '하루의 시작. 신선한 재료가 들어오고 품질을 검수합니다.' },
  { time: 'AM 03:30', icon: '🧼', title: '위생 점검 + 전처리 시작', desc: '전 직원 위생 복장 착용 완료. 에어커튼 가동, 6개 구역 점검 후 식재료 손질을 시작합니다.' },
  { time: 'AM 04:00', icon: '🔪', title: '조리 시작', desc: '전담 조리사가 영양사 레시피에 따라 건강한 한 끼를 만들기 시작합니다.' },
  { time: 'AM 05:00', icon: '📦', title: '포장 + 품질 검사', desc: '엔터팩 시스템으로 위생 포장하고, 엄격한 품질 검사를 거칩니다.' },
  { time: 'AM 06:00', icon: '🚚', title: '배송 출발', desc: '첫 차를 시작으로 18대의\n냉동탑차가 순차적으로 출발합니다.' },
  { time: 'AM 10:30', icon: '🍽️', title: '아이들의 밥상', desc: '새벽 3시에 시작된 정성이\n오전 10시 30분,\n아이들의 건강한 한 끼가 됩니다.' },
];

const PARTNERS = ['CJ', '동원', '푸드머스', '아워홈', '매일유업', '우리밀'];

const FAQS = [
  {
    q: '식재료는 어디서 오나요?',
    a: 'CJ, 동원, 푸드머스, 아워홈, 매일유업, 우리밀 등 국내 대표 식품 기업들과 공식 계약을 맺고 있습니다. 엄격한 품질 기준에 맞는 식재료만 입고되며, 매일 품질 검수를 진행합니다.',
  },
  {
    q: '조리 과정은 정말 위생적인가요?',
    a: '키즈밀이 가장 중점을 두는 부분입니다. 6개 구역을 완전히 분리하여 교차오염을 원천 차단하고, 전 직원이 매일 위생 점검을 받습니다. 조리 온도는 75°C 이상을 유지합니다.',
  },
  {
    q: '알레르기가 있는 아이도 괜찮나요?',
    a: '키즈밀은 알레르기 전담 영양사를 별도로 배치하고 있습니다. 각 원의 알레르기 학생 정보를 데이터로 관리하며 1:1 맞춤 식단을 제공합니다.',
  },
  {
    q: '배송 중 음식이 상하지 않나요?',
    a: '키즈밀의 전 배송 차량은 냉동탑차입니다. 18대의 직영 냉동탑차가 배송 중에도 온도를 유지하여 신선함을 지킵니다. 당일 생산, 당일 배송이 원칙입니다.',
  },
  {
    q: '아이가 잘 못 먹으면 어떻게 하나요?',
    a: '각 원의 담당자와 지속적인 피드백 시스템을 운영합니다. 전담 영양사가 직접 식단을 조정하여 아이들의 기호와 영양을 균형있게 맞춰드립니다.',
  },
];

function WaveBottom({ fill = '#ffffff' }: { fill?: string }) {
  return (
    <div className="leading-[0]">
      <svg viewBox="0 0 1440 72" preserveAspectRatio="none" className="w-full h-[48px] sm:h-[72px] block">
        <path
          d="M0,36 C120,72 240,0 360,36 C480,72 600,0 720,36 C840,72 960,0 1080,36 C1200,72 1320,0 1440,36 L1440,72 L0,72 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}

function CountUp({ target, suffix = '', start }: { target: number; suffix?: string; start: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    const duration = 1600;
    const steps = 60;
    let s = 0;
    const id = setInterval(() => {
      s++;
      const eased = 1 - Math.pow(1 - s / steps, 3);
      setN(Math.round(target * eased));
      if (s >= steps) clearInterval(id);
    }, duration / steps);
    return () => clearInterval(id);
  }, [start, target]);
  return (
    <>
      {n.toLocaleString()}
      {suffix}
    </>
  );
}

export default function FacilityPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<'전체' | GalleryCategory>('전체');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const photos = activeTab === '전체' ? GALLERY : GALLERY.filter((g) => g.category === activeTab);

  const openLightbox = (index: number) => {
    console.log('클릭된 사진:', photos[index]);
    console.log('photos 배열 전체:', photos);
    console.log('lightboxIndex:', index, '→ src:', photos[index]?.src);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Stats count up trigger
  useEffect(() => {
    if (!statsRef.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStatsVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(statsRef.current);
    return () => io.disconnect();
  }, []);

  // Fade-in for .anim elements
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.15 }
    );
    document.querySelectorAll('.anim').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // ESC to close lightbox
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Body scroll lock while open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [lightboxOpen]);

  return (
    <main className="overflow-x-hidden">
      {/* ── SECTION 1: HERO ──────────────────────────────── */}
      <section className="relative flex items-center overflow-hidden min-h-[85vh]">
        <Image
          src={HERO_IMG}
          alt="키즈밀 조리실"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(27,67,50,0.95) 0%, rgba(27,67,50,0.80) 50%, rgba(27,67,50,0.40) 100%)',
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-36 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center border border-[#F4A261]/70 rounded-full px-4 py-1.5 mb-7">
              <span className="text-[#F4A261] text-xs font-semibold tracking-[0.2em] uppercase">
                2025년 1월 새롭게 오픈
              </span>
            </div>
            <h1 className="font-serif font-bold text-white leading-tight mb-7 text-3xl md:text-4xl lg:text-5xl">
              <div>매일 새벽 3시,</div>
              <div>아이들의 건강한 하루를 위해</div>
              <div>키즈밀의 하루가 시작됩니다</div>
            </h1>
            <p className="text-white/75 leading-relaxed max-w-xl text-lg md:text-xl">
              <span className="block">2025년 1월, 더 넓고 더 깨끗한 공간에서</span>
              <span className="block">더 정성스러운 급식을 약속드립니다</span>
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 z-[5]">
          <WaveBottom fill="#ffffff" />
        </div>
      </section>

      {/* ── BREADCRUMB ───────────────────────────────────── */}
      <nav className="bg-white pt-8" aria-label="Breadcrumb">
        <ol className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-2 text-sm text-[#6B7B6E]">
          <li>
            <Link href="/" className="hover:text-[#2D6A4F] transition-colors">홈</Link>
          </li>
          <li className="text-[#9BAA9D]">/</li>
          <li>
            <Link href="/about" className="hover:text-[#2D6A4F] transition-colors">회사소개</Link>
          </li>
          <li className="text-[#9BAA9D]">/</li>
          <li className="font-medium text-[#2D6A4F]">시설안내</li>
        </ol>
      </nav>

      {/* ── SECTION 2: TRANSPARENCY ──────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-[#E8F5E9] leading-none mb-6 select-none" style={{ fontSize: '6rem' }}>
            “
          </div>
          <p className="font-serif text-xl sm:text-2xl text-[#1C2B1E] leading-[1.9] anim anim-up">
            우리가 보여드릴 수 있는 모든 것을
            <br />
            투명하게 공개합니다.
            <br />
            그것이 22년간 키즈밀이
            <br />
            지켜온 약속이기 때문입니다.
          </p>
          <div className="h-px bg-[#E8F5E9] mt-16 max-w-md mx-auto" />
        </div>
      </section>

      {/* ── SECTION 3: KEY NUMBERS ──────────────────────── */}
      <section ref={statsRef} className="bg-[#1B4332] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
            <div className="anim anim-scale">
              <p className="text-white/55 text-xs font-medium tracking-[0.2em] uppercase mb-3">새벽 시작</p>
              <div className="font-serif font-bold text-white leading-none mb-3 text-5xl sm:text-6xl">
                <CountUp target={3} suffix="시" start={statsVisible} />
              </div>
              <p className="text-white/70 text-sm">매일 이 시간부터 시작합니다</p>
            </div>
            <div className="anim anim-scale">
              <p className="text-white/55 text-xs font-medium tracking-[0.2em] uppercase mb-3">위생 구역</p>
              <div className="font-serif font-bold text-white leading-none mb-3 text-5xl sm:text-6xl">
                <CountUp target={6} suffix="" start={statsVisible} />
                <span className="text-[#52B788]">개</span>
              </div>
              <p className="text-white/70 text-sm">완전히 분리된 시스템</p>
            </div>
            <div className="anim anim-scale">
              <p className="text-white/55 text-xs font-medium tracking-[0.2em] uppercase mb-3">냉동탑차</p>
              <div className="font-serif font-bold text-white leading-none mb-3 text-5xl sm:text-6xl">
                <CountUp target={18} suffix="대" start={statsVisible} />
              </div>
              <p className="text-white/70 text-sm">전 차량 직영 온도 관리</p>
            </div>
            <div className="anim anim-scale">
              <p className="text-white/55 text-xs font-medium tracking-[0.2em] uppercase mb-3">전담 영양사</p>
              <div className="font-serif font-bold leading-none mb-3 text-5xl sm:text-6xl">
                <span className="text-[#F4A261]">1:1</span>
              </div>
              <p className="text-white/70 text-sm">알레르기 맞춤 케어</p>
            </div>
          </div>
        </div>
        <div className="mt-20 -mb-1">
          <WaveBottom fill="#ffffff" />
        </div>
      </section>

      {/* ── SECTION 4: A DAY AT KIZMEAL ─────────────────── */}
      <section className="bg-white py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">
              A DAY AT KIZMEAL
            </p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1C2B1E] leading-tight anim anim-up delay-100">
              부모님이 주무시는 새벽 3시,
              <br />
              키즈밀은 이미 아이들의 밥상을
              <br />
              준비하고 있습니다
            </h2>
          </div>

          <ol className="relative border-l-2 border-[#E8F5E9] ml-4 sm:ml-10 space-y-4">
            {TIMELINE.map((step, i) => {
              const isLast = i === TIMELINE.length - 1;
              return (
                <li key={step.time} className="relative pl-8 sm:pl-12">
                  <span
                    className={`absolute -left-[9px] top-3 w-4 h-4 rounded-full ring-4 ring-white ${
                      isLast ? 'bg-[#F4A261]' : 'bg-[#2D6A4F]'
                    }`}
                  />
                  <div className="group rounded-2xl px-5 py-5 transition-colors duration-300 hover:bg-[#E8F5E9] anim anim-up">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-bold text-[#2D6A4F] tracking-wider">{step.time}</span>
                      <span className="text-xl">{step.icon}</span>
                    </div>
                    <h3 className="font-serif font-bold text-lg text-[#1C2B1E] mb-1.5">{step.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{step.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── SECTION 5: 6 ZONES ──────────────────────────── */}
      <section className="bg-[#F6FAF6] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3 anim anim-up">
              OUR PROMISE
            </p>
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1C2B1E] anim anim-up delay-100">
              6개의 공간,
              <br />6개의 약속
            </h2>
          </div>

          <div className="space-y-20 sm:space-y-24">
            {ZONES.map((zone, i) => {
              const imgRight = i % 2 === 0;
              return (
                <div
                  key={zone.num}
                  className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
                >
                  {/* Image (mobile: top, desktop: alternating sides) */}
                  <div className={`anim ${imgRight ? 'lg:order-2 anim-right' : 'lg:order-1 anim-left'} delay-200`}>
                    <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-[#1B4332]/15">
                      <Image
                        src={zone.img}
                        alt={zone.name}
                        fill
                        loading="lazy"
                        className="object-cover hover:scale-105 transition-transform duration-700"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                  {/* Text */}
                  <div className={`anim anim-up ${imgRight ? 'lg:order-1' : 'lg:order-2'}`}>
                    <div className="text-[#F4A261] font-serif font-bold text-5xl mb-3">{zone.num}</div>
                    <p className="text-[#2D6A4F] font-semibold tracking-widest text-sm uppercase mb-4">
                      {zone.name}
                    </p>
                    <h3 className="font-serif font-bold text-2xl sm:text-3xl text-[#1B4332] leading-snug mb-5 whitespace-pre-line">
                      {zone.promise}
                    </h3>
                    <p className="text-gray-600 text-base leading-relaxed mb-6">{zone.desc}</p>
                    <ul className="space-y-2.5">
                      {zone.points.map((p) => (
                        <li key={p} className="flex items-start gap-3 text-[#1C2B1E]">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-xs font-bold">
                            ✓
                          </span>
                          <span className="text-sm sm:text-base">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: PARTNERS ─────────────────────────── */}
      <section className="bg-[#1B4332] py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif font-bold text-white text-3xl sm:text-4xl mb-4 anim anim-up">
            믿을 수 있는 기업들과
            <br />
            함께합니다
          </h2>
          <p className="text-white/70 text-base sm:text-lg mb-12 anim anim-up delay-100">
            국내 대표 식품 기업들로부터
            <br />
            엄선된 식재료만을 사용합니다
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
            {PARTNERS.map((p, i) => (
              <div
                key={p}
                className={`bg-white/10 border border-white/20 rounded-xl px-6 sm:px-8 py-5 sm:py-6 hover:bg-white/15 transition-colors anim anim-scale delay-${(i % 3 + 1) * 100}`}
              >
                <span className="text-white font-bold text-lg sm:text-xl tracking-wide">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-20 -mb-1">
          <WaveBottom fill="#ffffff" />
        </div>
      </section>

      {/* ── SECTION 7: ALLERGY CARE ─────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="anim anim-left">
              <div className="relative inline-flex items-center justify-center">
                <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-[#E8F5E9] flex items-center justify-center">
                  <span className="text-8xl sm:text-9xl">🌿</span>
                </div>
                <div className="absolute -bottom-2 -right-2 sm:bottom-2 sm:-right-4 bg-white rounded-2xl shadow-xl shadow-[#2D6A4F]/15 px-5 py-4 border border-[#E8F5E9]">
                  <div className="text-[#2D6A4F] font-serif font-bold text-3xl sm:text-4xl">1:1</div>
                  <div className="text-xs text-gray-500 mt-0.5">맞춤 케어</div>
                </div>
              </div>
            </div>

            <div className="anim anim-right delay-100">
              <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-3">
                ALLERGY CARE
              </p>
              <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1C2B1E] leading-snug mb-6">
                알레르기 전담 영양사가
                <br />
                아이 한 명 한 명을
                <br />
                케어합니다
              </h2>
              <p className="text-gray-600 text-base leading-relaxed mb-8">
                키즈밀은 알레르기 전담 영양사를 별도로 배치하고 있습니다. 각 원의 알레르기 학생 정보를 바탕으로 1:1 맞춤
                식단을 관리하며, 소중한 아이들의 안전을 최우선으로 생각합니다.
              </p>
              <ul className="space-y-3">
                {[
                  '알레르기 전담 영양사 배치',
                  '1:1 맞춤 식단 관리',
                  '원별 알레르기 데이터 관리',
                ].map((p) => (
                  <li key={p} className="flex items-center gap-3 text-[#1C2B1E]">
                    <span className="text-xl">💚</span>
                    <span className="text-sm sm:text-base">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: 18 TRUCKS ────────────────────────── */}
      <section className="bg-[#F6FAF6] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#2D6A4F] text-sm font-semibold tracking-widest uppercase mb-4 anim anim-up">
            DELIVERY
          </p>
          <div className="font-serif font-bold leading-none anim anim-scale" style={{ fontSize: 'clamp(7rem, 18vw, 12rem)' }}>
            <span className="text-[#2D6A4F]">18</span>
          </div>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C2B1E] mt-2 mb-6 anim anim-up delay-100">
            대의 냉동탑차가
            <br />
            신선함을 끝까지 지킵니다
          </h2>
          <p className="text-gray-600 text-base leading-relaxed max-w-2xl mx-auto mb-10 anim anim-up delay-200">
            키즈밀의 전 차량은 냉동탑차입니다. 새벽에 만들어진 신선함이 아이들의 밥상에 도달할 때까지 온도가 유지됩니다.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: '🚚', text: '전 차량 냉동탑차' },
              { icon: '🌡️', text: '배송 중 온도 실시간 관리' },
              { icon: '⏰', text: '당일 생산 당일 배송' },
            ].map((c, i) => (
              <div
                key={c.text}
                className={`bg-white border border-[#E8F5E9] rounded-2xl p-6 anim anim-up delay-${(i + 1) * 100}`}
              >
                <div className="text-3xl mb-2">{c.icon}</div>
                <p className="text-sm font-medium text-[#1C2B1E]">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 9: FAQ ──────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1C2B1E] text-center mb-12 anim anim-up">
            학부모님들이 자주 물어보세요
          </h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={f.q}
                  className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                    open ? 'border-[#2D6A4F] bg-[#E8F5E9]' : 'border-gray-100 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full px-5 py-5 flex items-center justify-between text-left"
                    aria-expanded={open}
                  >
                    <span className="font-semibold text-[#1C2B1E] pr-4">
                      Q{i + 1}. {f.q}
                    </span>
                    <span
                      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold transition-transform duration-300 ${
                        open ? 'bg-[#2D6A4F] text-white' : 'bg-[#E8F5E9] text-[#2D6A4F]'
                      }`}
                    >
                      {open ? '−' : '+'}
                    </span>
                  </button>
                  <div
                    className="grid transition-all duration-300 ease-out"
                    style={{
                      gridTemplateRows: open ? '1fr' : '0fr',
                    }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm sm:text-base text-[#1C2B1E]/80 leading-relaxed border-t border-[#2D6A4F]/15 pt-4">
                        {f.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 10: PHOTO GALLERY ───────────────────── */}
      <section className="bg-[#F6FAF6] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-[#1C2B1E] mb-3 anim anim-up">
              시설 전체 둘러보기
            </h2>
            <p className="text-gray-600 anim anim-up delay-100">
              2025년 1월 새롭게 오픈한
              <br className="sm:hidden" /> 키즈밀의 시설을 공개합니다
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {TABS.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#2D6A4F] text-white shadow-md'
                      : 'bg-white border border-gray-200 text-[#6B7B6E] hover:border-[#52B788] hover:text-[#2D6A4F]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {photos.map((g, i) => (
              <button
                key={`${g.src}-${i}`}
                type="button"
                onClick={() => openLightbox(i)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-xl transition-shadow cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.src}
                  alt={g.category}
                  loading="lazy"
                  className="block w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-[#1B4332]/0 group-hover:bg-[#1B4332]/20 transition-colors" />
                <span className="absolute top-3 left-3 bg-white/90 text-[#2D6A4F] text-xs font-medium px-2.5 py-1 rounded-full">
                  {g.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 11: CTA ─────────────────────────────── */}
      <section className="bg-[#1B4332] py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-white mb-5 anim anim-up">
            시설이 궁금하신가요?
          </h2>
          <p className="text-white/70 text-base sm:text-lg leading-relaxed mb-10 anim anim-up delay-100">
            직접 찾아오실 필요 없습니다.
            <br />
            궁금한 것은 온라인으로 편하게 물어보세요.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-[#F4A261] hover:bg-[#e8935a] text-white font-semibold px-10 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            온라인으로 문의하기
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── LIGHTBOX ────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* Image — direct flex child, no wrapper. Forced min size + explicit visibility */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIndex]?.src || ''}
            alt={photos[lightboxIndex]?.category || ''}
            width={800}
            height={600}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'block',
              width: 'auto',
              height: 'auto',
              maxWidth: '88vw',
              maxHeight: '82vh',
              minWidth: '300px',
              minHeight: '200px',
              objectFit: 'contain',
              borderRadius: '12px',
              opacity: 1,
              visibility: 'visible',
              position: 'relative',
              zIndex: 1,
              filter: 'none',
              border: '4px solid red',
              background: 'blue',
            }}
            onError={(e) => {
              console.error('라이트박스 이미지 로드 실패:', photos[lightboxIndex]);
              e.currentTarget.style.border = '2px solid red';
            }}
            onLoad={() => console.log('라이트박스 이미지 로드 성공!', photos[lightboxIndex]?.src)}
          />

          {/* Close */}
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl z-10 bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-3xl bg-black/50 rounded-full w-12 h-12 flex items-center justify-center z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
              }}
              aria-label="이전"
            >
              ‹
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-3xl bg-black/50 rounded-full w-12 h-12 flex items-center justify-center z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
              }}
              aria-label="다음"
            >
              ›
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </main>
  );
}
