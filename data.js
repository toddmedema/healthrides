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
