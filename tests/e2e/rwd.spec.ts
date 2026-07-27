import { expect, test } from '@playwright/test'

const routes = ['/', '/record', '/recommend', '/trend', '/profile']
const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'wide', width: 1920, height: 1080 }
]

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${viewport.name} ${route} renders without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(route)
      await expect(page.locator('body')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
      expect((await page.screenshot()).byteLength).toBeGreaterThan(1000)
      if (viewport.width >= 1024) {
        await expect(page.locator('.desktop-sidebar')).toBeVisible()
        await expect(page.locator('.bottom-nav')).toBeHidden()
      } else {
        await expect(page.locator('.bottom-nav')).toBeVisible()
      }
    })
  }
}

test('quick-record sheet traps focus and Escape closes it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: '新增餐食紀錄' })
  await expect.poll(async () => {
    await page.locator('.bottom-nav__add').click()
    return dialog.isVisible()
  }, { timeout: 20_000 }).toBe(true)
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('photo drop zone accepts a desktop drag-and-drop file', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/record')
  const fileInput = page.locator('input[type=file]').first()
  const fileName = page.getByRole('heading', { name: 'meal.png' })
  await expect.poll(async () => {
    await fileInput.setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: Buffer.from('fake-png') })
    return fileName.isVisible()
  }, { timeout: 20_000 }).toBe(true)
})

test('recognized meals can be multi-selected with an explicit meal period and time', async ({ page }) => {
  let savedBody: { meals?: Array<Record<string, unknown>> } | undefined
  await page.route('**/api/csrf-token', route => route.fulfill({ json: { token: 'test-token' } }))
  await page.route('**/api/meals/analyze', route => route.fulfill({
    status: 202,
    json: { statusUrl: '/api/jobs/00000000-0000-0000-0000-000000000001' }
  }))
  await page.route('**/api/jobs/00000000-0000-0000-0000-000000000001', route => route.fulfill({
    json: {
      state: 'completed',
      output: {
        summary: '辨識到兩個餐點',
        candidates: [
          {
            name: '雞胸肉',
            portionDescription: '一份',
            estimatedGrams: 120,
            confidence: 0.96,
            nutrients: { caloriesKcal: 180, proteinG: 30, fatG: 4, carbsG: 2, fiberG: 0, sodiumMg: 320 }
          },
          {
            name: '無糖豆漿',
            portionDescription: '一杯',
            estimatedGrams: 250,
            confidence: 0.91,
            nutrients: { caloriesKcal: 110, proteinG: 9, fatG: 5, carbsG: 7, fiberG: 1, sodiumMg: 80 }
          }
        ]
      }
    }
  }))
  await page.route('**/api/meals/batch', async (route) => {
    savedBody = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { meals: [], createdCount: 1, duplicateCount: 0 } })
  })

  await page.goto('/record')
  const textTab = page.getByRole('tab', { name: '文字' })
  await expect.poll(async () => {
    await textTab.click()
    return textTab.getAttribute('aria-selected')
  }, { timeout: 20_000 }).toBe('true')
  await page.getByLabel('時段').selectOption('lunch')
  await page.getByLabel('實際用餐時間').fill('2026-07-27T12:00')
  await page.getByLabel('餐點內容').fill('雞胸肉和無糖豆漿')
  await page.getByRole('button', { name: '分析餐食內容' }).click()

  await expect(page.getByText('已選 2／2 項，合計熱量')).toBeVisible()
  await page.getByRole('checkbox', { name: '選擇 無糖豆漿' }).uncheck()
  await page.getByRole('button', { name: '儲存已選的 1 個餐點' }).click()

  await expect.poll(() => savedBody).toBeTruthy()
  expect(savedBody?.meals).toHaveLength(1)
  expect(savedBody?.meals?.[0]).toMatchObject({
    mealDate: '2026-07-27',
    mealTime: '12:00',
    mealType: 'lunch',
    name: '雞胸肉'
  })
})

