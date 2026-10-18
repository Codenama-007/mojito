import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { brand } from '../src/config/brand.js'
import { metaDescription, metaTitle } from '../src/config/siteContent.js'
import { escape, renderStaticShell, renderStructuredData } from '../src/seo/staticHtml.js'

/**
 * Puts the readable content into the built HTML.
 *
 * Without this the site is a client-rendered SPA: `dist/index.html` is a `<div
 * id="root"></div>` and a script tag, and every word of the page exists only
 * after a module has executed. That is fine for a person with a browser and
 * useless for a crawler that reads the response body — which is most of them,
 * and all of the AI ones.
 *
 * So the build writes the about-brand section and the FAQ into `#root` as plain
 * HTML, plus the JSON-LD into the head. React replaces that markup on mount, so
 * the visitor sees the normal app; nothing hydrates, so there is no mismatch to
 * warn about, and the copy a person reads is the copy a crawler read.
 *
 * The `Sitemap:` line in `public/robots.txt` is a path, because a path is the
 * only thing that can be written down before the domain exists. Here, with the
 * environment in hand, it is made absolute — crawlers require an absolute sitemap
 * URL and silently ignore a relative one.
 */

const VERCEL_HOST =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ''

/** The public origin, no trailing slash. `config/brand.js` wins over the platform. */
const origin = (brand.siteUrl || (VERCEL_HOST ? `https://${VERCEL_HOST}` : '')).replace(
  /\/$/,
  '',
)

const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin ? `${origin}/` : '/'}</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`

export default function aiPrerender() {
  let outDir = 'dist'

  return {
    name: 'ai-prerender',

    configResolved(config) {
      outDir = config.build.outDir
    },

    /**
     * `post` so this runs after Vite's own HTML handling, and it throws rather
     * than returning the HTML unchanged: a prerender that silently does not
     * happen is the failure mode this whole plugin exists to prevent, and it
     * would be invisible until someone viewed a page source.
     *
     * The title and the description are replaced from the same config as the
     * body, so the head of the document cannot describe a brand the body has
     * moved on from.
     */
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const patterns = {
          'an empty <div id="root"></div>': /<div id="root">\s*<\/div>/,
          'a <title>': /<title>[\s\S]*?<\/title>/,
          'the description meta tag': /<meta name="description" content="[\s\S]*?" \/>/,
        }

        for (const [what, pattern] of Object.entries(patterns)) {
          if (!pattern.test(html)) {
            throw new Error(
              `ai-prerender: could not find ${what} in index.html, so the static ` +
                'content was not injected. If index.html changed shape, update this ' +
                'plugin and scripts/verify-static-html.mjs together.',
            )
          }
        }

        const head = [
          renderStructuredData(),
          `<link rel="canonical" href="${origin ? `${origin}/` : '/'}" />`,
        ].join('\n    ')

        return html
          .replace(patterns['an empty <div id="root"></div>'], `<div id="root">${renderStaticShell()}</div>`)
          .replace(patterns['a <title>'], `<title>${escape(metaTitle)}</title>`)
          .replace(
            patterns['the description meta tag'],
            `<meta name="description" content="${escape(metaDescription).replace(/"/g, '&quot;')}" />`,
          )
          .replace('</head>', `  ${head}\n  </head>`)
      },
    },

    /**
     * By now the public directory has been copied, so `dist/robots.txt` is on
     * disk and its one relative line can be resolved.
     */
    async closeBundle() {
      await writeFile(resolve(outDir, 'sitemap.xml'), sitemapXml())

      if (!origin) {
        // Paths in both files, and a sitemap a crawler will skip until the site
        // has a domain. Said out loud rather than discovered later.
        this.warn(
          'ai-prerender: no site origin, so robots.txt and sitemap.xml use paths. ' +
            'Set `siteUrl` in src/config/brand.js before deploying.',
        )
        return
      }

      const robotsPath = resolve(outDir, 'robots.txt')
      const robots = await readFile(robotsPath, 'utf8')
      await writeFile(
        robotsPath,
        robots.replace(/^Sitemap: .*$/m, `Sitemap: ${origin}/sitemap.xml`),
      )
    },
  }
}
