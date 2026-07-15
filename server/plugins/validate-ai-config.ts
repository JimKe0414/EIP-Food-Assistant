import { aiConfigurationFromEnv, validateAiConfiguration } from '~/server/services/ai'

export default defineNitroPlugin(() => {
  validateAiConfiguration(aiConfigurationFromEnv())
})
