import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ALLERGEN_NAMES = [
  '', '난류(달걀)', '우유', '메밀', '땅콩', '대두(콩)', '밀', '고등어', '게', '새우', '돼지고기',
  '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣',
]
const CIRCLED = (n: number) => String.fromCharCode(0x245f + n)

const SLOT_LABEL: Record<string, string> = {
  morning: '오전간식', afternoon: '오후간식', afterschool: '방과후간식',
  care: '돌봄간식', teacher_extra: '교.추',
}

const SLOT_SECTION_MAP: Record<string, string> = {
  morning: '오전', afternoon: '오후', afterschool: '방과후',
  care: '돌봄', teacher_extra: '교.추',
}

interface MenuItem { name: string; allergens: number[] }
interface SectionRow { section: string; items: (MenuItem | null)[] }
interface WeekData { weekNumber: number; dates: string[]; sections: SectionRow[] }
interface ParsedDiet { title: string; weeks: WeekData[] }
interface CustomSlot { key: string; label: string }
interface AllergyChild { name: string; allergens: number[] }
interface ProfileData {
  branch_type: string; snack_slots: string[]; custom_slots: CustomSlot[]
  special_notes: string; allergy_children: AllergyChild[]
}

function buildDietHtml(
  branchName: string,
  yearMonth: string,
  parsed: ParsedDiet,
  profile: ProfileData,
): string {
  const [year, month] = yearMonth.split('-')
  const slots = (profile.snack_slots || ['morning', 'afternoon'])
  const customSlots: CustomSlot[] = profile.custom_slots || []

  function getSlotLabel(key: string): string {
    if (SLOT_LABEL[key]) return SLOT_LABEL[key]
    return customSlots.find(s => s.key === key)?.label || key
  }
  function getSlotSection(key: string): string {
    if (SLOT_SECTION_MAP[key]) return SLOT_SECTION_MAP[key]
    return customSlots.find(s => s.key === key)?.label || key
  }

  const weeks = parsed.weeks || []

  const tableRows = (week: WeekData) => slots.map(slot => {
    const sectionName = getSlotSection(slot)
    const secRow = week.sections.find(s => s.section === sectionName || s.section.startsWith(sectionName))
    const items = secRow?.items || Array(5).fill(null)
    return `
      <tr>
        <td class="section-label">${getSlotLabel(slot)}</td>
        ${items.map(item => `
          <td class="menu-cell">
            ${item ? `<span class="menu-name">${item.name.replace(/\n/g, '<br/>')}</span>${item.allergens.length ? `<span class="allergen">${item.allergens.map((n: number) => CIRCLED(n)).join('')}</span>` : ''}` : '—'}
          </td>`).join('')}
      </tr>`
  }).join('')

  const weekTables = weeks.map(w => `
    <div class="week-block">
      <div class="week-title">${w.weekNumber}주</div>
      <table class="diet-table">
        <thead>
          <tr>
            <th class="th-section">구분</th>
            ${['월','화','수','목','금'].map((d, i) => `<th class="th-day">${d}<br/><small>${w.dates[i] || ''}</small></th>`).join('')}
          </tr>
        </thead>
        <tbody>${tableRows(w)}</tbody>
      </table>
    </div>`).join('')

  const allergyRow = ALLERGEN_NAMES.slice(1).map((name, i) =>
    `<span>${CIRCLED(i+1)}${name}</span>`
  ).join(' ')

  const allergyWarning = (profile.allergy_children || []).length > 0
    ? `<div class="allergy-warning">⚠️ 알레르기 주의 아동: ${profile.allergy_children.map(c => `${c.name}(${c.allergens.map(n => CIRCLED(n)).join('')})`).join(', ')}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
  @page { size: A4 landscape; margin: 12mm 10mm; }
  .page { padding: 0; }
  .header { text-align: center; margin-bottom: 6mm; }
  .header h1 { font-size: 16pt; font-weight: 700; color: #1B4332; letter-spacing: -0.5px; }
  .header h2 { font-size: 12pt; font-weight: 500; color: #2D6A4F; margin-top: 2px; }
  .header .subtitle { font-size: 8pt; color: #666; margin-top: 2px; }
  .week-block { margin-bottom: 4mm; }
  .week-title { font-weight: 700; font-size: 9pt; color: #2D6A4F; padding: 2px 0 2px 2px; border-left: 3px solid #2D6A4F; margin-bottom: 1.5mm; }
  .diet-table { width: 100%; border-collapse: collapse; }
  .diet-table th, .diet-table td { border: 1px solid #ccc; padding: 2.5px 4px; text-align: center; vertical-align: top; }
  .th-section { width: 60px; background: #E8F5E9; font-weight: 700; font-size: 8pt; color: #1B4332; }
  .th-day { background: #F8FDF8; font-weight: 700; font-size: 8pt; width: calc((100% - 60px) / 5); }
  .th-day small { font-size: 7pt; color: #888; font-weight: 400; }
  .section-label { background: #F8FDF8; font-weight: 600; font-size: 8pt; color: #2D6A4F; white-space: nowrap; }
  .menu-cell { font-size: 7.5pt; line-height: 1.4; }
  .menu-name { display: block; }
  .allergen { color: #dc2626; font-weight: 700; font-size: 7pt; }
  .footer { margin-top: 4mm; font-size: 7pt; color: #555; border-top: 1px solid #ccc; padding-top: 3mm; }
  .origin { margin-bottom: 2mm; }
  .allergen-guide { line-height: 1.8; }
  .allergen-guide span { margin-right: 4px; }
  .allergy-warning { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 4px; padding: 3px 8px; font-size: 8pt; color: #dc2626; font-weight: 600; margin-bottom: 3mm; }
  .notes { font-size: 7.5pt; color: #444; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 4px; padding: 3px 8px; margin-bottom: 3mm; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>키즈밀 튼튼 식단 ${year}년 ${month}월</h1>
    <h2>${branchName}</h2>
    ${parsed.title ? `<p class="subtitle">${parsed.title}</p>` : ''}
  </div>
  ${allergyWarning}
  ${profile.special_notes ? `<div class="notes">📌 ${profile.special_notes}</div>` : ''}
  ${weekTables}
  <div class="footer">
    <div class="origin">
      ※ 원산지 표기: 쌀(국내산), 김치(국내산 배추), 돼지고기(국내산), 쇠고기(국내산 한우), 닭고기(국내산), 계란(국내산), 오징어(국내산), 고등어(국내산)
    </div>
    <div class="allergen-guide">
      ※ 알레르기 표시 안내: ${allergyRow}
    </div>
  </div>
</div>
</body>
</html>`
}

function createSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { branch_id, upload_id } = await req.json()
    if (!branch_id || !upload_id) {
      return NextResponse.json({ error: 'branch_id, upload_id required' }, { status: 400 })
    }

    const supabase = createSupabaseServer()

    // Fetch branch
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, profile_data')
      .eq('id', branch_id)
      .single()
    if (!branch) return NextResponse.json({ error: 'branch not found' }, { status: 404 })

    // Fetch upload
    const { data: upload } = await supabase
      .from('diet_uploads')
      .select('parsed_data, year_month, diet_type')
      .eq('id', upload_id)
      .single()
    if (!upload) return NextResponse.json({ error: 'upload not found' }, { status: 404 })

    const profile = (branch.profile_data as ProfileData) || { snack_slots: ['morning','afternoon'], custom_slots: [], special_notes: '', allergy_children: [] }
    const parsed  = upload.parsed_data as ParsedDiet

    // Build HTML
    const html = buildDietHtml(branch.name, upload.year_month, parsed, profile)

    // Generate PDF with puppeteer
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    })
    await browser.close()

    // Upload to Supabase Storage
    const storagePath = `diet-pdfs/${upload.year_month}/${branch_id}.pdf`
    const { error: storeErr } = await supabase.storage
      .from('diet-pdfs')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (storeErr) {
      return NextResponse.json({ error: 'storage upload failed: ' + storeErr.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('diet-pdfs').getPublicUrl(storagePath)
    const fileUrl = urlData?.publicUrl || ''

    // Upsert diet_pdfs record
    const { data: pdfRecord } = await supabase
      .from('diet_pdfs')
      .upsert({
        upload_id,
        branch_id,
        branch_name: branch.name,
        year_month: upload.year_month,
        storage_path: storagePath,
        file_url: fileUrl,
        status: 'generated',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'upload_id,branch_id' })
      .select()
      .single()

    return NextResponse.json({ success: true, pdf_id: pdfRecord?.id, file_url: fileUrl })
  } catch (err) {
    console.error('PDF generate error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error' }, { status: 500 })
  }
}
