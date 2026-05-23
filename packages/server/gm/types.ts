import type { Database } from '@db-types'

export type CharacterRow = Database['public']['Tables']['characters']['Row']
export type CharacterContext = Partial<CharacterRow>

export interface ConversationTurn {
  role: 'player' | 'assistant'
  content: string
}

export interface GMMessageInput {
  message: string
  conversationHistory?: ConversationTurn[]
  characterContext?: CharacterContext
  onToolCall?: (name: string, input: Record<string, unknown>, result: ToolResult) => void
}

export type ToolResult = Record<string, unknown> & { error?: string }
