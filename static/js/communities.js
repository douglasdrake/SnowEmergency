// Douglas Drake - Cohort 3 - Homework 17

// API_KEY = window.prompt("Enter your mapbox API Key", "");

// var mplsCommunities = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json";
var communitiesUrl = "https://opendata.arcgis.com/datasets/e0a3b6a4c23b4a03b988388553cb9638_0.geojson";
// RedYellowGreen color scale generated on ColorBrewer
// http://colorbrewer2.org/#type=diverging&scheme=RdYlGn&n=
// ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850']
// ['#edf8fb','#bfd3e6','#9ebcda','#8c96c6','#8856a7','#810f7c']
// '#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b']
function getTowColor(d) {
  
    // [,,,,,,,,,,]
    // ['#a50026','#d73027','#f46d43','#fdae61','#fee08b','#ffffbf','#d9ef8b','#a6d96a','#66bd63','#1a9850','#006837']
  let color = '';
  if (d < 1) {
      color = '#006837';
  } else if (d < 2) {
    color ='#1a9850';
  } else if (d < 3) {
    color = '#66bd63';
  } else if (d < 4) {
    color = '#a6d96a';
  } else if (d < 6) {
    color = '#d9ef8b';
  } else if (d < 8)  {
    color = '#ffffbf';
  } else if (d < 11) {
    color = '#fee08b';
  } else if (d < 15) {
    color = '#fdae61';
  } else if (d < 21) {
    color = '#f46d43';
  } else if (d < 31) {
    color = '#d73027';
  } else {
      color = '#a50026';
  }

  return color
}

var myTowMap = null;

function buildTowMap(snowEmerg, what) {
    console.log("Build Tow Map");
  
    if (myTowMap && myTowMap.remove) {
      myTowMap.off();
      myTowMap.remove();
      // console.log("removed myTowMap");
    }
    
    let towurl = `/towing_choropleth/${snowEmerg}+${what}`;

    d3.json(towurl).then(function(towingGrid){
        d3.json(communitiesUrl).then(function(communityData) {
            // console.log(communityData);
            createTowFeatures(communityData.features, towingGrid, what);
        })
        // console.log(towingData);
    });
}

function createTowLayer(towingGrid) {

    var tows = new L.GeoJSON(towingGrid, {
        style: function(feature) {
            return {color: getTowColor(feature.properties.count), opacity: .1, fillOpacity: .5};
        }
    })
  
    // console.log("Tows" + tows);
    return tows;
}

function createTowFeatures(communityData, towingGrid, what) {
    function onEachComm(feature, layer) {
        layer.bindPopup(feature.properties.CommName);
    }

    var communities = L.geoJSON(communityData, {
        style: function(feature) {
        return {color: '#000', weight: 1, fillOpacity: 0.1};
        },
        onEachFeature: onEachComm
    });

  var tows = createTowLayer(towingGrid);

  // Sending our layers to createMap
  createTowMap(communities, tows, what); 
}

