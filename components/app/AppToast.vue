<script setup lang="ts">
const { toast } = useDietApp()
</script>

<template>
  <Transition name="toast">
    <div v-if="toast" class="app-toast" role="status">{{ toast }}</div>
  </Transition>
</template>
