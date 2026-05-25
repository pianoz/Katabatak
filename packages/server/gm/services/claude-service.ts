import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string
}

export interface EvalRequest {
  /** Single-turn shorthand — wraps as a single user message */
  prompt?: string
  /** Multi-turn conversation array */
  messages?: MessageParam[]
  system?: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface EvalResult {
  text: string
  usage: { input_tokens: number; output_tokens: number }
}

export async function runEval({ prompt, messages, system, model, maxTokens, temperature }: EvalRequest): Promise<EvalResult> {
  const resolvedMessages: Anthropic.Messages.MessageParam[] = messages?.length
    ? messages.map((m) => ({ role: m.role, content: m.content }))
    : [{ role: 'user', content: prompt ?? '' }]

  const response = await client.messages.create({
    model: model ?? 'claude-sonnet-4-6',
    max_tokens: maxTokens ?? 1024,
    ...(system ? { system } : {}),
    ...(temperature != null ? { temperature } : {}),
    messages: resolvedMessages,
  })
  const text = response.content.find((b) => b.type === 'text')?.text ?? ''
  return { text, usage: response.usage }
}
