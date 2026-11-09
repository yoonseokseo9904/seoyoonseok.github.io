/**
 * Netlify Function: react
 * 경로: /api/react  (netlify.toml redirect 적용)
 *
 * GET  /api/react        → 사진별 응원 횟수 조회
 * POST /api/react        → 응원 한 건 저장
 *
 * 환경 변수 (Netlify 대시보드 → Site settings → Environment variables):
 *   SUPABASE_URL       : https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY  : sb_publishable_...
 *
 * 키 값은 절대 코드에 직접 쓰지 않는다.
 * 로그에도 키 값을 출력하지 않는다.
 */

const ALLOWED_PHOTO_IDS = ["photo-01", "photo-02", "photo-03"];
const ALLOWED_REACTION_TYPES = ["like", "dislike"];
const MAX_PHOTO_ID_LENGTH = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Supabase REST API 헤더 생성
function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  // ── CORS preflight ───────────────────────────────────────────
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // ── 환경 변수 존재 확인 (키 값은 로그에 출력하지 않음) ────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("환경 변수 누락: SUPABASE_URL 또는 SUPABASE_ANON_KEY");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "서버 설정 오류입니다." }),
    };
  }

  // ── GET: 사진별 응원 횟수 조회 ──────────────────────────────
  if (event.httpMethod === "GET") {
    const url =
      `${supabaseUrl}/rest/v1/reactions` +
      `?select=photo_id,reaction_type&photo_id=in.(${ALLOWED_PHOTO_IDS.join(",")})` +
      `&limit=10000`;

    const res = await fetch(url, {
      headers: supabaseHeaders(supabaseKey),
    });

    if (!res.ok) {
      console.error("Supabase 조회 실패 (status):", res.status);
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "집계 조회에 실패했습니다." }),
      };
    }

    const rows = await res.json();

    // photo_id별 like/dislike COUNT 집계
    const counts = {};
    for (const id of ALLOWED_PHOTO_IDS) {
      counts[id] = { like: 0, dislike: 0 };
    }
    for (const row of rows) {
      if (counts[row.photo_id] && ALLOWED_REACTION_TYPES.includes(row.reaction_type)) {
        counts[row.photo_id][row.reaction_type]++;
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ counts }),
    };
  }

  // ── POST: 응원 저장 ──────────────────────────────────────────
  if (event.httpMethod === "POST") {
    // 1. 요청 본문 파싱
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }),
      };
    }

    const { photo_id, reaction_type } = body;

    // 2. 입력 검사 — 빈값
    if (!photo_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "photo_id가 없습니다." }),
      };
    }

    // 3. 입력 검사 — 타입
    if (typeof photo_id !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "photo_id는 문자열이어야 합니다." }),
      };
    }

    // 4. 입력 검사 — 너무 긴 값
    if (photo_id.length > MAX_PHOTO_ID_LENGTH) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "photo_id가 너무 깁니다." }),
      };
    }

    // 5. 입력 검사 — 허용 목록
    if (!ALLOWED_PHOTO_IDS.includes(photo_id)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "존재하지 않는 사진 번호입니다." }),
      };
    }

    // 6. reaction_type 검사
    if (!reaction_type || !ALLOWED_REACTION_TYPES.includes(reaction_type)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "reaction_type은 like 또는 dislike여야 합니다." }),
      };
    }

    // 7. Supabase INSERT
    const res = await fetch(`${supabaseUrl}/rest/v1/reactions`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(supabaseKey),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ photo_id, reaction_type }),
    });

    if (!res.ok) {
      console.error("Supabase INSERT 실패 (status):", res.status);
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "저장에 실패했습니다." }),
      };
    }

    return {
      statusCode: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  }

  // ── 허용되지 않는 메서드 ────────────────────────────────────
  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: "허용되지 않는 요청 방식입니다." }),
  };
};
