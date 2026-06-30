/**
 * CostDialog — LLM 分析成本确认 (ui-spec §3.6, roadmap 2.8)
 */
interface Props {
  t: (key: string) => string
  onCancel: () => void
  onContinue: () => void
  onSkipLLM: () => void
}

export default function CostDialog({ onCancel, onContinue, onSkipLLM }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white rounded-xl shadow-2xl z-50 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">即将进行 LLM 分析</h3>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800">
            LLM 分析将为代码节点生成中文摘要、架构分层和引导 Tour。
          </p>
          <p className="text-xs text-yellow-600 mt-2">
            ⚡ 这将消耗 API tokens，请在设置中确认已配置有效的 API Key。
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={onContinue}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            🤖 完整索引（含 LLM 分析）
          </button>
          <button
            onClick={onSkipLLM}
            className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            📊 仅静态索引（跳过摘要与 Tour）
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            取消
          </button>
        </div>
      </div>
    </>
  )
}
