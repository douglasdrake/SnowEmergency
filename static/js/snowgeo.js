// Douglas Drake - Cohort 3 - Homework 17

// API_KEY = window.prompt("Enter your mapbox API Key", "");

// var mplsCommunities = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json";
var communitiesUrl = "https://opendata.arcgis.com/datasets/e0a3b6a4c23b4a03b988388553cb9638_0.geojson";
// RedYellowGreen color scale generated on ColorBrewer
// http://colorbrewer2.org/#type=diverging&scheme=RdYlGn&n=
// ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850']
// ['#edf8fb','#bfd3e6','#9ebcda','#8c96c6','#8856a7','#810f7c']
// '#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b']
function getColor(d) {
  
  let color = '';
  if (d < 1) {
    color ='#9ebcda';
  } else if (d < 2) {
    color = '#8c96c6';
  } else if (d < 4) {
    color = '#8c6bb1';
  } else if (d < 6) {
    color = '#88419d';
  } else if (d < 8) {
    color = '#810f7c';
  } else { 
    color = '#4d004b';
  }
  return color
}

var mySnowMap = null;

function buildSnowMap(snowEmerg) {
    // console.log("Build new chart");
  
    if (mySnowMap && mySnowMap.remove) {
      mySnowMap.off();
      mySnowMap.remove();
      // console.log("removed mySnowMap");
    }
    
    let snowurl = `/snowgeojson/${snowEmerg}`;
    let towurl = `/towing/${snowEmerg}`;


    d3.json(towurl).then(function(towingData){

        d3.json(snowurl).then(function(snowfallData) {

            d3.json(communitiesUrl).then(function(communityData) {
                // console.log(communityData);
                createFeatures(snowfallData, communityData.features, towingData);
            })
    
            // console.log(snowfallData);
        });
        // console.log(towingData);
        
    });
}

function createSnowfallLayer(snowfallData) {
  // Create a GeoJSON layer containing the features array on the snowfall
  // Run the poinToLayer function once for each piece of data in the array

  var options = {
    bbox: [-96, 43, -91, 47]
  };

  // voronoiPolygons will be in a geoJSON format
  let voronoiPolygons = turf.voronoi(snowfallData, options);
  
  // add the snowfall, station name properties back to the voronoiPolygons
  voronoiPolygons.features.forEach((element, i) => {
      var pt = turf.point(snowfallData.features[i].geometry.coordinates);
      var poly = turf.polygon(element.geometry.coordinates)
      console.log(element + ", " + turf.booleanPointInPolygon(pt, poly));

      element.properties = snowfallData.features[i].properties;                
  });

    console.log(voronoiPolygons);

    // create the geoJSON layer with snowfall amounts
    var snowfall = new L.GeoJSON(voronoiPolygons, {

      style: function(feature) {
        return {color: getColor(feature.properties.snowtotal), opacity: 1, fillOpacity: .7};
      } // end style
      });

  
  return snowfall;
}

function createTowingLayer(towingData) {

    var tows = L.markerClusterGroup();
  
    for (let i = 0; i < towingData.latitude.length; i++) {
      tows.addLayer(L.marker([towingData.latitude[i], towingData.longitude[i]]));
    }
    
    // console.log("Tows" + tows);
    return tows;
}

function createFeatures(snowfallData, communityData, towingData) {
    
  var communities = L.geoJSON(communityData, {
        style: function(feature) {
        return {color: '#000', weight: 1, fillOpacity: 0.01};
     }
  });

  var snowfall = createSnowfallLayer(snowfallData);

  var tows = createTowingLayer(towingData);

  // Sending our layers to createMap
  createMap(snowfall, communities, tows); 
}

