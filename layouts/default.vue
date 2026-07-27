<script setup lang="ts">
import type { Profile } from '~/types/diet'
import type { UserPreferencesInput } from '~/shared/domain/preferences'

const route = useRoute()
const showRightInsight = computed(() => route.path === '/')
const { applyProfile, applyPreferences } = useDietApp()
const { data: profileState } = await useFetch<{
  profile: Profile | null
}>('/api/profile', { key: 'profile-state' })
const { data: preferencesState } = await useFetch<{
  preferences: UserPreferencesInput
}>('/api/preferences', { key: 'preferences-state' })

watchEffect(() => {
  if (profileState.value) applyProfile(profileState.value.profile)
  if (preferencesState.value) applyPreferences(preferencesState.value.preferences)
})
</script>

<template>
  <div class="app-shell" :class="{ 'has-insight': showRightInsight }">
    <PwaStatus />
    <DesktopSidebar />
    <div class="mobile-frame">
      <MobileHeader />
      <main id="main-content" class="main-content">
        <slot />
      </main>
      <BottomNavigation />
    </div>
    <Transition name="insight">
      <RightInsight v-if="showRightInsight" />
    </Transition>
    <QuickRecordDialog />
    <AppToast />
  </div>
</template>
