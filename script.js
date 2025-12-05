// Получаем элементы из DOM
const input = document.querySelector("#cityInput");
const btn = document.querySelector("#searchBtn");
const loader = document.querySelector("#loader");
const result = document.querySelector("#result");
const errorBox = document.querySelector("#error");

const elCity = document.querySelector("#cityName");
const elTemp = document.querySelector("#temperature");
const elText = document.querySelector("#weatherText");
const elEmoji = document.querySelector("#weatherEmoji");
const elWind = document.querySelector("#wind");
const elHum = document.querySelector("#humidity");
const elTZ = document.querySelector("#timezone");
const elUpd = document.querySelector("#updated");
const elForecast = document.querySelector("#forecast");

// Словарь: код погоды → текст и эмодзи
const WEATHER = {
  0: { text: "Ясно", emoji: "☀️" },
  1: { text: "Преимущественно ясно", emoji: "🌤️" },
  2: { text: "Переменная облачность", emoji: "⛅" },
  3: { text: "Пасмурно", emoji: "☁️" },

  45: { text: "Туман", emoji: "🌫️" },
  48: { text: "Изморозь", emoji: "🌫️" },

  51: { text: "Лёгкая морось", emoji: "🌦️" },
  53: { text: "Морось", emoji: "🌦️" },
  55: { text: "Сильная морось", emoji: "🌧️" },
  56: { text: "Переохлаждённая морось (лёгкая)", emoji: "🌧️❄️" },
  57: { text: "Переохлаждённая морось (сильная)", emoji: "🌧️❄️" },

  61: { text: "Лёгкий дождь", emoji: "🌦️" },
  63: { text: "Дождь", emoji: "🌧️" },
  65: { text: "Ливень", emoji: "🌧️" },

  66: { text: "Ледяной дождь (лёгкий)", emoji: "🌧️🧊" },
  67: { text: "Ледяной дождь (сильный)", emoji: "🌧️🧊" },

  71: { text: "Снег", emoji: "🌨️" },
  73: { text: "Снегопад", emoji: "❄️" },
  75: { text: "Сильный снег", emoji: "❄️" },

  77: { text: "Снежные зёрна", emoji: "🌨️" },

  80: { text: "Ливневый дождь", emoji: "🌧️" },
  81: { text: "Сильный ливень", emoji: "🌧️" },
  82: { text: "Очень сильный ливень", emoji: "🌧️" },

  85: { text: "Ливневый снег", emoji: "❄️" },
  86: { text: "Сильный ливневый снег", emoji: "❄️" },

  95: { text: "Гроза", emoji: "⛈️" },
  96: { text: "Гроза с лёгким градом", emoji: "🌩️" },
  99: { text: "Гроза с сильным градом", emoji: "🌩️" },
};



// фон погоды

// Фоны по коду погоды
const BACKGROUNDS = {
  clear: "linear-gradient(180deg, #4facfe, #00f2fe)",        // ясно
  cloudy: "linear-gradient(180deg, #bdc3c7, #2c3e50)",       // облачно
  rain: "linear-gradient(180deg, #667db6, #485563)",         // дождь
  thunder: "linear-gradient(180deg, #42275a, #734b6d)",      // гроза
  snow: "linear-gradient(180deg, #83a4d4, #b6fbff)",         // снег
  fog: "linear-gradient(180deg, #757f9a, #d7dde8)",          // туман
  default: "linear-gradient(180deg, #4facfe, #00f2fe)"       // по умолчанию
};


function applyBackground(weatherCode) {
  let bg = BACKGROUNDS.default;

  if ([0, 1].includes(weatherCode)) bg = BACKGROUNDS.clear;
  else if ([2, 3].includes(weatherCode)) bg = BACKGROUNDS.cloudy;
  else if ([51, 53, 55, 61, 63, 65, 80].includes(weatherCode)) bg = BACKGROUNDS.rain;
  else if ([95].includes(weatherCode)) bg = BACKGROUNDS.thunder;
  else if ([71, 73, 75].includes(weatherCode)) bg = BACKGROUNDS.snow;
  else if ([45, 48].includes(weatherCode)) bg = BACKGROUNDS.fog;

  document.body.style.background = bg;
}



// Событие: клик по кнопке
btn.addEventListener("click", () => {
  const city = input.value.trim();
  if (!city) {
    showError("Введите название города");
    return;
  }
  loadByCity(city);
});

// Событие: Enter в поле ввода
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btn.click();
});

