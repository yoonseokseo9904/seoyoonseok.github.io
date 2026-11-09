/**
 * Netlify Function: react
 * 경로: /api/react
 *
 * POST /api/react  → 응원 저장
 * GET  /api/react  → 사진별 응원 횟수 조회
 *
 * 환경 변수 (Netlify 대시보드에서 설정):
 *   SUPABASE_URL       : https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY  : eyJ...
 */

const ALLOWED_PHOTO_IDS = ["photo-01", "photo-02", "photo-03"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "서버 환경 변수가 설정되지 않았습니다." }),
    };
  }

  // ── GET: 사진별 응원 횟수 조회 ──────────────────────────────
  if (event.httpMethod === "GET") {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/reactions?select=photo_id`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "조회에 실패했습니다." }),
      };
    }

    const rows = await res.json();

    // photo_id별 COUNT 집계
    const counts = {};
    for (const id of ALLOWED_PHOTO_IDS) counts[id] = 0;
    for (const row of rows) {
      if (counts[row.photo_id] !== undefined) counts[row.photo_id]++;
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ counts }),
    };
  }

  // ── POST: 응원 저장 ──────────────────────────────────────────
  if (event.httpMethod === "POST") {
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

    const { photo_id } = body;

    // 허용 목록 검사
    if (!ALLOWED_PHOTO_IDS.includes(photo_id)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "존재하지 않는 사진 번호입니다." }),
      };
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/reactions`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ photo_id }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Supabase INSERT 실패:", detail);
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

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: "허용되지 않는 요청 방식입니다." }),
  };
};
