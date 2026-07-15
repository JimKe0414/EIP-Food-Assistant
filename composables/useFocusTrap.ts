export function useFocusTrap(open: Ref<boolean> | (() => boolean), panel: Ref<HTMLElement | null>, close: () => void) {
  const isOpen = () => typeof open === 'function' ? open() : open.value
  let previousFocus: HTMLElement | null = null

  function onKeydown(event: KeyboardEvent) {
    if (!isOpen()) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab' || !panel.value) return
    const nodes = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    if (!nodes.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  watch(isOpen, async value => {
    if (!import.meta.client) return
    document.body.classList.toggle('no-scroll', value)
    if (value) {
      previousFocus = document.activeElement as HTMLElement | null
      await nextTick()
      panel.value?.querySelector<HTMLElement>('button, input, select, textarea, a[href]')?.focus()
    } else previousFocus?.focus()
  })

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    document.body.classList.remove('no-scroll')
  })
}
