const data = {
  moves: [], // [objects] rental data - interpolated moves
  rides: [], // [objects] rental data - reported bike rides
  stations: {}, // {id: {station}}
  weather: {},// {ts (hourly): {weather}}
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
  download('data/HealthyRideRentals' + year + '.csv', (err, rentals) => {
    if (!err) {
      data.rides = processRentals(rentals);
    } else {
      return callback(err);
    }
    download('data/HealthyRideStations' + year + '.csv', (err, stations) => {
      if (!err) {
        data.stations = processStations(data.rides, stations);
      }
      callback(err, data);
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

// PERF: use map, create new ride object with fully defined schema
function processRentals(csv) {
  csv = d3.csvParse(csv);
  let data = [];
  for (let i = 0, l = csv.length; i < l; i++) {
    const ride = csv[i];
    ride.from = ride['From station id'];
    ride.to = ride['To station id'];
    ride.startDate = moment(ride.Starttime).startOf('day');
    ride.startDateFormatted = ride.startDate.format('YYYY-MM-DD');
    ride.hour = Number(moment(ride.Starttime).format('H'));
    // ride.dayOfWeek = ...
    // ride.stopRounded = moment(ride.Stoptime).startOf('hour').toString();
    data.push(ride);
  }
  return data;
}

// PERF: use map
function processStations(rides, csv) {
  csv = d3.csvParse(csv);
  let data = {};
  for (let i = 0, l = csv.length; i < l; i++) {
    const station = csv[i];
    station.id = station['Station #'];
    station.name = station['Station Name'];
    data[station.id] = station;
  }
  return data;
}


function calculateTimeseriesData(filters) {
  const start = Date.now();
  if (data.rides.length === 0) { return []; }

  // return from cache if pre-calculated
  const filterString = filtersToString(filters);
  if (cache[filterString] && cache[filterString].timeseries) {
    return cache[filterString].timeseries;
  }

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

  const timeseries = Object.keys(ridesPerDay).sort().map((day) => {
    return {date: new Date(day + ' 12:00:00'), value: ridesPerDay[day]}
  });

  console.log('Timeseries: ' + (Date.now() - start));
  cache[filterString] = cache[filterString] || {};
  cache[filterString].timeseries = timeseries;
  return timeseries;
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

  const map = {};
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
    map[id] = {
      circle: station.circle,
      color: `rgb(${Math.round(Math.min(255, colorR))},${Math.round(Math.min(255, colorG))},${Math.round(Math.min(255, colorB))})`,
      radius: CIRCLE_RADIUS_MIN + (CIRCLE_RADIUS_MAX - CIRCLE_RADIUS_MIN) * (stationsAbs[id] - absMin) / (absMax - absMin),
    };
  }

  console.log('Map: ' + (Date.now() - start));
  cache[filterString] = cache[filterString] || {};
  cache[filterString].map = map;
  return map;
}

function filtersToString(filters) {
  return JSON.stringify(filters);
}
