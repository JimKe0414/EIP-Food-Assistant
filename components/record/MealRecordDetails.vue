<script setup lang="ts">
import type { MealInput } from '~/shared/domain/meals'

const mealType = defineModel<MealInput['mealType']>('mealType', { required: true })
const eatenAt = defineModel<string>('eatenAt', { required: true })
</script>

<template>
  <fieldset class="meal-record-details">
    <legend>用餐資訊</legend>
    <label>
      時段
      <select v-model="mealType">
        <option value="breakfast">早餐</option>
        <option value="lunch">午餐</option>
        <option value="dinner">晚餐</option>
        <option value="snack">點心</option>
      </select>
    </label>
    <label>
      實際用餐時間
      <input v-model="eatenAt" type="datetime-local" required>
    </label>
    <small>可調整為實際吃飯時間；系統仍會另外保留這筆資料的記錄時間。</small>
  </fieldset>
</template>
