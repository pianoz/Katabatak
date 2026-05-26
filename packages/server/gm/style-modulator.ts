import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = join(__dirname, 'content')
const STYLE_COUNT = 3

/** Returns the text of a randomly selected style file. */
export function pickStyleText(): string {
  const index = Math.floor(Math.random() * STYLE_COUNT) + 1
  const filePath = join(CONTENT_DIR, `style_${index}.txt`)
  return readFileSync(filePath, 'utf-8')
}
