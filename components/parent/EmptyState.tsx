interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export default function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="font-bold text-[#1C2B1E] text-base mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="mt-4 text-sm text-[#2D6A4F] font-medium hover:underline">
            {action.label}
          </a>
        ) : (
          <button onClick={action.onClick} className="mt-4 text-sm text-[#2D6A4F] font-medium hover:underline">
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
