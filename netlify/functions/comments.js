/**
 * Netlify Function: comments
 * 경로: /api/comments
 *
 * GET  /api/comments?photo_id=photo-01  → 해당 사진 댓글 목록 조회
 * POST /api/comments                    → 댓글 한 건 저장
 *
 * 환경 변수:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 */

const ALLOWED_PHOTO_IDS = ["photo-01", "photo-02", "photo-03"];
const MAX_NICKNAME = 20;
const MAX_MESSAGE = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function supabaseHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("환경 변수 누락");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "서버 설정 오류입니다." }),
    };
  }

  // ── GET: 댓글 목록 조회 ─────────────────────────────────────
  if (event.httpMethod === "GET") {
    const photoId = event.queryStringParameters?.photo_id;

    if (!photoId || !ALLOWED_PHOTO_IDS.includes(photoId)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "존재하지 않는 사진 번호입니다." }),
      };
    }

    const url =
      `${supabaseUrl}/rest/v1/comments` +
      `?select=nickname,message,created_at&photo_id=eq.${encodeURIComponent(photoId)}` +
      `&order=created_at.desc&limit=100`;

    const res = await fetch(url, { headers: supabaseHeaders(supabaseKey) });

    if (!res.ok) {
      console.error("댓글 조회 실패 (status):", res.status);
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "댓글 조회에 실패했습니다." }),
      };
    }

    const rows = await res.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ comments: rows }),
    };
  }

  // ── POST: 댓글 저장 ─────────────────────────────────────────
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

    const photo_id = body.photo_id;
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    // 사진 번호 검사
    if (!ALLOWED_PHOTO_IDS.includes(photo_id)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "존재하지 않는 사진 번호입니다." }),
      };
    }

    // 별명 검사
    if (!nickname) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "별명을 입력해 주세요." }),
      };
    }
    if (nickname.length > MAX_NICKNAME) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `별명은 ${MAX_NICKNAME}자 이하여야 합니다.` }),
      };
    }

    // 댓글 내용 검사
    if (!message) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "댓글 내용을 입력해 주세요." }),
      };
    }
    if (message.length > MAX_MESSAGE) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `댓글은 ${MAX_MESSAGE}자 이하여야 합니다.` }),
      };
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/comments`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(supabaseKey),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ photo_id, nickname, message }),
    });

    if (!res.ok) {
      console.error("댓글 저장 실패 (status):", res.status);
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "댓글 저장에 실패했습니다." }),
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
