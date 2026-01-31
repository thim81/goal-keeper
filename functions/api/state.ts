interface Env {
  GOALKEEPER_KV: KVNamespace;
  AUTH_TOKEN: string;
}

const STORAGE_KEY = 'goal-keeper-state';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-auth-token',
};

const getAuthToken = (request: Request) => {
  const header = request.headers.get('Authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return request.headers.get('x-auth-token') || '';
};

const isAuthorized = (request: Request, env: Env) => {
  const token = env.AUTH_TOKEN;
  if (!token) return false;
  return getAuthToken(request) === token;
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!isAuthorized(request, env)) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const stored = await env.GOALKEEPER_KV.get(STORAGE_KEY);
  if (!stored) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return new Response(stored, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!isAuthorized(request, env)) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  await env.GOALKEEPER_KV.put(STORAGE_KEY, JSON.stringify(body));

  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};
