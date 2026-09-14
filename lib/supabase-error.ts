/**
 * Supabase(Postgres) 에러를 사용자에게 보여줄 한글 메시지로 변환.
 * ★ 원본 에러 메시지를 화면에 그대로 띄우지 않는다 — RLS 위반 시 Postgres가
 *   `new row violates row-level security policy for table "messages"`처럼
 *   테이블명을 그대로 뱉어낸다. 이걸 그대로 노출하면 내부 스키마·정책
 *   존재 여부가 드러난다. code로만 분기하고 그 외는 뭉뚱그린 문구로 대체한다.
 */
export function toKoreanErrorMessage(
  error: unknown,
  fallback = '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: string }).code
      : undefined

  if (code === '42501') return '이 작업을 수행할 권한이 없습니다. 담당자에게 문의해주세요.'

  return fallback
}
