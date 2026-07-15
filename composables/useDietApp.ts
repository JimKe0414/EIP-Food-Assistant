import type { Profile, RecordMode } from '~/types/diet'

const goalCopy: Record<string, string> = {
  均衡飲食: '依據過去 7 天用餐內容，優先推薦較少吃到或尚未點過的餐點。',
  對自己好點: '以好吃與個人口味為優先，同時避免連續兩天重複。',
  健康樂活: '依近期營養比例，優先推薦低油、低鹽且均衡的餐點。'
}

export function useDietApp() {
  const quickRecordOpen = useState('quick-record-open', () => false)
  const recordMode = useState<RecordMode>('record-mode', () => 'photo')
  const toast = useState('toast', () => '')
  const goal = useState('goal', () => '均衡飲食')
  const profile = useState<Profile>('profile', () => ({
    age: 35,
    sex: 'male',
    height: 173,
    weight: 68.2,
    bodyFat: 21.5,
    muscle: 29.8,
    activity: 1.2
  }))

  const goalDescription = computed(() => goalCopy[goal.value] ?? goalCopy.均衡飲食)

  function openQuickRecord() {
    quickRecordOpen.value = true
  }

  function closeQuickRecord() {
    quickRecordOpen.value = false
  }

  async function chooseRecordMode(mode: RecordMode) {
    recordMode.value = mode
    closeQuickRecord()
    await navigateTo('/record')
  }

  let toastTimer: number | undefined
  function notify(message: string) {
    toast.value = message
    if (import.meta.client) {
      if (toastTimer !== undefined) window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => { toast.value = '' }, 2600)
    }
  }

  return {
    quickRecordOpen,
    recordMode,
    toast,
    goal,
    goalDescription,
    profile,
    openQuickRecord,
    closeQuickRecord,
    chooseRecordMode,
    notify
  }
}
