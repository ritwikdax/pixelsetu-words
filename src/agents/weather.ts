import type { AgentDefinition } from './types'

export async function fetchWeather(city: string): Promise<string> {
  const encoded = encodeURIComponent(city.trim())
  const response = await fetch(`https://wttr.in/${encoded}?format=j1`)
  if (!response.ok) {
    throw new Error(`Weather lookup failed (${response.status})`)
  }

  const data = (await response.json()) as {
    nearest_area?: { areaName?: { value?: string }[] }[]
    current_condition?: {
      temp_C?: string
      weatherDesc?: { value?: string }[]
      humidity?: string
      windspeedKmph?: string
      FeelsLikeC?: string
    }[]
  }

  const area = data.nearest_area?.[0]?.areaName?.[0]?.value ?? city
  const current = data.current_condition?.[0]
  if (!current) {
    return `No current weather data found for ${area}.`
  }

  const description = current.weatherDesc?.[0]?.value ?? 'unknown'
  const temp = current.temp_C ?? '?'
  const feelsLike = current.FeelsLikeC ?? '?'
  const humidity = current.humidity ?? '?'
  const wind = current.windspeedKmph ?? '?'

  return [
    `Weather in ${area}:`,
    `- Condition: ${description}`,
    `- Temperature: ${temp}°C (feels like ${feelsLike}°C)`,
    `- Humidity: ${humidity}%`,
    `- Wind: ${wind} km/h`,
  ].join('\n')
}

export const weatherAgent: AgentDefinition = {
  id: 'weather',
  name: 'Weather',
  description: 'Get current weather for any city',
  systemPrompt:
    'You are a weather assistant. Use the getWeather tool to fetch live weather data. ' +
    'Extract the city from the user request and call the tool. Summarize results clearly.',
  tools: [
    {
      name: 'getWeather',
      description: 'Get current weather conditions for a city',
      parameters: {
        city: { type: 'string', description: 'City name', required: true },
      },
    },
  ],
  async executeTool(name, params) {
    if (name !== 'getWeather') {
      throw new Error(`Unknown tool: ${name}`)
    }
    const city = String(params.city ?? '').trim()
    if (!city) {
      throw new Error('city parameter is required')
    }
    return fetchWeather(city)
  },
}
