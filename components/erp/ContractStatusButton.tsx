'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Props {
  branchId: string
  branchName: string
  currentStatus: 'active' | 'inactive'
  isSuperAdmin: boolean
}

function LocalToast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  )
}

export default function ContractStatusButton({
  branchId,
  branchName,
  currentStatus,
  isSuperAdmin,
}: Props) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // body 스크롤 잠금
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isModalOpen])

  // ESC 키 닫기
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!isSuperAdmin) return null

  async function handleConfirm() {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/branch-profiles/${branchId}`, { method: 'DELETE' })
      if (!res.ok) {
        setToast({ msg: '처리 실패. 다시 시도해주세요.', type: 'error' })
        setTimeout(() => setToast(null), 3000)
        setIsModalOpen(false)
        return
      }
      const wasActive = currentStatus === 'active'
      setToast({
        msg: wasActive ? '계약 종료 처리됐습니다' : '계약이 재활성화됐습니다',
        type: 'success',
      })
      setIsModalOpen(false)
      router.refresh()
      router.push('/erp/branches')
    } catch {
      setToast({ msg: '처리 실패. 다시 시도해주세요.', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      setIsModalOpen(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const isActive = currentStatus === 'active'

  return (
    <>
      {toast && <LocalToast msg={toast.msg} type={toast.type} />}

      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`border text-sm rounded-lg px-4 py-2 bg-white transition-colors ${
          isActive
            ? 'border-red-200 text-red-500 hover:bg-red-50'
            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
        }`}
      >
        {isActive ? '계약 종료' : '계약 재활성화'}
      </button>

      {/* 확인 모달 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-800">
              {isActive ? '계약 종료 처리' : '계약 재활성화'}
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {isActive
                ? `${branchName}을(를) 계약 종료합니다.\n식단 배포 이력은 보존됩니다.`
                : `${branchName}을(를) 재활성화합니다.\n재활성화 후 계약 날짜를 업데이트해주세요.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-70 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    처리 중...
                  </>
                ) : (
                  isActive ? '종료 확인' : '재활성화 확인'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
