import ErpLoginForm from './ErpLoginForm'

export const metadata = { title: '로그인 | 키즈밀 ERP' }

export default function ErpLoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  return <ErpLoginForm next={searchParams.next} />
}
