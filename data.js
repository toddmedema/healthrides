function downloadData(callback) {
  download('data/HealthyRideRentals' + year + '.csv', (err, rentals) => {
    if (!err) {
      data.rides = processRentals(rentals);
    }
    download('data/HealthyRideStations' + year + '.csv', (err, stations) => {
      if (!err) {
        data.stations = processStations(stations);
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
    ride.startRounded = moment(ride.Starttime).startOf('hour').toString();
    ride.startDate = moment(ride.Starttime).startOf('day').format('YYYY-MM-DD');
    ride.stopRounded = moment(ride.Stoptime).startOf('hour').toString();
    data.push(ride);
  }
  return data;
}

function processStations(csv) {
  csv = d3.csvParse(csv);
  let data = {};
  for (let i = 0, l = csv.length; i < l; i++) {
    const station = csv[i];
    station.id = station['Station #'];
    data[station.id] = station;
  }
  return data;
}
