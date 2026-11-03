import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': Deno.env.get('NOVA_SITE_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ authorized: false }, { status: 405, headers });
  let body: { action?: string };
  try { body = await request.json(); } catch { return Response.json({ authorized: false }, { status: 400, headers }); }
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminEmail = (Deno.env.get('NOVA_ADMIN_EMAIL') || '').trim().toLowerCase();
  if (body.action !== 'status' || !url || !secret || !adminEmail) {
    return Response.json({ authorized: false, message: 'Nova-Admin ist noch nicht eingerichtet.' }, { status: 503, headers });
  }
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || data.user?.email?.toLowerCase() !== adminEmail) {
    return Response.json({ authorized: false, message: 'Kein Admin-Zugriff.' }, { status: 403, headers });
  }
  return Response.json({ authorized: true }, { status: 200, headers });
});
