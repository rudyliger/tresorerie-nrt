import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'rapports', params.slug);
    const content = readFileSync(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}