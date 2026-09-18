import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/lib/supabase'

type BrowserClient = ReturnType<typeof createClient>

export type BranchSessionCheck =
  | { ok: true; user: User }
  | { ok: false; email: string | null }

// 고객사 화면에서 DB에 쓰기 직전, "지금 세션이 이 원의 마스터 또는 활성 멤버인가"를 확인한다
// (2026-09-18, B-3).
// ★왜 필요한가 — 같은 브라우저에서 ERP에 로그인하면 쿠키가 덮어써져, 이미 열어 둔
//   고객사 탭이 화면은 그대로인 채 관리자 세션으로 전송한다. admin은 RLS상 messages
//   INSERT가 열려 있어 통과하고, sender_type='branch'인데 sender_id가 관리자인 행이 남았다.
//   레이아웃의 원 확인은 서버 첫 렌더에서 한 번만 돌아 이미 열린 탭은 못 잡는다.
// 기준은 /api/board/inquiries/[id]/senders 와 같다. 원(branches)의 is_active는 보지 않는다 —
//   비활성 원은 별도 안내(2026-09-17)와 RLS가 처리하고, 여기서 막으면 "계정 불일치"로
//   잘못 안내된다.
export async function verifyBranchSession(
  supabase: BrowserClient,
  branchId: string,
): Promise<BranchSessionCheck> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, email: null }

  const [{ data: asMaster }, { data: asMember }] = await Promise.all([
    supabase.from('branches').select('id')
      .eq('auth_id', user.id).eq('id', branchId).maybeSingle(),
    supabase.from('branch_members').select('id')
      .eq('auth_id', user.id).eq('branch_id', branchId).eq('is_active', true).maybeSingle(),
  ])
  if (!asMaster && !asMember) return { ok: false, email: user.email ?? null }
  return { ok: true, user }
}

// 불일치 안내 문구 — 답장·새 문의 화면이 같은 문구를 쓴다
export const BRANCH_SESSION_MISMATCH_TITLE = '로그인 계정을 확인해 주세요'
export const BRANCH_SESSION_MISMATCH_MESSAGE =
  '지금 로그인된 계정이 이 원의 계정이 아닙니다. 로그아웃 후 원 계정으로 다시 로그인해 주세요. (작성하신 내용은 전송되지 않았습니다)'
