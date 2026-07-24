const NAVER_NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";
const DISPLAY_COUNT = 5;
const SORT_ORDER = "date";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "요청 본문이 올바른 JSON이 아닙니다." }, 400);
  }

  const keyword = body?.keyword;
  if (!keyword || typeof keyword !== "string") {
    return jsonResponse({ error: "keyword가 필요합니다." }, 400);
  }

  const clientId = Deno.env.get("NAVER_CLIENT_ID");
  const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return jsonResponse({ error: "NAVER_CLIENT_ID/NAVER_CLIENT_SECRET이 설정되지 않았습니다." }, 500);
  }

  const url = new URL(NAVER_NEWS_ENDPOINT);
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", String(DISPLAY_COUNT));
  url.searchParams.set("sort", SORT_ORDER);

  try {
    const naverRes = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    const data = await naverRes.json();

    if (!naverRes.ok) {
      return jsonResponse({ error: "네이버 API 호출에 실패했습니다.", detail: data }, 500);
    }

    return jsonResponse(data, 200);
  } catch {
    return jsonResponse({ error: "네이버 API 호출에 실패했습니다." }, 500);
  }
});
