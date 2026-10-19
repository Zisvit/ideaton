/**
 * v6 + v7 (совет: mimo/deepseek/glm + раунд v7): мини-проверка У КАЖДОГО
 * пункта плана. Контент — в закрытом глоссарии lib/glossary.json (89 тем:
 * 87 навыков skills.yaml + api + «учебный проект»), генерация — здесь.
 *
 * Контракт no-score (UX.md): без счёта, без красного, повтор безлимитный.
 * v13 (совет 7/9): проверка — цепочка 2–3 этапов (поле more, прогресс
 * эфемерный) и ВОРОТА галочки done: «сделано» отмечается после «понял».
 *
 * Правила генерации (совет, раунд 2 + v7 + v13-цепочки):
 *  - gap «Закрыть пробел «X»» → CHOICE «зачем навык в роли»;
 *  - «Познакомиться с X» → CHOICE «что это на практике»;
 *  - «Собрать проект/подборку/памятку…» → DO;
 *  - «Изучить/Освоить/Научиться/Отработать X…» → SELF по теме из глоссария;
 *  - тема ищется по name/aliases без учёта регистра и «ё» (длиннейший алиас
 *    побеждает); нет темы → мини-теста нет (no-signal, кнопки не существует);
 *  - дистракторы — «из той же лиги» (соседи по cluster), верный ответ
 *    сдвигается детерминированно (хэш промпта) — не позиция 0 всегда;
 *  - у каждой проверки есть skill/label — узлы «Карты тем» на /plan.
 */

import glossaryData from './glossary.json'

export type MiniKind = 'choice' | 'self' | 'do'

/** v13: этап цепочки мини-проверки (продолжение — в поле MiniCheck.more). */
export type MiniStep = {
  kind: MiniKind
  prompt: string
  options?: string[]
  correct?: number
  hint?: string
}

export type MiniCheck = {
  kind: MiniKind
  prompt: string
  options?: string[]
  correct?: number
  hint?: string
  skill?: string
  label?: string
  /** v13: этапы 2–3 — «тесты сложнее и многоэтапные» (совет 7/9). */
  more?: MiniStep[]
}

type GlossaryEntry = {
  name: string
  cluster: string
  aliases: string[]
  why: string
  what: string
  hint: string
  distractors?: string[]
}

/** Закрытый глоссарий тем (JSON — его же читает python-гейт покрытия). */
export const GLOSSARY: Record<string, GlossaryEntry> = glossaryData as unknown as Record<
  string,
  GlossaryEntry
>

/** Нормализация: регистр, «ё» → «е», обрезка. */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е')
}

/** Резолв темы по тексту: длиннейший алиас/имя из глоссария побеждает. */
export function resolveTopicId(text: string): string | null {
  const t = norm(text)
  if (!t) return null
  let best: { id: string; len: number } | null = null
  for (const id of Object.keys(GLOSSARY).sort()) {
    const entry = GLOSSARY[id]
    const forms = [entry.name, ...(entry.aliases || [])]
    for (const form of forms) {
      const a = norm(form)
      if (!a || !t.includes(a)) continue
      if (!best || a.length > best.len) best = { id, len: a.length }
    }
  }
  return best ? best.id : null
}

/** Детерминированный хэш строки (без Math.random — ответы воспроизводимы). */
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Два дистрактора: явные (legacy-темы) или соседи по cluster. */
function distractorsFor(
  id: string,
  entry: GlossaryEntry,
  field: 'why' | 'what'
): string[] {
  const explicit = entry.distractors
  if (Array.isArray(explicit) && explicit.length >= 2) return explicit.slice(0, 2)
  const pool = Object.keys(GLOSSARY)
    .sort()
    .filter((key) => key !== id && GLOSSARY[key].cluster === entry.cluster)
    .map((key) => GLOSSARY[key][field])
  if (pool.length < 2) return []
  const h = hashStr(id + field)
  const i1 = h % pool.length
  let i2 = (h * 7 + 3) % pool.length
  if (i2 === i1) i2 = (i1 + 1) % pool.length
  return [pool[i1], pool[i2]]
}

/** Три варианта CHOICE: верный + 2 дистрактора; позиция — по хэшу промпта. */
function choiceParts(
  id: string,
  entry: GlossaryEntry,
  prompt: string,
  field: 'why' | 'what'
): { options: string[]; correct: number } | null {
  const right = entry[field]
  const [d1, d2] = distractorsFor(id, entry, field)
  if (!d1 || !d2) return null
  const pos = hashStr(prompt) % 3
  const rest = [d1, d2]
  const options: string[] = []
  let r = 0
  for (let i = 0; i < 3; i++) options.push(i === pos ? right : rest[r++])
  return { options, correct: pos }
}

/** CHOICE: верный вариант + 2 дистрактора; кластер мал — честный SELF. */
function choice(
  id: string,
  entry: GlossaryEntry,
  prompt: string,
  field: 'why' | 'what'
): MiniCheck {
  const parts = choiceParts(id, entry, prompt, field)
  if (!parts) {
    return {
      kind: 'self',
      prompt: `Объясни своими словами: ${prompt}`,
      hint: entry.hint,
      skill: id,
      label: entry.name,
    }
  }
  return {
    kind: 'choice',
    prompt,
    options: parts.options,
    correct: parts.correct,
    hint: entry.hint,
    skill: id,
    label: entry.name,
  }
}

