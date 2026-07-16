/**
 * Shared resize-drag helpers — prevent text selection and iframe event capture.
 */
export function beginResizeDrag(opts: {
  cursor: string
  onMove: (e: MouseEvent) => void
  onEnd?: () => void
}): void {
  const { cursor, onMove, onEnd } = opts
  document.body.classList.add('fg-is-resizing')
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'

  const handleMove = (e: MouseEvent) => {
    e.preventDefault()
    onMove(e)
  }

  const handleUp = () => {
    document.body.classList.remove('fg-is-resizing')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleUp)
    window.removeEventListener('blur', handleUp)
    onEnd?.()
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleUp)
  window.addEventListener('blur', handleUp)
}
