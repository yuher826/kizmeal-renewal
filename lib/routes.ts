/**
 * 포털별 로그인/착지(로그인 후 이동) 경로 상수.
 *
 * ★배경: middleware.ts와 board/login 페이지가 "비관리자 로그인 후 어디로 보낼지"를
 * 각자 문자열로 따로 계산하다가 서로 다른 값('/board/customer' vs '/board/dashboard')으로
 * 굳어진 적이 있음. 착지 경로를 다중 분기(admin이면 A, 아니면 B 등)로 계산하는 곳은
 * 반드시 이 상수만 참조해서, 같은 문제가 세 번째 위치에서 또 갈리지 않게 한다.
 *
 * 범위: "여러 갈래로 분기해 계산하는 착지 경로"만 여기 포함한다.
 * `if (!user) redirect('/board/login')` 같은 단일 목적지 가드 리다이렉트는
 * 분기가 아니라 값이 하나뿐이라 드리프트 위험이 없으므로 이번엔 포함하지 않았다
 * (전체 리포지토리에 /board/login 문자열이 30곳 넘게 있어 전수 교체는 별건으로 남김).
 */
export const ROUTES = {
  BOARD_LOGIN: '/board/login',
  BOARD_ADMIN_HOME: '/board/admin',
  BOARD_CUSTOMER_HOME: '/board/dashboard',
  ERP_LOGIN: '/erp/login',
  ERP_DIET: '/erp/diet',
  ERP_INQUIRIES: '/erp/inquiries',
  ERP_REVIEW: '/erp/review',
  ERP_NOTICES: '/erp/notices',
  ERP_DIET_TEMPLATES: '/erp/diet/templates',
  ERP_MY_PAGE: '/erp/my-page',
  NUTRITIONIST_HOME: '/nutritionist/dashboard',
} as const
