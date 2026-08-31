import type { AgentDefinition } from './types'
import { safeEvaluate } from './calculator'
import { formatTime } from './time'
import { fetchWeather } from './weather'

const MAX_TOOL_CHARS = 6000

function truncate(text: string, max = MAX_TOOL_CHARS): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}\n\n[truncated]`
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchWikipedia(query: string): Promise<string> {
  const encoded = encodeURIComponent(query.trim())
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}` +
    '&srlimit=5&format=json&origin=*'

  const searchResponse = await fetch(searchUrl)
  if (!searchResponse.ok) {
    throw new Error(`Wikipedia search failed (${searchResponse.status})`)
  }

  const searchData = (await searchResponse.json()) as {
    query?: { search?: { title?: string; snippet?: string }[] }
  }
  const hits = searchData.query?.search ?? []
  if (hits.length === 0) {
    return `No Wikipedia results for "${query}".`
  }

  const topTitle = hits[0]?.title
  let summary = ''
  if (topTitle) {
    const summaryResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`,
    )
    if (summaryResponse.ok) {
      const page = (await summaryResponse.json()) as {
        title?: string
        extract?: string
        content_urls?: { desktop?: { page?: string } }
      }
      const url = page.content_urls?.desktop?.page ?? ''
      summary = [`${page.title ?? topTitle}`, page.extract ?? '', url].filter(Boolean).join('\n')
    }
  }

  const related = hits
    .slice(summary ? 1 : 0, 5)
    .map((hit) => `- ${hit.title}: ${stripHtml(hit.snippet ?? '')}`)
    .join('\n')

  return truncate(
    [summary || `Wikipedia results for "${query}":`, related ? `\nRelated:\n${related}` : '']
      .join('')
      .trim(),
  )
}

export const broAgent: AgentDefinition = {
  id: 'bro',
  name: 'Bro',
  description: 'General-purpose agent for any task',
  systemPrompt:
    'You are Bro, a capable general-purpose assistant inside a notebook. ' +
    'You can see the full current page. The user may ask you to read, rewrite, or extend what is already written. ' +
    'When they want the note changed, use note tools instead of only describing the edit. ' +
    'Never create, edit, or delete agent blocks (agentInvocation / agentOutput / @mentions). Those are read-only. ' +
    'Supported note blocks: paragraph, heading (level 1-3), quote, codeBlock, bulletList, numberedList, todoList, divider, table (rows, cols), calendar (month, year), timeline (items with time, title, subtext), curl (API request), drawing (excalidraw), image. ' +
    'Inline markdown is allowed in text: **bold**, *italic*, ~~strike~~, `code`, [label](url). ' +
    'Prefer insertBlocks with a markdown string for longer writing. Use structured blocks for calendar, curl, todos with checkboxes, and images. ' +
    'Always use block ids from the latest snapshot (b1, b2, …). After a note tool, ids may change. ' +
    'Use searchWikipedia, fetchUrl, getWeather, getTime, or calculate when you need live or external data. ' +
    'When the user asks to get, open, read, or fetch a URL, link, or API, call fetchUrl exactly once, then reply. ' +
    'Never call fetchUrl more than once for the same request. ' +
    'fetchUrl inserts a readable card or table on the page. Reply with a short confirmation only — no JSON, URLs, or HTTP status. ' +
    'For questions that only need the existing note, do not call external tools. ' +
    'Be concise. If you already edited the note, the final reply should be a short confirmation.',
  tools: [
    {
      name: 'getNote',
      description: 'Re-read the current notebook page with block ids',
      host: true,
      parameters: {},
    },
    {
      name: 'insertBlocks',
      description:
        'Insert note blocks after a block id, or at start/end. Use markdown and/or structured blocks. Cannot create agent blocks.',
      host: true,
      parameters: {
        after: {
          type: 'string',
          description: 'Block id (b3), "start", or "end" (default end)',
        },
        before: { type: 'string', description: 'Optional block id to insert before' },
        markdown: {
          type: 'string',
          description:
            'Markdown to convert into blocks: headings, lists, todos (- [ ]), quotes, fenced code, --- dividers, paragraphs',
        },
        blocks: {
          type: 'array',
          description:
            'Structured blocks: {type, text?, level?, language?, items?, method?, url?, headers?, body?, src?, alt?, month?, year?} (type timeline uses items: [{time, title, subtext}]; type drawing/excalidraw inserts an empty canvas)',
        },
      },
    },
    {
      name: 'replaceBlock',
      description:
        'Replace one editable block by id. Use text to keep the same type, or markdown/blocks for a new block.',
      host: true,
      parameters: {
        id: { type: 'string', description: 'Block id to replace, e.g. b2', required: true },
        text: { type: 'string', description: 'Replacement text, keeping the current block type' },
        markdown: { type: 'string', description: 'Markdown replacement' },
        block: { type: 'object', description: 'Single structured block' },
      },
    },
    {
      name: 'replaceBlocks',
      description: 'Replace an inclusive range of editable blocks with new content',
      host: true,
      parameters: {
        fromId: { type: 'string', description: 'First block id', required: true },
        toId: { type: 'string', description: 'Last block id (defaults to fromId)' },
        markdown: { type: 'string', description: 'Markdown replacement' },
        blocks: { type: 'array', description: 'Structured replacement blocks' },
      },
    },
    {
      name: 'deleteBlocks',
      description: 'Delete editable blocks by id. Cannot delete agent blocks.',
      host: true,
      parameters: {
        ids: { type: 'array', description: 'Block ids to delete, e.g. ["b2","b3"]', required: true },
      },
    },
    {
      name: 'searchWikipedia',
      description: 'Search Wikipedia for facts, people, places, and topics',
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
      },
    },
    {
      name: 'fetchUrl',
      description:
        'GET a public URL once and insert a readable card or table. Call at most once, then reply.',
      host: true,
      once: true,
      parameters: {
        url: { type: 'string', description: 'Full http(s) URL to GET', required: true },
      },
    },
    {
      name: 'getWeather',
      description: 'Get current weather conditions for a city',
      parameters: {
        city: { type: 'string', description: 'City name', required: true },
      },
    },
    {
      name: 'getTime',
      description: 'Get current date and time in a timezone',
      parameters: {
        timezone: {
          type: 'string',
          description: 'IANA timezone name, e.g. Asia/Kolkata',
          required: true,
        },
      },
    },
    {
      name: 'calculate',
      description: 'Evaluate a math expression',
      parameters: {
        expression: { type: 'string', description: 'Math expression to evaluate', required: true },
      },
    },
  ],
  async executeTool(name, params) {
    switch (name) {
      case 'searchWikipedia': {
        const query = String(params.query ?? '').trim()
        if (!query) throw new Error('query parameter is required')
        return searchWikipedia(query)
      }
      case 'getWeather': {
        const city = String(params.city ?? '').trim()
        if (!city) throw new Error('city parameter is required')
        return fetchWeather(city)
      }
      case 'getTime': {
        const timezone = String(params.timezone ?? '').trim()
        if (!timezone) throw new Error('timezone parameter is required')
        return formatTime(timezone)
      }
      case 'calculate': {
        const expression = String(params.expression ?? '').trim()
        if (!expression) throw new Error('expression parameter is required')
        const result = safeEvaluate(expression)
        return `${expression} = ${result}`
      }
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  },
}
