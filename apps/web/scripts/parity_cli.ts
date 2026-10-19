/**
 * Паритет-проверка офлайн-движка (волна v11): node-CLI для
 * tests/test_v11_parity.py. Собирается отдельным tsc-вызовом (см. тест).
 *
 * stdin:  {"op":"recommend","profile":{...}}
 *         {"op":"plan","role_id":"web","profile":{...}}
 *         {"op":"selftest"}
 * stdout: JSON {ok,status,data} | null (роли нет — аналог 404) | {"error":...}
 */

import { planLocal, pyRound, recommendLocal } from '../lib/localEngine'

// Минимальная типизация stdin/stdout: CLI не зависит от @types/node —
// тест собирает файл автономным tsc-вызовом без tsconfig.
declare const process: {
  stdin: {
    setEncoding(encoding: string): void
    on(event: string, listener: (...args: string[]) => void): void
  }
  stdout: { write(chunk: string): void }
}

type ProfileIn = {
  skills?: string[]
  interests?: string[]
  subjects?: string[]
  course?: number
  specialty?: string
}

type Payload = {
  op?: 'recommend' | 'plan' | 'selftest'
  role_id?: string
  profile?: ProfileIn
}

function profileOf(p?: ProfileIn) {
  return {
    skills: p?.skills ?? [],
    interests: p?.interests ?? [],
    subjects: p?.subjects ?? [],
    course: p?.course,
    specialty: p?.specialty,
  }
}

const chunks: string[] = []
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => chunks.push(String(chunk)))
process.stdin.on('end', () => {
  let payload: Payload
  try {
    payload = JSON.parse(chunks.join('')) as Payload
  } catch {
    process.stdout.write(JSON.stringify({ error: 'bad json' }))
    return
  }
  try {
    if (payload.op === 'recommend') {
      const res = recommendLocal(profileOf(payload.profile))
      process.stdout.write(
        JSON.stringify({ ok: res.ok, status: res.status, data: res.data })
      )
    } else if (payload.op === 'plan') {
      const res = planLocal(String(payload.role_id ?? ''), profileOf(payload.profile))
      process.stdout.write(
        JSON.stringify(res ? { ok: res.ok, status: res.status, data: res.data } : null)
      )
    } else if (payload.op === 'selftest') {
      process.stdout.write(
        JSON.stringify({
          selftest: {
            pyRound: [
              pyRound(0.5),
              pyRound(1.5),
              pyRound(2.5),
              pyRound(2.4),
              pyRound(12.5),
            ],
          },
        })
      )
    } else {
      process.stdout.write(JSON.stringify({ error: 'unknown op' }))
    }
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: String(error) }))
  }
})
