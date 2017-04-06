// TODOs
// add time of day filter to station parsing
  // need to redo station net filtering, must be calculated on the fly....
    // Or, perhaps it only re-calculates if start/end filters aren't full day?
// stylize page + provide help info
// host on PittsburghBikeWorks.com

// BONUS ideas
// add checkboxes for day of week
// Integrate weather data for exploration
// Integrate moves data for exploration
// update circle popup text with new data on refreshes
// Change axis: per day of year vs per hour of week
// Allow for animated playthrough
  // Perhaps separate calculation from visual updating? Animation data is pre-calculable
  // Plus, could then cache previous calculations
// Ability to show / hide filters (esp for mobile)
// Resize sliders on window resize
// Loading indicator while waiting for initial data
// expand list of markers
  // only show markers for top (3? based on width?) data points in filter range
  // types of markers? sports game vs construction vs weather spikes
// ability to show / highlight weekends in time series

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
  startHour: 0,
  endHour: 23,
};
const daysArray = calculateDaysArray(filters.minTime, filters.maxTime);
const markers = {
  '2016-09-24 12:00:00': 'Pirates game',
};
const CIRCLE_RADIUS_MAX = 200;
const CIRCLE_RADIUS_MIN = 50;

let windowWidth = 0;
let windowHeight = 0;
updateSizes();
let running = false;
let timer;

// INIT

const mymap = L.map('mapid').setView([40.4398, -79.975], 13);
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
  updateViz();
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
}

function updateViz() {
  setTimeout(updateTimeseries, 1);
  setTimeout(updateStations, 1);
}

function updateSizes() {
  windowWidth = $(window).width();
  windowHeight = $(window).height() - $("#topbar").height() - $("#midbar").height();
  $("#mapid")
    .width(windowWidth)
    .height(windowHeight * 2/3);
  $("#timeseries")
    .width(windowWidth)
    .height(windowHeight * 1/3);
  updateTimeseries(); // have to specifically re-draw
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
    if (moment(ride.startDate).isBetween(filters.startTime, filters.endTime) &&
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
    return {date: new Date(day), value: ridesPerDay[day]}
  });
  const markersFormatted = Object.keys(markers).map((date) => {
    return {date: new Date(date), label: markers[date]};
  });

  // https://github.com/mozilla/metrics-graphics/wiki/List-of-Options
  MG.data_graphic({
    data: timeseries,
    buffer: 0,
    top: 15,
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
$('#dateSlider').jRange({
  from: 0,
  to: 365,
  step: 1,
  showScale: false,
  format: (value) => { return moment(year+'-01-01').add(value, 'days').format('MMM D'); },
  width: windowWidth - 90,
  isRange : true,
  snap: true,
  ondragend: (value) => {
    value = value.split(',');
    filters.startTime = moment(year+'-01-01').add(value[0], 'days');
    filters.endTime = moment(year+'-01-01').add(value[1], 'days');
    updateViz();
  },
});

$('#todSlider').jRange({
  from: 0,
  to: 23,
  step: 1,
  showScale: false,
  format: (value) => { return moment('2000-01-01').add(value, 'hours').format('HH:mm'); },
  width: windowWidth - 90,
  isRange : true,
  snap: true,
  ondragend: (value) => {
    value = value.split(',');
    filters.startHour = Number(value[0]);
    filters.endHour = Number(value[1]);
    updateViz();
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