/** v13: дополнительный CHOICE-этап цепочки (null — кластер беден, шаг пропускаем). */
function moreChoice(
  id: string,
  entry: GlossaryEntry,
  prompt: string,
  field: 'why' | 'what'
): MiniStep | null {
  const parts = choiceParts(id, entry, prompt, field)
  if (!parts) return null
  return {
    kind: 'choice',
    prompt,
    options: parts.options,
    correct: parts.correct,
    hint: entry.hint,
  }
}

/** v13: дополнительный SELF-этап — «где применишь» (без счёта, повтор свободен). */
function moreSelf(prompt: string, hint: string): MiniStep {
  return { kind: 'self', prompt, hint }
}

/** Оставляем только непустые этапы цепочки (честность важнее длины). */
function chain(...steps: Array<MiniStep | null>): MiniStep[] {
  return steps.filter((step): step is MiniStep => Boolean(step))
}

/** Разбор текста задачи (данные /plan) → мини-проверка или null. */
export function buildMiniCheck(task: string): MiniCheck | null {
  if (!task) return null

  // «Закрыть пробел «CSS»: обязательный навык роли, в профиле его нет»
  const gap = /Закрыть\s+пробел\s+«([^»]+)»/.exec(task)
  if (gap) {
    const id = resolveTopicId(gap[1])
    if (!id) return null
    const entry = GLOSSARY[id]
    const first = choice(id, entry, `Зачем в этой роли ${entry.name}?`, 'why')
    // v13: цепочка «зачем → что на практике → где применишь» (2–3 этапа)
    first.more = chain(
      moreChoice(id, entry, `Что значит «${entry.name}» на практике?`, 'what'),
      moreSelf(
        `Где в роли пригодится ${entry.name}? Одно предложение — этап закрыт.`,
        entry.hint
      )
    )
    return first
  }

  // «Познакомиться с …» — тема ищется в полном тексте задачи
  if (/Познакомиться\s+с\s+/i.test(task)) {
    const id = resolveTopicId(task)
    if (!id) return null
    const entry = GLOSSARY[id]
    const first = choice(id, entry, `Что значит «${entry.name}» на практике?`, 'what')
    first.more = chain(moreChoice(id, entry, `Зачем в этой роли ${entry.name}?`, 'why'))
    return first
  }

  // «Собрать проект/подборку/памятку/чек-лист…» → DO (один результат)
  if (
    /Собрать\s+проект|Собрать\s+(?:подборку|портфолио|памятку|чек-лист|конспект)/i.test(
      task
    )
  ) {
    const g = GLOSSARY['учебный проект']
    return {
      kind: 'do',
      prompt: 'Собрал и можешь показать? Один небольшой результат — уже достаточно.',
      hint: g.hint,
      label: g.name,
      more: chain(
        moreSelf('Что войдёт в результат? Назови главное своими словами.', g.hint)
      ),
    }
  }

  // v6: «Изучить основы HTML и CSS, сверстать первую страницу» → DO
  if (/Изучить\s+основы\s+HTML/i.test(task) || /сверстать/i.test(task)) {
    const htmlId = resolveTopicId('HTML')
    return {
      kind: 'do',
      prompt: 'Сверстал первую страницу и готов показать файл или скрин?',
      hint: 'Достаточно одной страницы: шапка, секция и форма. Главное — довести до конца.',
      skill: 'html',
      label: 'HTML',
      more: chain(
        htmlId
          ? moreChoice(htmlId, GLOSSARY[htmlId], 'Что значит «HTML» на практике?', 'what')
          : null
      ),
    }
  }

  // v6: «Освоить JavaScript на уровне DOM и асинхронности» → SELF
  if (/Освоить\s+JavaScript/i.test(task)) {
    const g = GLOSSARY.javascript
    return {
      kind: 'self',
      prompt: 'Объясни одним предложением: что делает JavaScript на странице?',
      hint: g.hint,
      skill: 'javascript',
      label: 'JavaScript',
      more: chain(
        moreChoice('javascript', g, 'Что значит «JavaScript» на практике?', 'what')
      ),
    }
  }

  // v6: «Научиться работать с API и fetch-запросами» → SELF
  if (/API|fetch/i.test(task)) {
    const g = GLOSSARY.api
    return {
      kind: 'self',
      prompt: 'Объясни своими словами: что делает fetch-запрос в приложении?',
      hint: g.hint,
      skill: 'api',
      label: 'API',
      more: chain(moreChoice('api', g, 'Что значит «API» на практике?', 'what')),
    }
  }

  // v7: «Изучить/Освоить/Научиться/Отработать/Настроить X…» → SELF по теме
  const study = /^(Изучить|Освоить|Научиться|Отработать|Настроить)\s+/i.exec(task)
  if (study) {
    const id = resolveTopicId(task)
    if (!id) return null
    const entry = GLOSSARY[id]
    return {
      kind: 'self',
      prompt: `Объясни одним предложением: зачем ${entry.name} в этой роли?`,
      hint: entry.hint,
      skill: id,
      label: entry.name,
      more: chain(moreChoice(id, entry, `Что значит «${entry.name}» на практике?`, 'what')),
    }
  }

  return null // нет содержательного контента → нет теста (no-signal, совет раунд 2)
}
