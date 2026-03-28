import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchTokensFromStitch } from '@/lib/stitch';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await req.json() as { projectId: string };
    if (!projectId?.trim()) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const tokens = await fetchTokensFromStitch(projectId.trim());

    const { error } = await supabase
      .from('restaurants')
      .update({
        stitch_project_id: projectId.trim(),
        design_tokens: tokens,
      })
      .eq('owner_id', user.id);

    if (error) throw error;

    return NextResponse.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
