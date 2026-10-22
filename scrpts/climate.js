(function() {
    const card = document.querySelector('.climate-card');
    if (!card) return;

    const fields = {
        date: card.querySelector('[data-climate-date]'),
        temp: card.querySelector('[data-climate-temp]'),
        condition: card.querySelector('[data-climate-condition]'),
        pressure: card.querySelector('[data-climate-pressure]'),
        radiation: card.querySelector('[data-climate-radiation]'),
        particulates: card.querySelector('[data-climate-particulates]'),
        wind: card.querySelector('[data-climate-wind]')
    };
    const timeZone = 'Europe/Berlin';
    const windDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    function updateScenarioReadout() {
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
            hourCycle: 'h23', timeZoneName: 'short'
        }).formatToParts(now).reduce(function(result, part) {
            result[part.type] = part.value;
            return result;
        }, {});
        const month = Number(new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).format(now));
        const day = Number(parts.day);
        const hour = Number(parts.hour);
        const minute = Number(parts.minute);
        const second = Number(parts.second);
        const scenarioDate = new Date(Date.UTC(2200, month - 1, day));
        const dayOfYear = Math.floor((scenarioDate - Date.UTC(2200, 0, 1)) / 86400000) + 1;
        const seasonalPhase = 2 * Math.PI * (dayOfYear - 200) / 365;
        const dailyPhase = 2 * Math.PI * (hour + minute / 60 + second / 3600 - 14) / 24;

        // Fictional local Müninstek readings follow Munich's real date and time,
        // while the displayed scenario year stays fixed at 2200.
        const surfaceTemp = -1.2 + 8.4 * Math.cos(seasonalPhase) + 2.3 * Math.cos(dailyPhase);
        const pressure = 990 + 5 * Math.sin(seasonalPhase + 0.8) + 2 * Math.cos(dailyPhase - 0.5);
        const radiation = 0.18 + 0.08 * (0.5 + 0.5 * Math.sin(seasonalPhase * 1.7 + dailyPhase * 0.3));
        const particulates = 68 + 74 * (0.5 + 0.5 * Math.sin(seasonalPhase * 1.3 + dailyPhase * 0.7));
        const windSpeed = 10 + 14 * (0.5 + 0.5 * Math.sin(seasonalPhase + dailyPhase * 0.6));
        const direction = windDirections[Math.floor((hour + dayOfYear / 7) / 3) % windDirections.length];

        fields.date.textContent = parts.day + ' ' + parts.month.toUpperCase() + ' 2200 · ' +
            parts.hour + ':' + parts.minute + ':' + parts.second;
        fields.temp.textContent = (surfaceTemp < 0 ? '−' : '+') + Math.abs(surfaceTemp).toFixed(1) + '°';
        fields.condition.textContent = surfaceTemp < -8
            ? 'Deep cold · Ash haze'
            : surfaceTemp < -2
                ? 'Sub-zero · Unstable air'
                : surfaceTemp > 5
                    ? 'Warm season · Particulate haze'
                    : 'Cold temperate · Ash haze';
        fields.pressure.textContent = Math.round(pressure) + ' hPa';
        fields.radiation.textContent = radiation.toFixed(2) + ' µSv/h';
        fields.particulates.textContent = Math.round(particulates) + ' µg/m³';
        fields.wind.textContent = direction + ' ' + Math.round(windSpeed) + ' km/h';
    }

    updateScenarioReadout();
    window.setInterval(updateScenarioReadout, 1000);
})();
