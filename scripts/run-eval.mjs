/**
 * 编译并运行判定自检。
 *
 *   pnpm eval        看总表
 *   pnpm eval -v     看每一条漏判与误伤
 *
 * 判定层是纯 TS，不依赖浏览器，所以单独用一份 CommonJS 配置编译到 .eval-out/
 * 直接跑，比在页面里点一遍更快。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')

execFileSync(process.execPath, [tsc, '-p', 'tsconfig.eval.json'], { cwd: root, stdio: 'inherit' })

const out = join(root, '.eval-out')
mkdirSync(out, { recursive: true })
// package.json 里是 "type": "module"，这里得显式声明编译产物是 CommonJS
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}')

execFileSync(process.execPath, [join(out, 'scripts', 'eval.js'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
})
