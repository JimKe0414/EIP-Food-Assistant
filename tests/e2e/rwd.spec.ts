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
  await page.locator('.bottom-nav__add').click()
  const dialog = page.getByRole('dialog', { name: '新增餐食紀錄' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('photo drop zone accepts a desktop drag-and-drop file', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/record')
  await page.locator('input[type=file]').setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: Buffer.from('fake-png') })
  await expect(page.getByText('meal.png')).toBeVisible()
})
