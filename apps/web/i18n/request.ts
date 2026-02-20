import { webEnv } from '@habidat/env/web'
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => {
  const locale = 'de'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: webEnv.TZ,
  }
})
