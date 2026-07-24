// Supabase anon(publishable) key — 공개 노출을 위해 설계된 키라 프론트엔드에 두어도 안전함
const SUPABASE_ANON_KEY = "sb_publishable_zHbnogYy1cf7Nksso92mgA_phtXZd3p";

// 정식 검색어 정책이 확정되기 전까지 사용하는 임시 키워드 (prd.md Open Questions 참고)
const TEMP_NEWS_KEYWORD = "NC다이노스";

function stripHtmlTags(str) {
  return (str || "")
    .replace(/<\/?b>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'");
}

function buildNewsItem(rawItem) {
  return {
    title: rawItem.title,
    description: rawItem.description,
    link: rawItem.originallink || rawItem.link,
    pubDate: rawItem.pubDate,
  };
}

const NEWS_FETCH_TIMEOUT_MS = 5000;

class NewsTimeoutError extends Error {
  constructor() {
    super("요청 시간이 초과되었습니다.");
    this.name = "NewsTimeoutError";
  }
}

async function fetchRecentNews(keyword, count = 5) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(SUPABASE_NEWS_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ keyword, count }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new NewsTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "뉴스를 불러올 수 없습니다.");
  }

  return data;
}

function buildNewsCard(item) {
  const card = document.createElement("li");
  card.className = "news-card";

  const title = document.createElement("h3");
  title.className = "news-card-title";
  title.textContent = stripHtmlTags(item.title);

  const description = document.createElement("p");
  description.className = "news-card-description";
  description.textContent = stripHtmlTags(item.description);

  const meta = document.createElement("div");
  meta.className = "news-card-meta";

  const pubDate = document.createElement("span");
  pubDate.className = "news-card-date";
  pubDate.textContent = item.pubDate;

  const link = document.createElement("a");
  link.className = "news-card-link";
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "원문보기";

  meta.appendChild(pubDate);
  meta.appendChild(link);

  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(meta);

  return card;
}

const NEWS_VISIBLE_COUNT = 2;

function renderNewsList(items) {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  listEl.style.maxHeight = "";

  if (!items || items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "news-empty-msg";
    empty.textContent = "표시할 뉴스가 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    listEl.appendChild(buildNewsCard(item));
  });

  applyNewsListVisibleHeight();
}

function applyNewsListVisibleHeight() {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  const cards = listEl.querySelectorAll(".news-card");
  if (cards.length <= NEWS_VISIBLE_COUNT) {
    listEl.style.maxHeight = "";
    return;
  }

  // 패널이 접혀 있으면(display:none) 카드 높이가 0으로 측정되므로 계산을 건너뜀 —
  // 패널을 펼칠 때 initNewsPanel에서 다시 호출해 정확한 높이로 재계산한다.
  if (listEl.offsetParent === null) return;

  const gap = parseFloat(getComputedStyle(listEl).rowGap) || 0;
  let visibleHeight = 0;
  for (let i = 0; i < NEWS_VISIBLE_COUNT; i++) {
    visibleHeight += cards[i].getBoundingClientRect().height;
    if (i < NEWS_VISIBLE_COUNT - 1) visibleHeight += gap;
  }
  listEl.style.maxHeight = `${visibleHeight}px`;
}

function renderNewsError(message) {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  listEl.style.maxHeight = "";

  const errorEl = document.createElement("li");
  errorEl.className = "news-error-msg";
  errorEl.textContent = message;
  listEl.appendChild(errorEl);
}

function renderNewsTimeout(refreshBtn) {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  listEl.style.maxHeight = "";

  const wrapperEl = document.createElement("li");
  wrapperEl.className = "news-error-msg";

  const messageEl = document.createElement("p");
  messageEl.textContent = "요청 시간이 초과되었습니다.";

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "news-retry-btn";
  retryBtn.textContent = "재시도";
  retryBtn.addEventListener("click", () => loadNews(refreshBtn));

  wrapperEl.appendChild(messageEl);
  wrapperEl.appendChild(retryBtn);
  listEl.appendChild(wrapperEl);
}

async function loadNews(refreshBtn) {
  const labelEl = document.getElementById("news-refresh-label");
  refreshBtn.disabled = true;
  if (labelEl) labelEl.textContent = "불러오는 중...";

  try {
    const data = await fetchRecentNews(TEMP_NEWS_KEYWORD);
    const items = (data.items || []).map(buildNewsItem);
    renderNewsList(items);
  } catch (err) {
    if (err instanceof NewsTimeoutError) {
      renderNewsTimeout(refreshBtn);
    } else {
      renderNewsError("뉴스를 불러올 수 없습니다.");
    }
  } finally {
    refreshBtn.disabled = false;
    if (labelEl) labelEl.textContent = "새로고침";
  }
}

const ALARM_NEWS_COUNT = 3;
const BRIEFING_ORDINALS = ["첫번째", "두번째", "세번째", "네번째", "다섯번째"];

function buildBriefingText(items) {
  return items
    .map((item, i) => {
      const ordinal = BRIEFING_ORDINALS[i] || `${i + 1}번째`;
      return `${ordinal} 뉴스, ${stripHtmlTags(item.title)}.`;
    })
    .join(" ");
}

function renderNewsBriefing(items) {
  const briefingEl = document.getElementById("news-briefing");
  if (!briefingEl) return;

  briefingEl.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "news-briefing-card";
    card.textContent = stripHtmlTags(item.title);
    briefingEl.appendChild(card);
  });
}

function speakBriefing(text) {
  // Web Speech API 미지원 브라우저에서는 음성 재생만 건너뛰고 텍스트 카드는 그대로 유지한다
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  speechSynthesis.speak(utterance);
}

function stopBriefing() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

function clearNewsBriefing() {
  const briefingEl = document.getElementById("news-briefing");
  if (briefingEl) briefingEl.innerHTML = "";
}

async function playNewsBriefing() {
  try {
    const data = await fetchRecentNews(TEMP_NEWS_KEYWORD, ALARM_NEWS_COUNT);
    const items = (data.items || []).map(buildNewsItem);
    if (items.length === 0) {
      clearNewsBriefing();
      return;
    }

    renderNewsBriefing(items);
    speakBriefing(buildBriefingText(items));
  } catch (err) {
    // 뉴스 API 호출 실패 시 브리핑만 생략하고, 알람음(script.js)은 이 함수와 무관하게 계속 울린다(CLAUDE.md NFR-3)
    clearNewsBriefing();
  }
}

function initNewsPanel() {
  const toggleBtn = document.getElementById("news-toggle-btn");
  const toggleLabelEl = document.getElementById("news-toggle-label");
  const panelEl = document.getElementById("news-panel");
  const arrowEl = document.getElementById("news-toggle-arrow");
  const refreshBtn = document.getElementById("news-refresh-btn");
  if (!toggleBtn || !panelEl || !refreshBtn) return;

  if (toggleLabelEl) toggleLabelEl.textContent = `${TEMP_NEWS_KEYWORD} 뉴스`;

  toggleBtn.addEventListener("click", () => {
    const isHidden = panelEl.classList.contains("hidden");
    panelEl.classList.toggle("hidden", !isHidden);
    arrowEl?.classList.toggle("open", isHidden);
    if (isHidden) applyNewsListVisibleHeight();
  });

  refreshBtn.addEventListener("click", () => loadNews(refreshBtn));
  loadNews(refreshBtn);
}

initNewsPanel();
