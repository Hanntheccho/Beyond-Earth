(function() {
    const card = document.querySelector('[data-climate-card]');
    if (!card) return;

    const fields = {
        date: card.querySelector('[data-climate-date]'),
        icon: card.querySelector('[data-climate-icon]'),
        temp: card.querySelector('[data-climate-temp]'),
        condition: card.querySelector('[data-climate-condition]'),
        feels: card.querySelector('[data-climate-feels]'),
        humidity: card.querySelector('[data-climate-humidity]'),
        wind: card.querySelector('[data-climate-wind]'),
        rain: card.querySelector('[data-climate-rain]'),
        updated: card.querySelector('[data-climate-updated]')
    };
    const apiUrl = 'https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=Europe%2FParis';

    function updateClock() {
        fields.date.textContent = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date()) + ' · PARIS LOCAL';
    }

    function conditionFor(code, isDay) {
        if (code === 0) return [isDay ? '☀' : '☾', 'Clear sky'];
        if (code === 1) return [isDay ? '🌤' : '☾', 'Mainly clear'];
        if (code === 2) return ['🌤', 'Partly cloudy'];
        if (code === 3) return ['☁', 'Overcast'];
        if ([45, 48].includes(code)) return ['≋', 'Fog'];
        if ([51, 53, 55, 56, 57].includes(code)) return ['☂', 'Drizzle'];
        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['☂', 'Rain'];
        if ([71, 73, 75, 77, 85, 86].includes(code)) return ['❄', 'Snow'];
        if ([95, 96, 99].includes(code)) return ['ϟ', 'Thunderstorm'];
        return ['◌', 'Conditions unavailable'];
    }

    async function refreshWeather() {
        try {
            const response = await fetch(apiUrl, { cache: 'no-store' });
            if (!response.ok) throw new Error('Weather service returned ' + response.status);
            const payload = await response.json();
            const current = payload.current;
            if (!current || typeof current.temperature_2m !== 'number') throw new Error('Weather data is incomplete');

            const condition = conditionFor(current.weather_code, current.is_day !== 0);
            fields.icon.textContent = condition[0];
            fields.temp.textContent = Math.round(current.temperature_2m) + '°';
            fields.condition.textContent = condition[1];
            fields.feels.textContent = Math.round(current.apparent_temperature) + '°C';
            fields.humidity.textContent = Math.round(current.relative_humidity_2m) + '%';
            fields.wind.textContent = Math.round(current.wind_speed_10m) + ' km/h';
            fields.rain.textContent = Number(current.precipitation).toFixed(1) + ' mm';
            fields.updated.textContent = 'Updated ' + new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false
            }).format(new Date(current.time)) + ' · 10 MIN REFRESH';
            card.classList.remove('is-stale', 'is-error');
        } catch (error) {
            card.classList.add('is-stale', 'is-error');
            fields.updated.textContent = 'Weather feed unavailable · retrying';
            if (fields.temp.textContent === '--°') fields.condition.textContent = 'Current weather unavailable';
        }
    }

    updateClock();
    refreshWeather();
    window.setInterval(updateClock, 60 * 1000);
    window.setInterval(refreshWeather, 10 * 60 * 1000);
})();
