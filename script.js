const dateEl = document.getElementById("date");
const clockEl = document.getElementById("clock");
const weatherEl = document.getElementById("weather");
const form = document.getElementById("alarm-form");
const dateInput = document.getElementById("alarm-date");
const timeInput = document.getElementById("alarm-time");
const labelInput = document.getElementById("alarm-label");
const listEl = document.getElementById("alarm-list");
const overlay = document.getElementById("ringing-overlay");
const ringingLabel = document.getElementById("ringing-label");
const stopBtn = document.getElementById("stop-alarm");

const STORAGE_KEY = "alarms";
let alarms = loadAlarms();
let lastCheckedMinute = null;
let audioCtx = null;
let beepIntervalId = null;

function loadAlarms() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAlarms() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

function toDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateKey) {
  const [yyyy, mm, dd] = dateKey.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(yyyy, mm - 1, dd).getDay()
  ];
  return `${yyyy}년 ${mm}월 ${dd}일 (${weekday})`;
}

function renderAlarms() {
  listEl.innerHTML = "";

  if (alarms.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-msg";
    empty.textContent = "등록된 알람이 없습니다.";
    listEl.appendChild(empty);
    return;
  }

  const sorted = [...alarms].sort((a, b) => {
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  sorted.forEach((alarm) => {
    const li = document.createElement("li");
    li.className = "alarm-item" + (alarm.enabled ? "" : " disabled");

    const info = document.createElement("div");
    info.className = "alarm-info";

    const timeEl = document.createElement("span");
    timeEl.className = "alarm-time";
    timeEl.textContent = alarm.time;
    info.appendChild(timeEl);

    const dateLabelEl = document.createElement("span");
    dateLabelEl.className = "alarm-label";
    dateLabelEl.textContent = alarm.date
      ? formatDateLabel(alarm.date)
      : "매일 반복";
    info.appendChild(dateLabelEl);

    if (alarm.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "alarm-label";
      labelEl.textContent = alarm.label;
      info.appendChild(labelEl);
    }

    const actions = document.createElement("div");
    actions.className = "alarm-actions";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "toggle";
    toggle.checked = alarm.enabled;
    toggle.addEventListener("change", () => {
      alarm.enabled = toggle.checked;
      saveAlarms();
      renderAlarms();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      alarms = alarms.filter((a) => a.id !== alarm.id);
      saveAlarms();
      renderAlarms();
    });

    actions.appendChild(toggle);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!timeInput.value) return;

  const date = dateInput.value;

  if (date) {
    const [yyyy, mm, dd] = date.split("-").map(Number);
    const [hh, min] = timeInput.value.split(":").map(Number);
    const target = new Date(yyyy, mm - 1, dd, hh, min);
    if (target < new Date()) {
      alert("이미 지난 날짜/시간입니다.");
      return;
    }
  }

  alarms.push({
    id: Date.now().toString(),
    date,
    time: timeInput.value,
    label: labelInput.value.trim(),
    enabled: true,
    lastTriggeredMinute: null,
  });

  saveAlarms();
  renderAlarms();
  form.reset();
});

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}`;
  dateEl.textContent = formatDateLabel(toDateKey(now));

  const todayKey = toDateKey(now);
  const currentMinuteKey = `${todayKey}-${hh}:${mm}`;
  if (currentMinuteKey !== lastCheckedMinute) {
    lastCheckedMinute = currentMinuteKey;
    checkAlarms(hh, mm, todayKey);
  }
}

function checkAlarms(hh, mm, todayKey) {
  const currentTime = `${hh}:${mm}`;
  const minuteKey = `${todayKey}-${currentTime}`;
  let changed = false;

  alarms.forEach((alarm) => {
    if (!alarm.enabled) return;
    if (alarm.time !== currentTime) return;
    if (alarm.date && alarm.date !== todayKey) return;
    if (alarm.lastTriggeredMinute === minuteKey) return;

    alarm.lastTriggeredMinute = minuteKey;
    if (alarm.date) alarm.enabled = false;
    changed = true;
    triggerAlarm(alarm);
  });

  if (changed) {
    saveAlarms();
    renderAlarms();
  }
}

function triggerAlarm(alarm) {
  ringingLabel.textContent = alarm.label ? `⏰ ${alarm.label}` : "⏰ 알람!";
  overlay.classList.remove("hidden");
  startBeeping();
}

function startBeeping() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  const beepOnce = () => {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  };

  beepOnce();
  beepIntervalId = setInterval(beepOnce, 600);
}

function stopBeeping() {
  if (beepIntervalId) {
    clearInterval(beepIntervalId);
    beepIntervalId = null;
  }
}

stopBtn.addEventListener("click", () => {
  overlay.classList.add("hidden");
  stopBeeping();
});

const WEATHER_LAT = 37.638495;
const WEATHER_LON = 127.025287;

async function updateWeather() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&appid=${WEATHER_API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather request failed");
    const data = await res.json();
    const temp = Math.round(data.main.temp);
    weatherEl.textContent = `🌡️ ${temp}°C`;
  } catch {
    weatherEl.textContent = "날씨 정보를 불러올 수 없습니다.";
  }
}

renderAlarms();
updateClock();
setInterval(updateClock, 1000);
updateWeather();
setInterval(updateWeather, 10 * 60 * 1000);