// Главная функция: загрузить погоду по названию города
async function loadByCity(city) {
  try {
    toggleLoading(true);
    hideError();

    // 1) Геокодинг: город → координаты
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=ru&format=json`;

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error("Ошибка геокодинга");

    const geoData = await geoRes.json();
    const place = geoData?.results?.[0];

    if (!place) throw new Error("Город не найден");

    const { latitude, longitude, name, country, timezone } = place;

    // 2) Погода: текущая + прогноз
    const wUrl = `
    https://api.open-meteo.com/v1/forecast?
    latitude=${latitude}
    &longitude=${longitude}
    &current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
    &hourly=temperature_2m,weather_code
    &daily=weather_code,temperature_2m_max,temperature_2m_min
    &timezone=auto
    `.replace(/\s+/g, "");
    
    const wRes = await fetch(wUrl);
    if (!wRes.ok) throw new Error("Не удалось получить погоду");

    const wData = await wRes.json();

    renderCurrent({ name, country, timezone }, wData.current, wData.timezone);
    renderForecast(wData.daily);
    renderHourly(wData.hourly);

  } catch (err) {
    showError(err.message || "Что-то пошло не так");
  } finally {
    toggleLoading(false);
  }
}

// Отрисовка текущей погоды
function renderCurrent(place, current, tz) {
  const label = `${place.name}${place.country ? ", " + place.country : ""}`;
  const code = current?.weather_code;
  const wm = WEATHER[code] || { text: "Неизвестно", emoji: "❔" };

  elCity.textContent = label;
  elTemp.textContent =
    current?.temperature_2m != null
      ? Math.round(current.temperature_2m) + "°C"
      : "—";
  elText.textContent = wm.text;
  elEmoji.textContent = wm.emoji;
  elWind.textContent = current?.wind_speed_10m ?? "—";
  elHum.textContent = current?.relative_humidity_2m ?? "—";
  elTZ.textContent = tz ?? place?.timezone ?? "—";
  elUpd.textContent = new Date().toLocaleString();

  result.classList.remove("hidden");


  applyBackground(code);
  applyNightMode(current.time);

}

// Отрисовка прогноза на 5 дней
function renderForecast(daily) {
  elForecast.innerHTML = "";
  if (!daily?.time?.length) return;

  const daysCount = Math.min(daily.time.length, 5);

  for (let i = 0; i < daysCount; i++) {
    const date = daily.time[i];
    const code = daily.weather_code?.[i];
    const tmax = daily.temperature_2m_max?.[i];
    const tmin = daily.temperature_2m_min?.[i];
    const wm = WEATHER[code] || { text: "—", emoji: "❔" };

    const div = document.createElement("div");
    div.className = "card-day";
    div.innerHTML = `
      <div class="date">${new Date(date).toLocaleDateString()}</div>
      <div class="emoji">${wm.emoji}</div>
      <div class="text">${wm.text}</div>
      <div class="temps">${Math.round(tmin)}° / ${Math.round(tmax)}°</div>
    `;
    elForecast.appendChild(div);
  }
}

// Показ/скрытие загрузки
function toggleLoading(v) {
  loader.classList.toggle("hidden", !v);
  if (v) result.classList.add("hidden");
}

// Показ ошибки
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
  result.classList.remove("hidden");
}
 
// Скрыть ошибку
function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

// Авто-загрузка погоды для Bishkek при старте
loadByCity("Bishkek");

//функция текста дня и ночи
//let myElement = document.getElementById("nightOrDay");


function applyNightMode(localTimeString) {
  const hour = new Date(localTimeString).getHours();

  if (hour >= 20 || hour < 6) {
    document.body.classList.add("night");
   // myElement.textContent = "ночь";
  } else {
    document.body.classList.remove("night");
  }
}




const elHourly = document.querySelector("#hourly");

function renderHourly(hourly) {
  elHourly.innerHTML = "";

  if (!hourly?.time) return;

  // Покажем ближайшие 12 часов
  const limit = 24;

  for (let i = 0; i < limit; i++) {
    const time = hourly.time[i];
    const temp = hourly.temperature_2m[i];
    const code = hourly.weather_code[i];

    const wm = WEATHER[code] || { text: "", emoji: "❔" };

    const div = document.createElement("div");
    div.className = "hour-card";

    div.innerHTML = `
      <div class="time">${new Date(time).getHours()}:00</div>
      <div class="emoji">${wm.emoji}</div>
      <div class="temp">${Math.round(temp)}°</div>
    `;

    elHourly.appendChild(div);
  }
}