function createMap(snowfall, communities, tows) {

  

  // Define streetmap and darkmap layers
  var satelliteMap = L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}", {
    attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/\">OpenStreetMap</a> contributors, <a href=\"https://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>, Imagery © <a href=\"https://www.mapbox.com/\">Mapbox</a>",
    maxZoom: 18,
    id: "mapbox.satellite",
    accessToken: API_KEY
  });

  var grayscaleMap = L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}", {
    attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/\">OpenStreetMap</a> contributors, <a href=\"https://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>, Imagery © <a href=\"https://www.mapbox.com/\">Mapbox</a>",
    maxZoom: 18,
    id: "mapbox.light",
    accessToken: API_KEY
  });

  var outdoorsMap = L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}", {
    attribution: "Map data &copy; <a href=\"https://www.openstreetmap.org/\">OpenStreetMap</a> contributors, <a href=\"https://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>, Imagery © <a href=\"https://www.mapbox.com/\">Mapbox</a>",
    maxZoom: 18,
    id: "mapbox.outdoors",
    accessToken: API_KEY
  });

  // Define a baseMaps object to hold our base layers
  var baseMaps = {
    "Satellite": satelliteMap,
    "Gray Scale": grayscaleMap,
    "Outdoors": outdoorsMap
  };

  // Create overlay object to hold our overlay layer
  var overlayMaps = {
    'Snowfall': snowfall,
    'Communities': communities,
    'Tows': tows
  };

  // Create our map, giving it the satellite and snowfall layers to display on load
  mySnowMap = L.map("snowfallmap", {
    center: [
      44.99, -93.26
    ],
    zoom: 12,
    layers: [grayscaleMap, snowfall, communities, tows]
  });

  var legend = L.control({position: 'bottomright'});

  legend.onAdd = function (map) {

    var div = L.DomUtil.create('div', 'info legend');
    var snowfalls = [0, 1, 2, 4, 6, 8];
    var labels = ['0-1', '1-2', '2-4', '4-6', '6-8', '8+'];

    // loop through our magnitude intervals and generate a label with a colored square for each interval
    for (var i = 0; i < snowfalls.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getColor(snowfalls[i]) + '"></i> ' + labels[i] + '<br>';
    }
    return div;
  };  // end legend.onAdd

  legend.addTo(mySnowMap);
 
  // The following
  // https://gis.stackexchange.com/questions/68941/how-to-add-remove-legend-with-leaflet-layers-control
  // Add an event listener that adds/removes the legends if the earthquakes layer is added/removed.

  mySnowMap.on('overlayremove', function(eventLayer) {
    if (eventLayer.name === 'Snowfall') {
      this.removeControl(legend);
    }
  });

  mySnowMap.on('overlayadd', function (eventLayer) {
    // Turn on the legend...
    if (eventLayer.name === 'Snowfall') {
        legend.addTo(this);
    } 
  });

  // Create a layer control
  // Pass in our baseMaps and overlayMaps
  // Add the layer control to the map
  L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
  }).addTo(mySnowMap);

  console.log("Last line of createMap");


  return mySnowMap;
}

function buildSummaryData() {
  var url = `/snowfall_summary`;

  d3.json(url).then((response) => {
    console.log(response);
  });
}

/* Initialize the map */
function initSnowMap() {

  // console.log("In init()...");

  // Grab a reference to the dropdown select element
  var selector = d3.select("#selSnowDataset");

  // Use the list of sample names to populate the select options
  d3.json("/names").then((snowEmergencies) => {
    console.log(snowEmergencies.name);
    snowEmergencies.name.forEach((emergency) => {
      selector
        .append("option")
        .text(emergency)
        .property("value", emergency);
    });

    // Use the first sample from the list to build the initial plots
    const firstEmergency = snowEmergencies.name[0];
    buildSnowMap(firstEmergency);
    buildSummaryData();
    // buildNarrative(firstEmergency);
  });
}

function optionChangedSnowMap(newSample) {
  // Fetch new data each time a new sample is selected
  buildSnowMap(newSample);
  // buildSummaryData(newSample);
  // buildNarrative(firstEmergency);
}

// Initialize the dashboard
initSnowMap();