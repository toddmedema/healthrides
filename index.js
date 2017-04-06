const year = 2016; // TODO combine all years' data, and let users filter / view all of it
const data = {
  moves: [], // [objects] rental data - interpolated moves
  rides: [], // [objects] rental data - reported bike rides
  stations: {}, // {id: {station}}
  weather: {},// {ts (hourly): {weather}}
};
const filters = {
  minTime: '2016-01-01',
  maxTime: '2017-01-01',
  startTime: '2016-01-01',
  endTime: '2017-01-01',
}
const colors = ["red", "blue", "yellow"];

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

function createStations() {
  for (let i in data.stations) {
  	randCol = Math.floor(Math.random() * 3);
    const station = data.stations[i];
    station.circle = L.circle([station.Latitude, station.Longitude])
      .bindPopup(station.Name)
      .addTo(mymap);
  }
  updateStations();
}

function updateSizes() {
  windowWidth = $(window).width();
  windowHeight = $(window).height();
  $("#mapid")
    .width(windowWidth)
    .height(windowHeight * 2/3);
  updateTimeseries();
}

function updateStations() {
  for (let i in data.stations) {
  	randCol = Math.floor(Math.random() * 3);
    const station = data.stations[i];
    station.circle
      .setStyle({
        fillColor: colors[randCol],
        color: colors[randCol],
        fillOpacity: 0.1,
      })
      .setRadius(Math.random() * 50 + 50)
  }
}

function updateTimeseries() {
  const ridesPerDay = {};
  for (let i = 0, l = data.rides.length; i < l; i++) {
    const ride = data.rides[i];
    ridesPerDay[ride.startDate] = ridesPerDay[ride.startDate] || 0;
    ridesPerDay[ride.startDate] += 1;
  }
console.log(ridesPerDay);
  MG.data_graphic({
    title: "Downloads",
    description: "This graphic shows a time-series of downloads.",
    data: [{'date':new Date('2014-11-01'),'value':12},
           {'date':new Date('2014-11-02'),'value':18}],
    width: windowWidth,
    height: windowHeight/3,
    target: '#timeseries',
    x_accessor: 'date',
    y_accessor: 'value',
  });
}

// LISTENERS

$(window).resize(updateSizes);

$("button").on("click", function() {
	var duration = 1000,
		maxstep = 100,
		minstep = 1;
	if (running == true) {
		$("button").html("Play");
		running = false;
		clearInterval(timer);
	} else if (running == false) {
		$("button").html("Pause");
		sliderValue = $("#slider").val();
		timer = setInterval( function(){
			if (sliderValue < maxstep){
				sliderValue++;
				$("#slider").val(sliderValue);
				$('#range').html(sliderValue);
			}
			$("#slider").val(sliderValue);
			updateStations();
		}, duration);
		running = true;
	}
});

$("#slider").on("change", function(){
	updateStations();
	$("#range").html($("#slider").val());
	clearInterval(timer);
	$("button").html("Play");
});