function createTowMap(communities, tows, what) {

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
  var overlayName = (what === 'tows') ? 'Tows' : 'Tickets';
  console.log("The overlay name is " + overlayName);

  if (what === 'tows') {
    var overlayMaps = {
      'Tows': tows,
      'Communities': communities
    };
  }
  else {
    var overlayMaps = {
      'Tickets': tows,
      'Communities': communities
    };
  }

  // Create our map, giving it the satellite and snowfall layers to display on load
  myTowMap = L.map("towmap", {
    center: [
      44.99, -93.26
    ],
    zoom: 12,
    layers: [grayscaleMap, tows, communities]
  });

  var legend = L.control({position: 'bottomright'});

/*
Here is where you define the cuts, labels specific to tows, etc
*/

  legend.onAdd = function (map) {

    var div = L.DomUtil.create('div', 'info legend');
    var towCuts = [0, 1, 2, 3, 4, 6, 8, 11, 15, 21, 31];
    var labels = ['0' , '1', '2', '3', '4-5', '6-7', '8-10', '11-14', '15-20', '21-30', '31+'];

    // loop through our magnitude intervals and generate a label with a colored square for each interval
    for (var i = 0; i < towCuts.length; i++) {
        div.innerHTML +=
            '<i style="background:' + getTowColor(towCuts[i]) + '"></i> ' + labels[i] + '<br>';
    }
    return div;
  };  // end legend.onAdd

  legend.addTo(myTowMap);
 
  // The following
  // https://gis.stackexchange.com/questions/68941/how-to-add-remove-legend-with-leaflet-layers-control
  // Add an event listener that adds/removes the legends if the earthquakes layer is added/removed.

  myTowMap.on('overlayremove', function(eventLayer) {
    if (eventLayer.name === 'Tows') {
      this.removeControl(legend);
    } else if (eventLayer.name === 'Tickets') {
      this.removeControl(legend);
    }
  });

  myTowMap.on('overlayadd', function (eventLayer) {
    // Turn on the legend...
    if (eventLayer.name === 'Tows') {
        legend.addTo(this);
    } else if (eventLayer.name === 'Tickets') {
        legend.addTo(this);
    } 
  });

  // Create a layer control
  // Pass in our baseMaps and overlayMaps
  // Add the layer control to the map
  L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
  }).addTo(myTowMap);

  console.log("Last line of createMap");


  return myTowMap;
}


function buildTowSummary(what) {
      
    let tows = `/towing_summary/${what}`;
      
    d3.json(tows).then(function(response){
        console.log("In buildTowSummary");
        console.log(response.community);
          
        // pick the table for the filtered results
        var hbody = d3.select("#tow-table-head");
        hbody.html("");

        var row = hbody.append("tr");
        var cell = row.append("td");
        cell.text("");

        response.emergency.forEach(datum => {
            console.log(datum);
            var cell = row.append("td");
            cell.text(datum);
        });

         var dbody = d3.select("#tow-table");
        dbody.html("");
            
        // write to the day table
        response.community.forEach((datum, i) => {
            console.log(datum);
            var row = dbody.append("tr");
            var cell = row.append("td");
            cell.text(datum);

            var cell = row.append("td");
            cell.text(response.armatage[i]);
            var cell = row.append("td");
            cell.text(response.dana[i]);
            var cell = row.append("td");
            cell.text(response.diamondlake[i]);
            var cell = row.append("td");
            cell.text(response.ferry[i]);
            var cell = row.append("td");
            cell.text(response.grant[i]);
            var cell = row.append("td");
            cell.text(response.howe[i]);
            var cell = row.append("td");
            cell.text(response.jane[i]);
            var cell = row.append("td");
            cell.text(response.olive[i]);
            var cell = row.append("td");
            cell.text(response.pembina[i]);
            var cell = row.append("td");
            cell.text(response.polk[i]);
            var cell = row.append("td");
            cell.text(response.quincy[i]);
            var cell = row.append("td");
            cell.text(response.upton[i]);
            var cell = row.append("td");
            cell.text(response.westminster[i]);
            var cell = row.append("td");
            cell.text(response.xerxes[i]);
            var cell = row.append("td");
            cell.text(response.yale[i]);
            var cell = row.append("td");
            cell.text(response.yardville[i]);
        });
    });
}

