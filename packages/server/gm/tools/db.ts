import { createClient } from '@supabase/supabase-js'
import type { Database } from '@db-types'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('Missing Supabase env vars: SUPABASE_URL and SUPABASE_SECRET_KEY are required')

const supabase = createClient<Database>(url, key)

export default supabase
