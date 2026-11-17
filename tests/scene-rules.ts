/**
 * What would stop a scene's SVG being drawn, one line a rule; empty when
 * nothing would. Three readers stand between a scene and the screen, and each
 * drops what it dislikes without a word:
 *
 * - the engine holds a Svg's source to 131,072 characters, and from 2.1.326
 *   refuses the whole Backdrop tree over embedded data, entities, comments
 *   and anything that could load;
 * - the desktop app runs it through DOMPurify: scripts and handlers go, a
 *   `<style>` whose text holds a tag-like `<` goes whole, and an id that
 *   names a property of the document goes;
 * - the frame it is drawn in loads nothing.
 */
export function sceneProblems(svg: string): string[] {
  const problems: string[] = []
  const say = (isBroken: boolean, line: string) => {
    if (isBroken) {
      problems.push(line)
    }
  }

  say(svg.length > 131072, `${svg.length} characters: over 131,072`)
  say(!svg.startsWith('<svg ') || !svg.endsWith('</svg>'), 'not one <svg> root with nothing around it')
  say(/<script/i.test(svg), 'a <script>')
  say(/\son[a-z]+\s*=/i.test(svg), 'an on* handler')
  say(/<(foreignObject|image|a|iframe)[\s>]/i.test(svg), 'a tag the desktop app forbids')
  say(/data:|base64|@font-face|@import/i.test(svg), 'embedded data, a font face or an import')
  say(/&(?!(amp|lt|gt|quot|apos);)/.test(svg), 'an & that is not one of the five basic entities')
  say(svg.includes('\\'), 'a backslash')
  say(svg.includes('<!'), 'a comment, doctype or CDATA')
  say(svg.includes('/*'), 'a CSS comment')
  say(/href="(?!#)/.test(svg), 'an href that is not "#id"')
  say(/url\((?!#)/.test(svg), 'a url() that is not url(#id)')

  for (const [, text] of svg.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    say((text ?? '').includes('<'), 'a < inside <style>')
  }

  for (const [, id] of svg.matchAll(/\sid="([^"]*)"/g)) {
    say(!/^np[-a-z0-9]+$/.test(id ?? ''), `id "${id}" without the np prefix`)
  }

  // In a begin value a hyphen starts a negative offset, so a clock other
  // animations wait on is named without one.
  for (const [, begin] of svg.matchAll(/\sbegin="([^"]*)"/g)) {
    say(/[a-z]-[a-z0-9]*\.(begin|end)/.test(begin ?? ''), `begin "${begin}" waits on an id with a hyphen`)
  }

  for (const [tag] of svg.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const rest = tag
      .replace(/^<[a-zA-Z]+/, '')
      .replace(/\s[a-zA-Z:-]+="[^"]*"/g, '')
      .replace(/\/?>$/, '')
    say(rest.trim() !== '', `an attribute without a quoted value in ${tag.slice(0, 60)}`)
  }

  return problems
}
