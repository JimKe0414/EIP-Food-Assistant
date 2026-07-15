export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, context) => {
    const nonce = context.event.context.cspNonce
    if (!nonce) return

    const addNonce = (fragment: string) => fragment
      .replace(/<(script|style)(?=[\s>])(?![^>]*\bnonce=)/g, `<$1 nonce="${nonce}"`)

    html.head = html.head.map(addNonce)
    html.body = html.body.map(addNonce)
    html.bodyAppend = html.bodyAppend.map(addNonce)
  })
})
