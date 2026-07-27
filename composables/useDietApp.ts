import type { Profile, RecordMode } from '~/types/diet'
import type { HealthGoal, UserPreferencesInput } from '~/shared/domain/preferences'
import { DEFAULT_USER_PREFERENCES } from '~/shared/domain/preferences'

const goalCopy: Record<string, string> = {
  均衡飲食: '依據過去 7 天用餐內容，優先推薦較少吃到或尚未點過的餐點。',
  對自己好點: '以好吃與個人口味為優先，同時避免連續兩天重複。',
  健康樂活: '依近期營養比例，優先推薦低油、低鹽且均衡的餐點。'
}

export function useDietApp() {
  const quickRecordOpen = useState('quick-record-open', () => false)
  const recordMode = useState<RecordMode>('record-mode', () => 'photo')
  const toast = useState('toast', () => '')
  const goal = useState<HealthGoal>('goal', () => DEFAULT_USER_PREFERENCES.healthGoal)
  const reminderEnabled = useState('reminder-enabled', () => DEFAULT_USER_PREFERENCES.reminderEnabled)
  const profile = useState<Profile | null>('profile', () => null)

  const goalDescription = computed(() => goalCopy[goal.value] ?? goalCopy.均衡飲食)

  function openQuickRecord() {
    quickRecordOpen.value = true
  }

  function closeQuickRecord() {
    quickRecordOpen.value = false
  }

  function applyProfile(value: Profile | null) {
    profile.value = value
  }

  function applyPreferences(value: UserPreferencesInput) {
    goal.value = value.healthGoal
    reminderEnabled.value = value.reminderEnabled
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
    reminderEnabled,
    profile,
    applyProfile,
    applyPreferences,
    openQuickRecord,
    closeQuickRecord,
    chooseRecordMode,
    notify
  }
}
