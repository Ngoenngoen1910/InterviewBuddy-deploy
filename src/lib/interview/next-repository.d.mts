import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRepository } from './next-service.mjs';
export function createNextRepository(supabase: SupabaseClient): NextRepository;
