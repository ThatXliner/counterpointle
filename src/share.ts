/**
 * Share a result: the system share sheet on phones, the clipboard elsewhere.
 * Returns a message for the toast, or null when the share sheet handled it.
 */
export async function shareText(text: string): Promise<string | null> {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text })
      return null
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'Copied to clipboard'
  } catch {
    return 'Could not copy. Your browser blocked the clipboard'
  }
}
