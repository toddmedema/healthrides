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
      callback(err);
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

// PERF: use map
function processRentals(csv) {
  csv = d3.csvParse(csv);
  let data = [];
  for (let i = 0, l = csv.length; i < l; i++) {
    const ride = csv[i];
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
    // calculate net inflow/outflow per day
    // inflow + outflow not guaranteed to have a value for every day
    // PERF: iterate through all rides once, aggregating to [station][day]
    // rather than all rides for each station
    station.dailyOutflow = rides.reduce((days, ride) => {
      if (ride['From station id'] === station.id) {
        if (days[ride.startDateFormatted]) {
          days[ride.startDateFormatted] += 1;
        } else {
          days[ride.startDateFormatted] = 1;
        }
      }
      return days;
    }, {});
    station.dailyInflow = rides.reduce((days, ride) => {
      if (ride['To station id'] === station.id) {
        if (days[ride.startDateFormatted]) {
          days[ride.startDateFormatted] += 1;
        } else {
          days[ride.startDateFormatted] = 1;
        }
      }
      return days;
    }, {});
    station.dailyNet = daysArray.reduce((days, day) => {
      days[day] = (station.dailyInflow[day] || 0) - (station.dailyOutflow[day] || 0);
      return days;
    }, {});
    data[station.id] = station;
  }
  return data;
}


function calculateTimeseriesData(filters) {

  if (data.rides.length === 0) { return []; }

  // return from cache if pre-calculated
  const filterString = filtersToString(filters);
  if (cache[filterString] && cache[filterString].timeseries) {
    return cache[filterString].timeseries;
  }

  // PERF use reducer
  const ridesPerDay = {};
  let days = [];
  for (let i = 0, l = data.rides.length; i < l; i++) {
    const ride = data.rides[i];
    if (moment(ride.startDate).isBetween(filters.startDay, filters.endDay, 'day', '[]') &&
      ride.hour >= filters.startHour && ride.hour <= filters.endHour) {
      if (ridesPerDay[ride.startDateFormatted] == null) {
        days.push(ride.startDateFormatted);
        ridesPerDay[ride.startDateFormatted] = 0;
      }
      ridesPerDay[ride.startDateFormatted] += 1;
    }
  }

  days = days.sort();
  const timeseries = days.map((day) => {
    return {date: new Date(day + ' 12:00:00'), value: ridesPerDay[day]}
  });

  cache[filterString] = cache[filterString] || {};
  cache[filterString].timeseries = timeseries;
  return timeseries;
}

const CIRCLE_RADIUS_MAX = 200;
const CIRCLE_RADIUS_MIN = 50;
function calculateMapData(filters) {

  if (data.rides.length === 0 || Object.keys(data.stations).length === 0) { return []; }

  // return from cache if pre-calculated
  const filterString = filtersToString(filters);
  if (cache[filterString] && cache[filterString].map) {
    return cache[filterString].map;
  }

  const days = daysArray.filter((day) => {
    return (moment(day).isBetween(filters.startDay, filters.endDay));
  });
  let netAbsMax = 0;
  const stationNets = Object.keys(data.stations)
    .reduce((stationNets, id) => {
      const station = data.stations[id];
      stationNets[station.id] = days.reduce((sum, day) => {
        const net = (station.dailyNet[day] || 0);
        netAbsMax = Math.max(netAbsMax, Math.abs(net));
        return sum + net;
      }, 0)
      return stationNets;
    }, {});

  const stationAbs = Object.keys(data.stations)
    .reduce((stationAbs, id) => {
      const station = data.stations[id];
      stationAbs[station.id] = days.reduce((sum, day) => {
        return sum + (station.dailyInflow[day] || 0) + (station.dailyOutflow[day] || 0);
      }, 0)
      return stationAbs;
    }, {});
  const absArr = Object.values(stationAbs);
  const absMin = Math.min(...absArr);
  const absMax = Math.max(...absArr);

  const map = {};
  for (let id in data.stations) {
    const station = data.stations[id];
    // calculate net color: positive (blue) vs negative (red) vs grey when near 0
    const net = stationNets[id];
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
      radius: CIRCLE_RADIUS_MIN + (CIRCLE_RADIUS_MAX - CIRCLE_RADIUS_MIN) * (stationAbs[id] - absMin) / (absMax - absMin),
    };
  }

  cache[filterString] = cache[filterString] || {};
  cache[filterString].map = map;
  return map;
}

function filtersToString(filters) {
  return JSON.stringify(filters);
}
