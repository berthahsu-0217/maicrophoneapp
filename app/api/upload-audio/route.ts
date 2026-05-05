import { NextRequest, NextResponse } from 'next/server';

import { AUDIO_BUCKET, supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!sessionId) {
        return NextResponse.json({ error: 'No sessionId provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? 'webm';
    const storagePath = `${sessionId}/${crypto.randomUUID()}.${ext}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(AUDIO_BUCKET)
        .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Insert DB row
    const { error: dbError } = await supabase.from('recordings').insert({
        session_id: sessionId,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
    });

    if (dbError) {
        console.error('Supabase DB insert error:', dbError);
        // File was uploaded but DB insert failed — not fatal for the user flow
    }

    return NextResponse.json({
        url: publicUrl,
        storagePath,
    });
}
