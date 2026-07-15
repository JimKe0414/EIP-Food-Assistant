<template>
  <div class="meal-timeline">
    <article>
      <time>08:12</time>
      <div><b>無糖豆漿＋鮪魚蛋吐司</b><span>拍照辨識・可信度 94%</span></div>
      <strong>518</strong>
    </article>
    <NuxtLink to="/record?meal=lunch">
      <span class="meal-timeline__empty">＋</span>
      <div><b>午餐尚未記錄</b><span>可從 EIP 點餐資料自動帶入</span></div>
      <strong>—</strong>
    </NuxtLink>
    <NuxtLink to="/record?meal=dinner">
      <span class="meal-timeline__empty">＋</span>
      <div><b>晚餐尚未記錄</b><span>支援拍照、語音與文字輸入</span></div>
      <strong>—</strong>
    </NuxtLink>
  </div>
</template>
