<script setup lang="ts">
const route = useRoute()
const showRightInsight = computed(() => route.path === '/')
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
    <RightInsight v-if="showRightInsight" />
    <QuickRecordDialog />
    <AppToast />
  </div>
</template>
