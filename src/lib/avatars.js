const AVATAR_URLS = import.meta.glob('../../assets/images/avatars/avatar*.png', { eager: true, query: '?url', import: 'default' })

export async function loadAvatarDataUrls() {
  const srcList = Object.entries(AVATAR_URLS)
    .sort(([a], [b]) => {
      const na = parseInt(a.match(/avatar(\d+)\.png/)?.[1] || '0')
      const nb = parseInt(b.match(/avatar(\d+)\.png/)?.[1] || '0')
      return na - nb
    })
    .map(([, url]) => url)

  const results = await Promise.all(srcList.map(src => new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 96; c.height = 96
      c.getContext('2d').drawImage(img, 0, 0, 96, 96)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve('')
    img.src = src
  })))
  return results.filter(Boolean)
}
