/**
 * 공휴일 수집 — data.go.kr 한국천문연구원 특일 정보 API
 * ========================================================================
 *
 * 왜 Next.js가 이 API를 부르는가:
 *   diff 감지의 목적은 "사람에게 확인받는 것"인데, GitHub Actions는
 *   백그라운드라 팝업을 띄울 수 없다. 그래서 API 호출·diff는 여기(ERP)가
 *   맡고, gen_form.py는 사람 확인을 거친 public_holidays를 읽기만 한다.
 *   덕분에 인증키도 Next.js 한 곳에만 두면 된다.
 *
 * ⚠️ 인증키 이중 인코딩 (2026-08-20 실측 확인)
 *   data.go.kr는 인증키를 Encoding(%2B…) / Decoding(원본 +/=) 두 벌로 준다.
 *   URLSearchParams는 값을 자동으로 한 번 인코딩하므로, Encoding 키를 그대로
 *   넣으면 %2B → %252B로 이중 인코딩되어 아래 에러가 난다:
 *     SERVICE_KEY_IS_NOT_REGISTERED_ERROR / "등록되지 않은 서비스키" (code=30)
 *   이 에러는 키가 **아예 없을 때도 똑같이** 나와서 구분이 안 된다.
 *
 *   → 어느 쪽을 붙여넣어도 되도록 normalizeServiceKey()로 흡수한다.
 *     사람이 포털에서 복사해오는 값이라 형태를 강제하는 대신 코드가 받아낸다.
 */

const KASI_ENDPOINT =
  'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'

/**
 * 한 번에 받아올 최대 건수.
 * ⚠️ API 기본값이 10이라 그대로 두면 연 단위 조회 시 공휴일 20건 안팎 중
 *    절반이 "에러 없이 조용히" 잘린다. 반드시 명시할 것.
 */
const NUM_OF_ROWS = 100

/** 수집된 공휴일 한 건 */
export interface Holiday {
  /** 'YYYY-MM-DD' */
  date: string
  /** API dateName 원문 (예: '제9회 전국동시지방선거') */
  name: string
}

/**
 * 공휴일 자체의 기본 정책 (2단 필터 1단계)
 *   all_closed    = 전 원 휴무 기본 → 2단계에서 원별 예외를 확인한다
 *   all_operating = 전 원 정상운영 → 원별 확인을 생략한다
 * null = 미분류. 코드가 추측하지 않고 사람에게 묻는다.
 */
export type ClosurePolicy = 'all_closed' | 'all_operating'

/** DB(public_holidays)에 저장돼 있는 공휴일 한 건 */
export interface StoredHoliday extends Holiday {
  source: 'kasi_api' | 'manual'
  confirmedAt: string | null
  closurePolicy: ClosurePolicy | null
}

/** API 응답과 DB 저장값의 차이 */
export interface HolidayDiff {
  /** API엔 있는데 DB에 없음 → 새로 지정된 공휴일(임시공휴일 등) */
  added: Holiday[]
  /** DB엔 있는데 API에 없음 → 지정 취소. source='manual'은 제외한다 */
  removed: StoredHoliday[]
  /** 날짜는 같은데 명칭이 바뀜 */
  renamed: Array<{ date: string; from: string; to: string }>
  /**
   * DB에 있으나 closure_policy가 아직 NULL인 것.
   * API와 비교해 달라진 게 없어도 이게 남아 있으면 사람이 분류해야 한다.
   */
  unclassified: StoredHoliday[]
  /** 그대로인 건수 */
  unchangedCount: number
  /** added/removed/renamed 중 하나라도 있으면 true (= API와 달라졌다) */
  hasChanges: boolean
  /**
   * ★팝업을 띄울지 판단하는 값. hasChanges || unclassified 있음.
   *
   * hasChanges만 보면 "API와 같지만 아무도 분류한 적 없는 공휴일"이 조용히
   * 넘어가서, closure_policy가 NULL인 채로 식단 생성까지 흘러간다.
   */
  needsAttention: boolean
}

/** 특일정보 API 호출 실패 */
export class HolidayApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HolidayApiError'
  }
}

