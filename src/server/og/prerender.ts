import { ImageResponse } from 'next/og'
import { fetchAvatarDataUri, toResultViewModel } from '../../app/api/og/og-data'
import { renderOgCard } from '../../app/api/og/og-card'
import { loadOgFonts } from '../../app/api/og/og-fonts'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '../../app/api/og/og-response'
import { getCachedOgImage, setCachedOgImage } from '../cache/og-image-cache'
import type { ScoreCoverage, ScoreLimits } from '../api/score'
import type { SlopScoreResult } from '../scoring'

const OG_IMAGE_TTL_MS = 12 * 60 * 60 * 1000

export const prerenderOgImage = async (
  username: string,
  result: SlopScoreResult,
  coverage: ScoreCoverage,
  limits: ScoreLimits,
): Promise<void> => {
  if (getCachedOgImage(username) !== null) {
    return
  }

  const avatarDataUri = await fetchAvatarDataUri(username).catch(() => null)

  const viewModel = toResultViewModel({
    username,
    avatarDataUri,
    result,
    coverage,
    limits,
  })

  const fonts = await loadOgFonts(
    `areyougoingtoslop@${username}${viewModel.variant}`,
  )

  const image = new ImageResponse(renderOgCard(viewModel), {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  })

  const png = await image.arrayBuffer()
  setCachedOgImage(username, png, OG_IMAGE_TTL_MS)

  console.info('og_prerender', { username, bytes: png.byteLength })
}