function buildStackedBar(what) {
    let stackedbar = `/stackedbar_tows/${what}`;

    console.log("In buildStackedBar");

    d3.json(stackedbar).then(function(response) {

        // now stacked bar

        var trace1 = {
            x: response.emergency,
            y: response.calhounisles,
            name: 'Calhoun-Isles',
            type: 'bar'
          };
          
          var trace2 = {
            x: response.emergency,
            y: response.camden,
            name: 'Camden',
            type: 'bar'
          };
          
          var trace3 = {
            x: response.emergency,
            y: response.central,
            name: 'Central',
            type: 'bar'
          };
          var trace4 = {
            x: response.emergency,
            y: response.longfellow,
            name: 'Longfellow',
            type: 'bar'
          };
          var trace5= {
            x: response.emergency,
            y: response.nearnorth,
            name: 'Near North',
            type: 'bar'
          };
          var trace6 = {
            x: response.emergency,
            y: response.nokomis,
            name: 'Nokomis',
            type: 'bar'
          };
          var trace7 = {
            x: response.emergency,
            y: response.northeast,
            name: 'Northeast',
            type: 'bar'
          };

          var trace8 = {
            x: response.emergency,
            y: response.phillips,
            name: 'Phillips',
            type: 'bar'
          };

          var trace9 = {
            x: response.emergency,
            y: response.powderhorn,
            name: 'Powderhorn',
            type: 'bar'
          };
          
          var trace10 = {
            x: response.emergency,
            y: response.southwest,
            name: 'Southwest',
            type: 'bar'
          };
          
          var trace11 = {
            x: response.emergency,
            y: response.university,
            name: 'University',
            type: 'bar'
          };
          
          var data = [trace11, trace10, trace9, trace8, trace7, trace6, trace5, trace4, trace3, trace2, trace1];
          
          var layout = {
            xaxis: {
                tickangle: -45
              },
              barmode: 'stack'};
          
          Plotly.newPlot('community-summary', data, layout);

    });
}


function buildBiPlot(what) {
    let biplot = `/biplot/${what}`;
    
    console.log("In buildBiPlot");

    if (what === 'tows') {
      var titleChange = 'Towing';
    } else {
      var titleChange = 'Ticketing';
    }

    d3.json(biplot).then(function(response){
        console.log(response);

        var trace1 = {
            x: response.R1,
            y: response.R2,
            mode: 'markers+text',
            type: 'scatter',
            name: 'Community',
            text: response.community,
            textposition: 'top center',
            textfont: {
              family:  'Raleway, sans-serif'
            },
            marker: { size: 12 }
          };
          
          var trace2 = {
            x: response.C1,
            y: response.C2,
            mode: 'markers+text',
            type: 'scatter',
            name: 'Emergency',
            text: response.emergency,
            textfont : {
              family:'Times New Roman'
            },
            textposition: 'bottom center',
            marker: { size: 12, symbol: 'diamond' }
          };
          
          var data = [ trace1, trace2 ];
          
          var layout = {
            yaxis: {
                scaleanchor: 'x'
            },
            legend: {
              y: 0.5,
              yref: 'paper',
              font: {
                family: 'Arial, sans-serif',
                size: 20,
                color: 'grey',
              }
            },
            title:'Bi-Plot of the Cross-Tabulated ' + titleChange + ' Data'
          };
          
          Plotly.newPlot('biplot', data, layout);
        
        });// end d3.json
}

/* Initialize the map */
function initTowMap() {

  console.log("In init()...");

  // Grab a reference to the dropdown select element
  var selector = d3.select("#selCommunityDataset");

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
    const firstWhat = d3.select("#selTowsDataset").property("value");
    if (firstWhat === "tows") {
      d3.select("#summaryName").text("Summary of Towings Across Communities and Emergencies");
    } else {
      d3.select("#summaryName").text("Summary of Tickets Across Communities and Emergencies");
    }
    buildTowMap(firstEmergency, firstWhat);
    buildTowSummary(firstWhat);
    buildStackedBar(firstWhat);
    buildBiPlot(firstWhat);

    // buildNarrative(firstEmergency);
  });
}

function optionChangedTowMap(emergency) {
  // Fetch new data each time a new sample is selected
  var tows = d3.select("#selTowsDataset").property("value");
  buildTowMap(emergency, tows);
  // buildSummaryData(newSample);
  // buildNarrative(firstEmergency);
}

function optionChangedTowMapTows(tow) {
    var emergency = d3.select("#selCommunityDataset").property("value");
    
    if (tow === "tows") {
      d3.select("#summaryName").text("Summary of Towings Across Communities and Emergencies");
    } else {
      d3.select("#summaryName").text("Summary of Tickets Across Communities and Emergencies");
    }

    buildTowMap(emergency, tow);

    buildTowSummary(tow);
    buildStackedBar(tow);
    buildBiPlot(tow);
}

// Initialize the dashboard
initTowMap();