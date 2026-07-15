<script setup lang="ts">
defineProps<{ compact?: boolean }>()
</script>

<template>
  <NuxtLink class="app-logo" to="/" aria-label="回到一食之選首頁">
    <span class="app-logo__mark" aria-hidden="true">
      <Icon name="solar:chef-hat-heart-linear" />
    </span>
    <span v-if="!compact" class="app-logo__copy">
      <strong>一食之選</strong>
      <small>EIP 智慧飲食助手</small>
    </span>
  </NuxtLink>
</template>