/**
 * 인증키를 원본(Decoding) 형태로 정규화한다.
 *
 * 포털이 주는 두 형태를 모두 받아내기 위한 것:
 *   - Encoding 키('...%2Bab%2F') → 디코딩해서 원본으로
 *   - Decoding 키('...+ab/')     → base64 문자셋(A-Za-z0-9+/=)엔 '%'가 없어
 *                                  decodeURIComponent가 그대로 통과시킨다(무해)
 * 이렇게 정규화한 뒤 URLSearchParams가 한 번 인코딩하면 항상 올바른 1회
 * 인코딩이 된다.
 */
function normalizeServiceKey(key: string): string {
  if (!key.includes('%')) return key
  try {
    return decodeURIComponent(key)
  } catch {
    // '%'가 이스케이프 시퀀스가 아닌 형태로 섞인 경우 — 원문 유지
    return key
  }
}

/** locdate(20260603, 숫자로 옴) → '2026-06-03' */
function locdateToIso(locdate: unknown): string | null {
  const s = String(locdate ?? '').trim()
  if (!/^\d{8}$/.test(s)) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/**
 * items.item을 항상 배열로 만든다.
 *
 * data.go.kr의 고질적인 응답 흔들림 두 가지를 여기서 흡수한다:
 *   - 결과가 1건이면 item이 배열이 아니라 **객체 하나**로 온다
 *   - 결과가 0건이면 items 자체가 **빈 문자열("")** 로 온다
 * 이걸 안 막으면 .map()에서 터지거나 조용히 1건을 흘린다.
 */
function toItemArray(items: unknown): Record<string, unknown>[] {
  if (!items || typeof items !== 'object') return []
  const item = (items as Record<string, unknown>).item
  if (!item) return []
  if (Array.isArray(item)) return item as Record<string, unknown>[]
  if (typeof item === 'object') return [item as Record<string, unknown>]
  return []
}

/**
 * 특일정보 API에서 공휴일 목록을 가져온다.
 *
 * @param year  조회 연도
 * @param month 조회 월. 생략하면 그 해 전체를 한 번에 가져온다
 * @returns 날짜 오름차순 정렬된 공휴일 목록 (isHoliday='Y'만)
 */
export async function fetchHolidaysFromKasi(
  year: number,
  month?: number,
): Promise<Holiday[]> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY
  if (!serviceKey) {
    throw new HolidayApiError(
      'DATA_GO_KR_SERVICE_KEY 환경변수가 없습니다. ' +
        '.env.local(로컬) 또는 Vercel 환경변수에 등록해주세요.',
    )
  }

  // 원본 형태로 맞춘 뒤 URLSearchParams가 정확히 한 번 인코딩하게 한다
  const params = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    solYear: String(year),
    numOfRows: String(NUM_OF_ROWS),
    pageNo: '1',
    _type: 'json',
  })
  if (month) params.set('solMonth', String(month).padStart(2, '0'))

  let res: Response
  try {
    // no-store — 공휴일 지정/취소를 놓치면 안 되므로 캐시하지 않는다
    res = await fetch(`${KASI_ENDPOINT}?${params}`, { cache: 'no-store' })
  } catch {
    throw new HolidayApiError('특일정보 API 연결에 실패했습니다.')
  }

  const text = await res.text()

  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    // 인증 실패 등에서 XML로 떨어지는 경우가 있다
    throw new HolidayApiError(
      `특일정보 API가 JSON이 아닌 응답을 반환했습니다: ${text.slice(0, 200)}`,
    )
  }

  // 에러 응답은 성공과 **구조 자체가 다르다**
  //   { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg, returnAuthMsg } } }
  const errHeader = (json.OpenAPI_ServiceResponse as Record<string, unknown>)
    ?.cmmMsgHeader as Record<string, unknown> | undefined
  if (errHeader) {
    const code = String(errHeader.returnReasonCode ?? '')
    const msg = String(errHeader.returnAuthMsg ?? errHeader.errMsg ?? '알 수 없는 오류')
    const hint =
      code === '30'
        ? ' (인증키 미등록 — Decoding 키를 넣었는지, 이중 인코딩은 아닌지 확인하세요)'
        : ''
    throw new HolidayApiError(`특일정보 API 오류: ${msg}${hint}`)
  }

  const response = json.response as Record<string, unknown> | undefined
  const header = response?.header as Record<string, unknown> | undefined
  const resultCode = String(header?.resultCode ?? '')
  if (resultCode && resultCode !== '00') {
    throw new HolidayApiError(
      `특일정보 API 오류(${resultCode}): ${String(header?.resultMsg ?? '')}`,
    )
  }

  const body = response?.body as Record<string, unknown> | undefined

  // 잘림 감지 — numOfRows를 키웠는데도 넘치면 조용히 흘리지 말고 알린다
  const totalCount = Number(body?.totalCount ?? 0)
  if (totalCount > NUM_OF_ROWS) {
    throw new HolidayApiError(
      `공휴일이 ${totalCount}건으로 조회 상한(${NUM_OF_ROWS})을 넘었습니다. ` +
        'NUM_OF_ROWS를 늘리거나 월 단위로 나눠 조회해야 합니다.',
    )
  }

  const holidays: Holiday[] = []
  for (const item of toItemArray(body?.items)) {
    // isHoliday='N'인 항목(기념일 등)이 섞여 올 수 있다
    if (String(item.isHoliday ?? '').trim().toUpperCase() !== 'Y') continue

    const date = locdateToIso(item.locdate)
    if (!date) continue

    holidays.push({
      date,
      name: String(item.dateName ?? '').trim() || '공휴일',
    })
  }

  // 같은 날짜가 중복으로 오는 경우가 있다(seq가 다른 동일 일자) → 첫 건만
  const seen = new Set<string>()
  const deduped = holidays.filter(h => {
    if (seen.has(h.date)) return false
    seen.add(h.date)
    return true
  })

  return deduped.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * API 응답과 DB 저장값을 비교한다.
 *
 * ★ source='manual' 행은 removed로 보고하지 않는다.
 *   수동 입력분은 "API가 아직 안 올린 임시공휴일"을 사람이 넣은 것이므로,
 *   API에 없다는 이유로 지우자고 하면 탈출구의 의미가 없어진다.
 */
