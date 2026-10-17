/**
 * v6 (совет: mimo/deepseek/glm): мини-проверка У КАЖДОГО пункта плана.
 * Web-only: контент живёт на фронте, бэкенд (openapi/schemas/main.py) не тронут.
 *
 * Контракт no-score (UX.md): без счёта, без красного, повтор безлимитный.
 * Мини-тест отвечает на «понял ли» — он НЕ меняет done («сделал ли»).
 *
 * Правила генерации (совет, раунд 2):
 *  - тип по префиксу задачи: gap «Закрыть пробел «X»» → CHOICE «зачем навык»,
 *    «Познакомиться с X» → CHOICE, «Собрать проект» → DO, остальное → SELF;
 *  - навык не найден в глоссарии → мини-теста нет (кнопки «Проверить» не
 *    существует): нет содержательного контента — нет теста (no-signal);
 *  - дистракторы — правдоподобные, но читаемые ошибки; подсказка — «как
 *    наставник в кабинете», 1–2 предложения, без обещаний трудоустройства.
 */

export type MiniKind = 'choice' | 'self' | 'do'

export type MiniCheck = {
  kind: MiniKind
  prompt: string
  options?: string[]
  correct?: number
  hint?: string
}

/** Глоссарий навыков: зачем навык в роли + ориентир для SELF (glm/mimo). */
const GLOSSARY: Record<
  string,
  { why: string; distractors: string[]; what: string; hint: string }
> = {
  html: {
    why: 'Задаёт структуру страницы: заголовки, разделы, формы и кнопки — то, из чего состоит любой сайт.',
    distractors: [
      'Рисует плавные анимации интерфейса.',
      'Считает и хранит результаты тестов.',
    ],
    what: 'Собирает страницу из блоков: шапка, статьи, формы — по ним браузер строит документ.',
    hint: 'Объясни через структуру: HTML — это скелет страницы, из блоков которого собирается документ.',
  },
  css: {
    why: 'Стилизует интерфейс: цвета, сетки, шрифты и отступы — всё, что видит пользователь.',
    distractors: [
      'Шифрует запросы между браузером и сервером.',
      'Хранит данные пользователей в базе.',
    ],
    what: 'Управляет внешним видом блоков: сетка, цвета, шрифты, расстояния.',
    hint: 'Скелет (HTML) и кожа (CSS): CSS отвечает за то, КАК страница выглядит.',
  },
  javascript: {
    why: 'Оживляет страницу: реагирует на действия пользователя и меняет содержимое без перезагрузки.',
    distractors: [
      'Задаёт разметку блоков страницы.',
      'Напрямую рисует цвета и шрифты без разметки.',
    ],
    what: 'Читает и меняет DOM: клики, ввод, подгрузка данных — всё через JS.',
    hint: 'JS связывает разметку и поведение: страница меняется на ходу, без перезагрузки (DOM, fetch).',
  },
  react: {
    why: 'Собирает интерфейс из переиспользуемых компонентов — так работают современные веб-команды.',
    distractors: [
      'Ускоряет загрузку фотографий на сайте.',
      'Заменяет базу данных на клиенте.',
    ],
    what: 'Интерфейс = дерево компонентов с состоянием: переиспользование вместо копипасты.',
    hint: 'React — это про компоненты: один блок кода переиспользуется во всех местах интерфейса.',
  },
  typescript: {
    why: 'Даёт строгие типы поверх JavaScript: ошибки видно до запуска кода, а не после.',
    distractors: [
      'Заменяет базу данных на клиенте.',
      'Рисует разметку страницы по макету.',
    ],
    what: 'Тот же JavaScript плюс подписи функций и структур, которые проверяет компилятор.',
    hint: 'TypeScript — это JavaScript со строгими подписями: типы ловят ошибки заранее, до запуска.',
  },
  api: {
    why: 'Понимать API и fetch — значит уметь получать и отправлять данные между фронтендом и сервером.',
    distractors: [
      'Парсить чужие сайты вакансий без их согласия.',
      'Редактировать чужие базы данных напрямую.',
    ],
    what: 'Fetch-запрос: страница просит у сервера данные (JSON) и показывает их без перезагрузки.',
    hint: 'Fetch — это вежливый запрос: «сервер, отдай данные», ответ — JSON, который код рисует на странице.',
  },
  'учебный проект': {
    why: 'Собранный проект — первый артефакт, который можно показать наставнику и в портфолио.',
    distractors: [
      'Собрать максимальный список модулей во всех технологиях сразу.',
      'Дождаться окончания учёбы, чтобы начать проект.',
    ],
    what: 'Один связанный модуль: вход → обработка → результат. Маленький, но рабочий.',
    hint: 'Проект — это одна доведённая до конца вещь, а не десять начатых.',
  },
}

