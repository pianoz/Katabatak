import supabase from './tools/db.js'

export interface BudgetCheckResult {
  allowed: boolean
  currentUsage: number
  budgetCap: number | null
}

/**
 * Checks whether a user has exceeded their token budget.
 * Returns `allowed: true` when no cap is set (null = unlimited).
 */
export async function checkBudget(userId: string): Promise<BudgetCheckResult> {
  const [profileResult, usageResult] = await Promise.all([
    supabase.from('profiles').select('token_budget').eq('id', userId).single(),
    supabase
      .from('token_usage')
      .select('input_tokens, output_tokens')
      .eq('user_id', userId),
  ])

  const budgetCap = profileResult.data?.token_budget ?? null
  if (budgetCap === null) return { allowed: true, currentUsage: 0, budgetCap: null }

  const rows = usageResult.data ?? []
  const currentUsage = rows.reduce((sum, r) => sum + r.input_tokens + r.output_tokens, 0)

  return { allowed: currentUsage < budgetCap, currentUsage, budgetCap }
}