export function diffHolidays(
  fromApi: Holiday[],
  fromDb: StoredHoliday[],
): HolidayDiff {
  const apiByDate = new Map(fromApi.map(h => [h.date, h]))
  const dbByDate = new Map(fromDb.map(h => [h.date, h]))

  const added: Holiday[] = []
  const renamed: HolidayDiff['renamed'] = []
  let unchangedCount = 0

  for (const api of fromApi) {
    const db = dbByDate.get(api.date)
    if (!db) {
      added.push(api)
    } else if (db.name !== api.name) {
      renamed.push({ date: api.date, from: db.name, to: api.name })
    } else {
      unchangedCount++
    }
  }

  const removed = fromDb.filter(
    db => db.source !== 'manual' && !apiByDate.has(db.date),
  )

  // 삭제 예정인 것까지 "분류하라"고 물으면 혼란스러우므로 removed는 뺀다
  const removedDates = new Set(removed.map(r => r.date))
  const unclassified = fromDb.filter(
    db => db.closurePolicy === null && !removedDates.has(db.date),
  )

  const hasChanges =
    added.length > 0 || removed.length > 0 || renamed.length > 0

  return {
    added,
    removed,
    renamed,
    unclassified,
    unchangedCount,
    hasChanges,
    needsAttention: hasChanges || unclassified.length > 0,
  }
}

/**
 * 전년도(이전) 같은 이름의 공휴일에 어떤 정책을 썼는지 찾는다.
 *
 * 팝업의 "작년 동일 공휴일엔 이렇게 하셨습니다" 표시와, 새 공휴일의
 * 기본값 프리필에 함께 쓴다. 별도 정책 테이블을 두지 않고 이름으로
 * 거슬러 올라가는 방식(add_holiday_closure_policy_260820.sql 참고).
 *
 * ⚠️ 선거처럼 매년 이름이 달라지는 공휴일은 매칭되지 않는다(의도된 동작).
 *
 * @param history 같은 name을 가진 과거 공휴일들(날짜 내림차순 권장)
 */
export function inheritPolicy(
  history: Array<{ date: string; closurePolicy: ClosurePolicy | null }>,
  before: string,
): { policy: ClosurePolicy; fromDate: string } | null {
  for (const h of history) {
    if (h.date >= before) continue
    if (h.closurePolicy) return { policy: h.closurePolicy, fromDate: h.date }
  }
  return null
}

/** 해당 연월의 첫날/마지막날 ('YYYY-MM-DD'). DB 날짜 범위 조회용 */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0')
  // month는 1-based, Date의 month는 0-based → new Date(y, m, 0) = 그 달 마지막날
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}