/** Разбор текста задачи (данные /plan) → мини-проверка или null. */
export function buildMiniCheck(task: string): MiniCheck | null {
  if (!task) return null

  // «Закрыть пробел «CSS»: обязательный навык роли, в профиле его нет»
  const gap = /Закрыть\s+пробел\s+«([^»]+)»/.exec(task)
  if (gap) {
    const skill = normSkill(gap[1])
    const g = GLOSSARY[skill]
    if (!g) return null
    return {
      kind: 'choice',
      prompt: `Зачем в этой роли ${skillLabel(skill)}?`,
      options: [g.why, ...g.distractors],
      correct: 0,
      hint: g.hint,
    }
  }

  // «Познакомиться с React» / «Познакомиться с X»
  const meet = /Познакомиться\s+с\s+([A-Za-zА-Яа-я0-9+.]+)/.exec(task)
  if (meet) {
    const skill = normSkill(meet[1])
    const g = GLOSSARY[skill]
    if (!g) return null
    return {
      kind: 'choice',
      prompt: `Что делает ${skillLabel(skill)} в твоём проекте?`,
      options: [g.what, ...g.distractors],
      correct: 0,
      hint: g.hint,
    }
  }

  // «Собрать проект: фронтенд + бэкенд + база данных»
  if (/Собрать\s+проект/i.test(task)) {
    const g = GLOSSARY['учебный проект']
    return {
      kind: 'do',
      prompt: 'Собрал связанный модуль — вход, обработка, результат?',
      hint: g.hint,
    }
  }

  // «Изучить основы HTML и CSS, сверстать первую страницу» → DO
  if (/Изучить\s+основы\s+HTML/i.test(task) || /сверстать/i.test(task)) {
    const g = GLOSSARY['учебный проект']
    return {
      kind: 'do',
      prompt: 'Сверстал первую страницу и готов показать файл или скрин?',
      hint: 'Достаточно одной страницы: шапка, секция и форма. Главное — довести до конца.',
    }
  }

  // «Освоить JavaScript на уровне DOM и асинхронности» → SELF
  const js = /Освоить\s+JavaScript/i.test(task)
  if (js) {
    const g = GLOSSARY.javascript
    return {
      kind: 'self',
      prompt: 'Объясни одним предложением: что делает JavaScript на странице?',
      hint: g.hint,
    }
  }

  // «Научиться работать с API и fetch-запросами» → SELF
  if (/API|fetch/i.test(task)) {
    const g = GLOSSARY.api
    return {
      kind: 'self',
      prompt: 'Объясни своими словами: что делает fetch-запрос в приложении?',
      hint: g.hint,
    }
  }

  // «Изучить/Освоить X» для остальных навыков: SELF по глоссарию
  const study = /^(Изучить|Освоить|Научиться)\s+/i.exec(task)
  if (study) {
    // ищем первый навык из глоссария в тексте задачи
    for (const [skill, g] of Object.entries(GLOSSARY)) {
      if (skill === 'учебный проект') continue
      const label = skillLabel(skill)
      if (task.includes(label)) {
        return {
          kind: 'self',
          prompt: `Объясни одним предложением: зачем ${label} в этой роли?`,
          hint: g.hint,
        }
      }
    }
  }

  return null // нет содержательного контента → нет теста (no-signal, совет раунд 2)
}

/** Нормализация названия навыка из текста задачи. */
function normSkill(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (s === 'js' || s.includes('javascript')) return 'javascript'
  if (s === 'ts' || s.includes('typescript')) return 'typescript'
  if (s === 'react' || s.includes('react')) return 'react'
  if (s === 'html') return 'html'
  if (s === 'css') return 'css'
  if (s === 'api') return 'api'
  return s
}

/** Человекочитаемая подпись навыка (HTML/CSS/JavaScript/React/API). */
function skillLabel(skill: string): string {
  if (skill === 'javascript') return 'JavaScript'
  if (skill === 'api') return 'API'
  if (skill === 'учебный проект') return 'учебный проект'
  return skill.toUpperCase()
}
