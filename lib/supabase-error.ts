/**
 * Supabase(Postgres) 에러를 사용자에게 보여줄 한글 메시지로 변환.
 * ★ 원본 에러 메시지를 화면에 그대로 띄우지 않는다 — RLS 위반 시 Postgres가
 *   `new row violates row-level security policy for table "messages"`처럼
 *   테이블명을 그대로 뱉어낸다. 이걸 그대로 노출하면 내부 스키마·정책
 *   존재 여부가 드러난다. code로만 분기하고 그 외는 뭉뚱그린 문구로 대체한다.
 */
export function toKoreanErrorMessage(
  error: unknown,
  fallback = '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
  // 42501(RLS 위반) 전용 문구. 호출부가 "왜 막혔는지" 더 구체적으로 아는
  // 경우(예: 메시지 수정·삭제엔 권한 없음 외에 "상대가 이미 읽음" RESTRICTIVE
  // 정책도 있음) 여기로 맞춤 문구를 넘긴다. 에러 코드만으로는 어떤 정책이
  // 막았는지 구분이 안 되므로, 둘 다 사실일 수 있는 문구를 넘길 것.
  forbiddenMessage = '이 작업을 수행할 권한이 없습니다. 담당자에게 문의해주세요.'
): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: string }).code
      : undefined

  if (code === '42501') return forbiddenMessage

  return fallback
}
