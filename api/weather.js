const WEATHER_LAT = 37.638495;
const WEATHER_LON = 127.025287;

export default async function handler(req, res) {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "WEATHER_API_KEY가 설정되지 않았습니다." });
    return;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&appid=${apiKey}&units=metric`;
    const weatherRes = await fetch(url);
    if (!weatherRes.ok) throw new Error("weather request failed");
    const data = await weatherRes.json();

    res.status(200).json({ temp: Math.round(data.main.temp) });
  } catch (err) {
    res.status(502).json({ error: "날씨 정보를 불러올 수 없습니다." });
  }
}
