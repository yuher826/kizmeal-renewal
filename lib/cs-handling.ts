import type { Inquiry } from './types'

// "다른 사람이 처리 중인 문의인가" — 이어받기 버튼·안내 띠·입력창 경고의 판정을
// 이 함수 한 곳에서만 한다(2026-09-18, C).
// = 담당자가 있고, 내가 아니고, 완료(resolved)가 아님.
//   완료 문의는 누가 잡고 있는 상태가 아니므로 제외한다(고객이 다시 물으면
//   처리중으로 재개되어 다시 true가 된다).
// ★③ 업무협조에서 "협조자는 경고 없이 답변 가능"을 추가할 때도 여기에만 넣는다.
//   화면 곳곳에 조건을 흩뿌리지 말 것.
export function isHandledByOther(
  inquiry: Pick<Inquiry, 'assigned_admin_id' | 'status'> | null | undefined,
  meAdminId: string | null | undefined,
): boolean {
  if (!inquiry?.assigned_admin_id) return false
  if (inquiry.assigned_admin_id === meAdminId) return false
  return inquiry.status !== 'resolved'
}
