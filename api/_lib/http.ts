export type ApiErrorCode = 'NO_KEYS' | 'BAD_REQUEST' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM';

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  NO_KEYS: '도서 검색 API 키가 설정되지 않았어요. (KAKAO_REST_API_KEY, ALADIN_TTB_KEY, NAVER_CLIENT_ID/SECRET 중 하나 이상 필요)',
  BAD_REQUEST: '검색어를 확인해주세요.',
  NOT_FOUND: '책 정보를 찾을 수 없어요.',
  RATE_LIMITED: '검색 요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
  UPSTREAM: '도서 검색 서비스에 일시적인 문제가 있어요.',
};

const STATUS: Record<ApiErrorCode, number> = {
  NO_KEYS: 503,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function json(body: unknown, { status = 200, maxAge = 0 }: { status?: number; maxAge?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge > 0 ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 24}` : 'no-store',
      ...CORS_HEADERS,
    },
  });
}

export function apiError(code: ApiErrorCode) {
  return json({ error: { code, message: ERROR_MESSAGES[code] } }, { status: STATUS[code] });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
