// End-to-end smoke test against a running API.
//   API_URL=http://localhost:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... [PARENT_EMAIL=... PARENT_PASSWORD=...] npm run smoke
// Read-only apart from sign-ins: it never creates, changes or deletes school data.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '')
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'app', 'api')
let failures = 0

function check(name, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`)
}

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

async function login(email, password) {
  const res = await call('/api/v1/auth/login', { method: 'POST', body: { email, password } })
  return res.status === 200 ? res.json.data : null
}

// Every collection route (no [id] segment) that exports GET
function listRoutes(dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!name.startsWith('[')) listRoutes(full, out)
    } else if (name === 'route.ts' && /export (const|async function) GET|export \{[^}]*GET|export \* from/.test(readFileSync(full, 'utf8'))) {
      out.push('/api/' + relative(root, dir).split(sep).join('/'))
    }
  }
  return out
}

const health = await call('/api/health')
check('health', health.status === 200 && health.json?.data?.database === 'up', JSON.stringify(health.json))

check('no token is rejected', (await call('/api/students')).status === 401)
check('garbage token is rejected', (await call('/api/students', { token: 'not-a-token' })).status === 401)

const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)
check('admin login', !!admin)
if (admin) {
  check('refresh token is not an access token', (await call('/api/students', { token: admin.refreshToken })).status === 401)
  const refreshed = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: admin.refreshToken } })
  check('refresh issues new tokens', refreshed.status === 200 && !!refreshed.json?.data?.accessToken)
  check('admin cannot read the portal', (await call('/api/portal/data', { token: admin.accessToken })).status === 403)

  const skip = ['/api/health', '/api/auth', '/api/portal', '/api/account']
  // These need query parameters; a 400 asking for them is the expected answer
  const needsParams = ['/api/students/attendance']
  for (const path of listRoutes().filter((p) => !skip.some((s) => p.startsWith(s))).sort()) {
    const res = await call(path, { token: admin.accessToken })
    const ok = res.status === 200 || (needsParams.includes(path) && res.status === 400)
    check(`GET ${path}`, ok, `${res.status} ${JSON.stringify(res.json)?.slice(0, 120)}`)
  }
}

if (process.env.PARENT_EMAIL) {
  const parent = await login(process.env.PARENT_EMAIL, process.env.PARENT_PASSWORD)
  check('parent login', !!parent)
  if (parent) {
    const data = await call('/api/v1/portal/data', { token: parent.accessToken })
    check('parent reads portal data', data.status === 200 && Array.isArray(data.json?.data?.children))
    check('parent cannot read staff endpoints', (await call('/api/students', { token: parent.accessToken })).status === 403)
    check('parent cannot submit assignments', (await call('/api/portal/submissions', { token: parent.accessToken, method: 'POST', body: { assignmentId: 'x', content: 'x' } })).status === 403)
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
