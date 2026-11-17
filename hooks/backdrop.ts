import type { Look, SceneId } from './looks'
import { buildGlyphSea } from './scenes/glyph-sea'

/** What the Backdrop hook hands the surface: the scene's SVG and its words for a screen reader. */
export type Scene = { source: string; alt: string }

// A new scene is a builder in `scenes/` and a row here.
const BUILDERS: Record<SceneId, (look: Look) => Scene> = {
  'glyph-sea': look => ({
    source: buildGlyphSea({
      ink: look.palette.textPrimary,
      accent: look.palette.accent,
      ground: look.palette.canvas,
    }),
    alt: 'NightPub 的字符海：深色底上一片缓慢漂移的淡字符，偶尔漾过一圈涟漪，照亮右下角的 NightPub 标记。',
  }),
}

const drawn = new Map<string, Scene>()

/**
 * A look's scene. Built once a look: the surface keeps its frame only while
 * the text it is handed stays the same to the letter.
 */
export function sceneOf(look: Look): Scene {
  let scene = drawn.get(look.id)

  if (scene === undefined) {
    scene = BUILDERS[look.scene](look)
    drawn.set(look.id, scene)
  }

  return scene
}