test('today meal can be edited and deleted from the home page', async ({ page }) => {
  const mealId = '00000000-0000-4000-8000-000000000010'
  let updateBody: Record<string, unknown> | undefined
  let deleteRequested = false
  const summary = {
    today: { date: '2026-07-27', caloriesKcal: 180, proteinG: 30, fatG: 4, carbsG: 2, fiberG: 0, sodiumMg: 320, mealCount: 1 },
    daily: [{ date: '2026-07-27', caloriesKcal: 180, proteinG: 30, fatG: 4, carbsG: 2, fiberG: 0, sodiumMg: 320, mealCount: 1 }],
    targets: null,
    totalMealCount: 1,
    todayMeals: [{
      id: mealId,
      mealDate: '2026-07-27',
      mealTime: '12:00:00',
      mealType: 'lunch',
      source: 'manual',
      name: '雞胸肉',
      caloriesKcal: 180,
      proteinG: 30,
      fatG: 4,
      carbsG: 2,
      fiberG: 0,
      sodiumMg: 320,
      confidence: null,
      summary: '原始備註',
      createdAt: '2026-07-27T10:00:00.000Z'
    }]
  }

  await page.route('**/api/csrf-token', route => route.fulfill({ json: { token: 'test-token' } }))
  await page.route('**/api/meals/summary', route => route.fulfill({ json: summary }))
  await page.route(`**/api/meals/${mealId}/update`, async (route) => {
    updateBody = route.request().postDataJSON()
    const input = updateBody as {
      mealDate: string
      mealTime: string
      mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
      name: string
      nutrients: { caloriesKcal: number }
      summary: string | null
    }
    Object.assign(summary.todayMeals[0], {
      mealDate: input.mealDate,
      mealTime: input.mealTime,
      mealType: input.mealType,
      name: input.name,
      caloriesKcal: input.nutrients.caloriesKcal,
      summary: input.summary
    })
    summary.today.caloriesKcal = input.nutrients.caloriesKcal
    await route.fulfill({ json: { id: mealId } })
  })
  await page.route(`**/api/meals/${mealId}/delete`, async (route) => {
    deleteRequested = true
    summary.todayMeals.splice(0)
    Object.assign(summary.today, { caloriesKcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, sodiumMg: 0, mealCount: 0 })
    summary.totalMealCount = 0
    await route.fulfill({ json: { id: mealId, deleted: true } })
  })

  await page.goto('/')
  await page.evaluate((value) => {
    const payload = (window as Window & {
      __NUXT__?: { data: Record<string, unknown> }
    }).__NUXT__
    if (!payload) throw new Error('Nuxt payload is unavailable')
    payload.data['meal-summary'] = value
  }, summary)
  await page.getByRole('button', { name: '修改 雞胸肉' }).click()
  const editor = page.getByRole('dialog', { name: '修改餐食' })
  await expect(editor).toBeVisible()
  await editor.getByLabel('餐點名稱').fill('香煎雞胸')
  await editor.getByLabel('時段').selectOption('dinner')
  await editor.getByLabel('實際用餐時間').fill('18:30')
  await editor.getByLabel('熱量').fill('220')
  await editor.getByRole('button', { name: '儲存修改' }).click()

  await expect.poll(() => updateBody).toBeTruthy()
  expect(updateBody).toMatchObject({
    mealDate: '2026-07-27',
    mealTime: '18:30',
    mealType: 'dinner',
    name: '香煎雞胸',
    nutrients: { caloriesKcal: 220 }
  })
  await expect(page.locator('.meal-timeline').getByText('香煎雞胸', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '刪除 香煎雞胸' }).click()
  const deleteDialog = page.getByRole('alertdialog', { name: '刪除餐食紀錄？' })
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.getByRole('button', { name: '確認刪除' }).click()

  await expect.poll(() => deleteRequested).toBe(true)
  await expect(page.locator('.meal-timeline').getByText('香煎雞胸', { exact: true })).toBeHidden()
  await expect(page.getByText('晚餐尚未記錄')).toBeVisible()
})
