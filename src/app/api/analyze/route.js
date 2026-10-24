// Next.js App Router adapter. No API key or provider code is imported by the UI.
import { createAnalysisHandler, originsFromEnvironment } from '../../../lib/analysis/http.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const handle = createAnalysisHandler({ allowedOrigins: originsFromEnvironment() });

export async function POST(request) { return handle(request); }
export async function OPTIONS(request) { return handle(request); }
export async function GET(request) { return handle(request); }
export async function PUT(request) { return handle(request); }
export async function PATCH(request) { return handle(request); }
export async function DELETE(request) { return handle(request); }
export async function HEAD(request) { return handle(request); }
