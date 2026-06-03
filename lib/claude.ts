import Anthropic from '@anthropic-ai/sdk'
import { CATEGORY_LABELS, type InquiryCategory } from './types'

const SYSTEM_PROMPT = `당신은 키즈밀 고객 지원 담당자입니다. 키즈밀은 22년 경력의 친환경 아동 급식 전문 기업입니다.
고객(가맹점)의 문의에 따뜻하고 전문적인 톤으로 답변해주세요.
- 반말 금지, 존댓말 필수
- 이모지 1개 이하 사용
- 간결하고 명확하게 답변
- 해결 방향과 다음 단계를 명시
- 키즈밀 브랜드 가치(친환경, 영양, 안전)를 반영`

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return client
}

export async function generateReplyDraft(
  category: InquiryCategory,
  inquiryContent: string,
  branchName?: string
): Promise<string> {
  const categoryLabel = CATEGORY_LABELS[category] || category

  const userPrompt = `다음 가맹점 문의에 대한 답변 초안을 작성해주세요.

가맹점명: ${branchName || '가맹점'}
문의 분류: ${categoryLabel}
문의 내용:
${inquiryContent}

답변 초안을 작성해주세요. 관리자가 검토 후 수정하여 발송합니다.`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  return stripMarkdown(raw)
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+.*$/gm, '')       // # 헤더 제거
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold** → 일반
    .replace(/\*(.+?)\*/g, '$1')           // *italic* → 일반
    .replace(/`(.+?)`/g, '$1')             // `code` → 일반
    .replace(/\n{3,}/g, '\n\n')            // 연속 빈줄 정리
    .trim()
}
