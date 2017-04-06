// TODOs
// add time of day filter slider
// add checkboxes for day of week
// stylize page + provide help info
// host on PittsburghBikeWorks.com

// BONUS ideas
// Integrate weather data for exploration
// Integrate moves data for exploration
// update circle popup text with new data on refreshes
// Change axis: per day of year vs per hour of week
// Allow for animated playthrough
  // Perhaps separate calculation from visual updating? Animation data is pre-calculable
  // Plus, could then cache previous calculations


const year = 2016; // TODO combine all years' data, and let users filter / view all of it
const data = {
  moves: [], // [objects] rental data - interpolated moves
  rides: [], // [objects] rental data - reported bike rides
  stations: {}, // {id: {station}}
  weather: {},// {ts (hourly): {weather}}
};
const filters = {
  minTime: moment('2016-01-01'),
  maxTime: moment('2017-01-01'),
  startTime: moment('2016-01-01'),
  endTime: moment('2017-01-01'),
};
const daysArray = calculateDaysArray(filters.minTime, filters.maxTime);
const markers = {
  '2016-09-24': 'Pirates game',
};
const CIRCLE_RADIUS_MAX = 200;
const CIRCLE_RADIUS_MIN = 50;

let windowWidth = 0;
let windowHeight = 0;
updateSizes();
let running = false;
let timer;

// INIT

const mymap = L.map('mapid').setView([40.4488, -79.979], 13);
L.tileLayer('https://api.mapbox.com/styles/v1/dillar/cj12t54la000b2smrpodn0qhj/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGlsbGFyIiwiYSI6ImNqMTJzbjEweTAwNGEyeG8yaDcycnA5YzQifQ.sTleMehx1aOGHOqS6rAMAg', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
  maxZoom: 18,
  id: 'your.mapbox.project.id',
  accessToken: 'your.mapbox.public.access.token',
}).addTo(mymap);

downloadData((err) => {
  if (err) {
    return alert('Error processing data: ' + err);
  }
  createStations();
  updateTimeseries();
});

// HELPERS

function calculateDaysArray(startMoment, endMoment) {
  let day = startMoment;
  let days = [];
  while (moment(day).isSameOrBefore(endMoment)) {
    days.push(day.format('YYYY-MM-DD'));
    day = day.add(1, 'day');
  }
  return days;
}

function createStations() {
  for (let i in data.stations) {
  	randCol = Math.floor(Math.random() * 3);
    const station = data.stations[i];
    station.circle = L.circle([station.Latitude, station.Longitude])
      .bindPopup(station.name)
      .addTo(mymap);
  }
  updateStations();
}

function updateSizes() {
  windowWidth = $(window).width();
  windowHeight = $(window).height() - $("#topbar").height();
  $("#mapid")
    .width(windowWidth)
    .height(windowHeight * 2/3);
  $("#timeseries")
    .width(windowWidth)
    .height(windowHeight * 1/3);
  updateTimeseries();
}

// http://leafletjs.com/reference-1.0.3.html
function updateStations() {
  const days = daysArray.filter((day) => {
      return (moment(day).isBetween(filters.startTime, filters.endTime));
    });
  const stationNets = Object.keys(data.stations)
    .reduce((stationNets, id) => {
      const station = data.stations[id];
      stationNets[station.id] = days.reduce((sum, day) => {
        return sum + (station.dailyNet[day] || 0);
      }, 0)
      return stationNets;
    }, {});
  const netArr = Object.values(stationNets);
  const netMin = Math.min(0, ...netArr);
  const netMax = Math.max(0, ...netArr);
  const netAbsMax = Math.max(Math.abs(netMin), Math.abs(netMax));

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
    const color = `rgb(${Math.round(Math.min(255, colorR))},${Math.round(Math.min(255, colorG))},${Math.round(Math.min(255, colorB))})`;
console.log(diff, color);
    station.circle
      .setStyle({
        fillColor: color,
        color: color,
        fillOpacity: 0.8,
      })
      .setRadius(CIRCLE_RADIUS_MIN + (CIRCLE_RADIUS_MAX - CIRCLE_RADIUS_MIN) * (stationAbs[id] - absMin) / (absMax - absMin));
  }
}

function updateTimeseries() {
  const ridesPerDay = {};
  let days = [];
  // TODO use reducer
  for (let i = 0, l = data.rides.length; i < l; i++) {
    const ride = data.rides[i];
    if (moment(ride.startDate).isBetween(filters.startTime, filters.endTime)) {
      if (ridesPerDay[ride.startDateFormatted] == null) {
        days.push(ride.startDateFormatted);
        ridesPerDay[ride.startDateFormatted] = 0;
      }
      ridesPerDay[ride.startDateFormatted] += 1;
    }
  }
  days = days.sort();
  const timeseries = days.map((day) => {
    return {date: new Date(day), value: ridesPerDay[day]}
  });
  // TODO expand list of markers, only show markers for top (3?) data points in filter range
  const markersFormatted = Object.keys(markers).map((date) => {
    return {date: new Date(date), label: markers[date]};
  });

  // https://github.com/mozilla/metrics-graphics/wiki/List-of-Options
  MG.data_graphic({
    title: 'Rides Per Day',
    data: timeseries,
    buffer: 0,
    width: windowWidth,
    height: windowHeight/3,
    target: '#timeseries',
    x_accessor: 'date',
    y_accessor: 'value',
    markers: markersFormatted,
  });
}

// LISTENERS

$(window).resize(updateSizes);

// http://nitinhayaran.github.io/jRange/demo/
$('.range-slider').jRange({
  from: 0,
  to: 365,
  step: 1,
  showScale: false,
  format: (value) => { return moment(year+'-01-01').add(value, 'days').format('MMM D'); },
  width: windowWidth - 40,
  isRange : true,
  ondragend: (value) => {
    value = value.split(',');
    filters.startTime = moment(year+'-01-01').add(value[0], 'days');
    filters.endTime = moment(year+'-01-01').add(value[1], 'days');
    updateTimeseries();
    updateStations();
  },
});





// $("button").on("click", function() {
// 	var duration = 1000,
// 		maxstep = 100,
// 		minstep = 1;
// 	if (running == true) {
// 		$("button").html("Play");
// 		running = false;
// 		clearInterval(timer);
// 	} else if (running == false) {
// 		$("button").html("Pause");
// 		sliderValue = $("#slider").val();
// 		timer = setInterval( function(){
// 			if (sliderValue < maxstep){
// 				sliderValue++;
// 				$("#slider").val(sliderValue);
// 				$('#range').html(sliderValue);
// 			}
// 			$("#slider").val(sliderValue);
// 			updateStations();
// 		}, duration);
// 		running = true;
// 	}
// });

// $("#slider").on("change", function(){
// 	updateStations();
// 	$("#range").html($("#slider").val());
// 	clearInterval(timer);
// 	$("button").html("Play");
// });
