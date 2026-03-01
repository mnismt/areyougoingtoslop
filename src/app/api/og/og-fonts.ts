import type { ImageResponseOptions } from 'next/server'

const fontCache = new Map<string, ArrayBuffer>()

const loadGoogleFont = async (
  font: string,
  text: string,
): Promise<ArrayBuffer> => {
  const key = `${font}:${text}`
  const cached = fontCache.get(key)
  if (cached) {
    return cached
  }

  const cssUrl = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`
  const css = await (await fetch(cssUrl)).text()
  const match = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

  if (!match) {
    throw new Error(`unable to resolve font source for ${font}`)
  }

  const response = await fetch(match[1])
  if (!response.ok) {
    throw new Error(`unable to fetch font data for ${font}`)
  }

  const data = await response.arrayBuffer()
  fontCache.set(key, data)
  return data
}

export const loadOgFonts = async (
  text?: string,
): Promise<ImageResponseOptions['fonts']> => {
  const defaultText =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/`~ '
  const textToLoad = text?.trim() ? text : defaultText

  try {
    const [interRegular, interBold, jetbrainsRegular] = await Promise.all([
      loadGoogleFont('Inter:wght@400', textToLoad),
      loadGoogleFont('Inter:wght@700', textToLoad),
      loadGoogleFont('JetBrains+Mono:wght@500', textToLoad),
    ])

    return [
      {
        name: 'Inter',
        data: interRegular,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Inter',
        data: interBold,
        weight: 700,
        style: 'normal',
      },
      {
        name: 'JetBrains Mono',
        data: jetbrainsRegular,
        weight: 500,
        style: 'normal',
      },
    ]
  } catch (error) {
    console.error('failed to load og fonts', error)
    return []
  }
}
