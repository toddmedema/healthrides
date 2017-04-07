const data = {
  // moves: [], // [objects] rental data - interpolated moves
  rides: [], // [objects] rental data - reported bike rides - time ordered
  stations: {}, // {id: {station}}
  weather: {}, // [{weather}] - time ordered
    // NOT guaranteed to have data for every hour
    // temp (F)
    // humidity (0-100%)
    // wind_sped_km
    // rain (boolean)
    // clouds (0-100%)
    // condition (string)
};

/*
cache = {
  [filterString]: {
    map: {[stationid]: {
      circle: obj,
      color: string,
      radius: number,
    }}
    timeseries: [{date: Date(), value: number}],
  }
}
*/
const cache = {};

function downloadData(callback) {
  download('data/HealthyRideRentals' + year + '.csv', (err, rides) => {
    if (!err) {
      data.rides = processRides(rides);
    } else {
      return callback(err);
    }
    download('data/HealthyRideStations' + year + '.csv', (err, stations) => {
      if (!err) {
        data.stations = processStations(data.rides, stations);
      } else {
        return callback(err);
      }
      download('data/PittsburghWeather' + year + '.csv', (err, weather) => {
        if (!err) {
          data.weather = processWeather(weather);
        }
        callback(err, data);
      });
    });
  });
}

function download(url, callback) {
  $.ajax({
    type: 'GET',
    url: url,
    dataType: 'text',
    success: (data) => {
      return callback(null, data);
    },
    error: (err) => {
      return callback(err);
    },
  });
}

function processRides(csv) {
  csv = d3.csvParse(csv);
  csv.forEach((ride) => {
    ride.from = ride['From station id'];
    ride.to = ride['To station id'];
    ride.startDate = moment(ride.Starttime).startOf('day');
    ride.startDateFormatted = ride.startDate.format('YYYY-MM-DD');
    ride.hour = Number(moment(ride.Starttime).format('H'));
    // ride.dayOfWeek = ...
    // ride.stopRounded = moment(ride.Stoptime).startOf('hour').toString();
  });
  return csv;
}

function processStations(rides, csv) {
  csv = d3.csvParse(csv);
  let data = {};
  csv.forEach((station) => {
    station.id = station['Station #'];
    station.name = station['Station Name'];
    data[station.id] = station;
  });
  return data;
}

function processWeather(csv) {
  csv = d3.csvParse(csv);
  csv.forEach((weather) => {
    weather.hour = Number(moment(weather.local_time).format('H'));
    weather.day = moment(weather.local_time).startOf('day');
    weather.dayFormatted = weather.day.format('YYYY-MM-DD');
  });
  return csv;
}


function calculateTimeseriesData(filters) {
  const start = Date.now();
  if (data.rides.length === 0 || data.weather.length === 0) { return []; }

  // return from cache if pre-calculated
  const filterString = filtersToString(filters);
  if (cache[filterString] && cache[filterString].timeseries) {
    return cache[filterString].timeseries;
  }

  // cleanup: use map / accumulator
  const ridesPerDay = {};
  data.rides.forEach((ride) => {
    if (ride.startDate.isBetween(filters.startDay, filters.endDay, 'day', '[]')
      && ride.hour >= filters.startHour && ride.hour <= filters.endHour) {
      if (ridesPerDay[ride.startDateFormatted] == null) {
        ridesPerDay[ride.startDateFormatted] = 1;
      } else {
        ridesPerDay[ride.startDateFormatted] += 1;
      }
    }
  });

  // cleanup: use map / accumulator
  const dailyTemp = {};
  data.weather.forEach((weather) => {
    if (weather.day.isBetween(filters.startDay, filters.endDay, 'day', '[]')
      && weather.hour >= filters.startHour && weather.hour <= filters.endHour) {
      if (dailyTemp[weather.dayFormatted] == null) {
        dailyTemp[weather.dayFormatted] = [weather.temp];
      } else {
        dailyTemp[weather.dayFormatted].push(weather.temp);
      }
    }
  });

  const timeseriesData = Object.keys(ridesPerDay).sort().map((day) => {
    return {
      date: new Date(day + ' 12:00:00'),
      rides: ridesPerDay[day],
      tempMax: dailyTemp[day] ? Math.max(...dailyTemp[day]) : null,
      tempMin: dailyTemp[day] ? Math.min(...dailyTemp[day]) : null,
    };
  });

  console.log('Timeseries: ' + (Date.now() - start));
  cache[filterString] = cache[filterString] || {};
  cache[filterString].timeseries = timeseriesData;
  return timeseriesData;
}


function calculateMapData(filters) {
  const start = Date.now();
  if (data.rides.length === 0 || Object.keys(data.stations).length === 0) { return []; }

  // return from cache if pre-calculated
  const filterString = filtersToString(filters);
  if (cache[filterString] && cache[filterString].map) {
    return cache[filterString].map;
  }

  const CIRCLE_RADIUS_MIN = 40;
  const CIRCLE_RADIUS_MAX = 200;

  const stationsNet = {};
  const stationsAbs = {};
  data.rides.forEach((ride) => {
    if (ride.startDate.isBetween(filters.startDay, filters.endDay, 'day', '[]')
      && ride.hour >= filters.startHour && ride.hour <= filters.endHour) {
      stationsNet[ride.from] = (stationsNet[ride.from] || 0) - 1;
      stationsAbs[ride.from] = (stationsAbs[ride.from] || 0) + 1;
      stationsNet[ride.to] = (stationsNet[ride.to] || 0) + 1;
      stationsAbs[ride.to] = (stationsAbs[ride.to] || 0) + 1;
    }
  });

  const netArr = Object.values(stationsNet);
  const netAbsMax = Math.max(...netArr.map(Math.abs));
  const absArr = Object.values(stationsAbs);
  const absMin = Math.min(...absArr);
  const absMax = Math.max(...absArr);

  const mapData = {};
  for (let id in data.stations) {
    const station = data.stations[id];
    // calculate net color: positive (blue) vs negative (red) vs grey when near 0
    const net = stationsNet[id];
    const diff = 200 * Math.abs(net) / netAbsMax; // against abs max to highlight relative sizes better
    let colorR = 200;
    let colorG = 200;
    let colorB = 200;
    if (net > 0) { // positive: increase B, decrease RG
      colorB += diff;
      colorR -= diff;
      colorG -= diff;
    } else { // negative: increase R, decreate GB
      colorR += diff;
      colorG -= diff;
      colorB -= diff;
    }
    mapData[id] = {
      abs: stationsAbs[id],
      circle: station.circle,
      color: `rgb(${Math.round(Math.min(255, colorR))},${Math.round(Math.min(255, colorG))},${Math.round(Math.min(255, colorB))})`,
      net: net,
      radius: CIRCLE_RADIUS_MIN + (CIRCLE_RADIUS_MAX - CIRCLE_RADIUS_MIN) * (stationsAbs[id] - absMin) / (absMax - absMin),
    };
  }

  console.log('Map: ' + (Date.now() - start));
  cache[filterString] = cache[filterString] || {};
  cache[filterString].map = mapData;
  return {stations: data.stations, data: mapData};
}

function filtersToString(filters) {
  return JSON.stringify(filters);
}
