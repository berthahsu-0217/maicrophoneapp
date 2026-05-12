import { NextRequest, NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('recordings')
        .select('id, public_url, mime_type, duration_seconds, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching recordings:', error);
        return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
    }

    return NextResponse.json({ recordings: data });
}
