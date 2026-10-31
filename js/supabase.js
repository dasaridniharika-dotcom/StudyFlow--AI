
const SUPABASE_URL = "https://hjnvvgncntnkrqdyjaoy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_J739ule1Y9LaERWg4LPtZw_bt33JK8f";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

window.supabaseClient = supabaseClient;
