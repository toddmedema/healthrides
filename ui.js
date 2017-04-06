// TODOs
// integrate time of day into map analysis
// provide help info
  // esp legend for map
// host on PittsburghBikeWorks.com
// style / design review
  // add a nice font
  // Add loading spinners per-chart while re-calculating charts (on initial loads and filter changes)

// BONUS ideas
// add checkboxes for day of week
// Integrate weather data for exploration
  // second y axis on timeseries?
// Integrate moves data for exploration
// update circle popup text with new data on refreshes
// Change axis: per day of year vs per hour of week
// Allow for animated playthrough
  // Perhaps separate calculation from visual updating? Animation data is pre-calculable
  // Plus, could then cache previous calculations
// Ability to show / hide filters (esp for mobile)
// Resize sliders on window resize
// expand list of markers
  // only show markers for top (3? based on width?) data points in filter range
  // types of markers? sports game vs construction vs weather spikes
// ability to show / highlight weekends in time series
// combine all years' data, and let users filter / view all of it
// split out min / max / default values from filter object

const year = 2016;
const filters = {
  minDay: moment('2016-01-01'),
  maxDay: moment('2016-12-31'),
  startDay: moment('2016-01-01'),
  endDay: moment('2016-12-31'),
  startHour: 0,
  endHour: 23,
};
const daysArray = calculateDaysArray(filters.minDay, filters.maxDay);
const markers = {
  '2016-09-24 12:00:00': 'Pirates game',
};

let windowWidth = 0;
let windowHeight = 0;
let running = false;
let timer;
let mymap = null;


updateSizes();
createMap();
downloadData((err) => {
  if (err) {
    return alert('Error processing data: ' + err);
  }
  populateMap();
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

function createMap() {
  mymap = L.map('mapid').setView([40.4398, -79.975], 13);
  L.tileLayer('https://api.mapbox.com/styles/v1/dillar/cj12t54la000b2smrpodn0qhj/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZGlsbGFyIiwiYSI6ImNqMTJzbjEweTAwNGEyeG8yaDcycnA5YzQifQ.sTleMehx1aOGHOqS6rAMAg', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'your.mapbox.project.id',
    accessToken: 'your.mapbox.public.access.token',
  }).addTo(mymap);
}

function populateMap() {
  for (let i in data.stations) {
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
  const stations = calculateMapData(filters);
  for (let id in stations) {
    const station = stations[id];
    station.circle
      .setStyle({
        fillColor: station.color,
        color: station.color,
        fillOpacity: 0.8,
      })
      .setRadius(station.radius);
  }
}

function updateTimeseries() {
  const timeseries = calculateTimeseriesData(filters);
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
    filters.startDay = moment(year+'-01-01').add(value[0], 'days');
    filters.endDay = moment(year+'-01-01').add(value[1], 'days');
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