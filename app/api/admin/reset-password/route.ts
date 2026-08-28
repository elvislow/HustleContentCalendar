import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = 'https://akbwzlkavuznkwreeerh.supabase.co';
const supabasePublishableKey = 'sb_publishable_bvcsfstTUqpjEgO28wNN-g_6nIVwDth';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!secretKey) return NextResponse.json({ error: 'Admin password reset is not configured on Vercel yet.' }, { status: 503 });

  let payload: { userId?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const userId = payload.userId?.trim() || '';
  const password = payload.password || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: 'Invalid team member.' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: 'Password must be between 8 and 72 characters.' }, { status: 400 });
  }

  const authClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const [{ data: adminMember }, { data: targetMember }] = await Promise.all([
    adminClient.from('members').select('role,status').eq('id', authData.user.id).maybeSingle(),
    adminClient.from('members').select('id,email,status').eq('id', userId).maybeSingle(),
  ]);

  if (!adminMember || adminMember.role !== 'admin' || adminMember.status !== 'active') {
    return NextResponse.json({ error: 'Only an active admin can reset passwords.' }, { status: 403 });
  }
  if (!targetMember || targetMember.status !== 'active') {
    return NextResponse.json({ error: 'This member account is not active.' }, { status: 404 });
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, email: targetMember.email });
}
