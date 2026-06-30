interface Props { t: (key: string) => string }

export default function ChatPanel({ t }: Props) {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--fg-bg)]">
      <div className="text-center text-gray-400 max-w-sm">
        <div className="text-3xl mb-3">💬</div>
        <p className="text-sm font-medium mb-1">{t('chat.title')}</p>
        <p className="text-xs">{t('chat.placeholder')}</p>
      </div>
    </div>
  )
}
