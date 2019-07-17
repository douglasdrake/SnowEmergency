/* In this app, we determine summary quanties for the days of the emergency and by weekday */

function buildDailySummary(snowEmerg) {
    console.log("Build metadata"); 
  
    let days = `/daily_summary/${snowEmerg}`;
  
    d3.json(days).then(function(response){
        console.log(response.community);
      
        // pick the table for the filtered results
        var dbody = d3.select("#day-table");
        dbody.html("");
        
        // write to the day table
        response.day.forEach((datum, i) => {
            var row = dbody.append("tr");
            var cell = row.append("td");
            cell.text(datum);
            var cell = row.append("td");
            cell.text(response.towsd[i]);
            var cell = row.append("td");
            cell.text(response.ticketsd[i]);
        });      

        var wbody = d3.select("#wday-table");
        wbody.html("");

        // write to the weekday table
        response.weekday.forEach((datum, i) => {
            var row = wbody.append("tr");
            var cell = row.append("td");
            cell.text(datum);
            var cell = row.append("td");
            cell.text(response.towsw[i]);
            var cell = row.append("td");
            cell.text(response.towsw[i]);
        });

        let trace = {
            values: response.towsd,
            // marker: {
            //   colors: getColorScheme(response.otu_ids.slice(0,10), colorDict)
            // },
            labels: response.day,
            // hovertext: response.otu_labels.slice(0,10),
            // hoverinfo: 'text', // default value is 'all' which incluces 'label + text + value'
            // text: response.otu_labels.slice(0,10),
            type: 'pie'
            };
            
        let data = [trace];
            
        Plotly.newPlot("piedtows", data);
        
        let trace2 = {
            values: response.ticketsd,
            // marker: {
            //   colors: getColorScheme(response.otu_ids.slice(0,10), colorDict)
            // },
            labels: response.day,
            // hovertext: response.otu_labels.slice(0,10),
            // hoverinfo: 'text', // default value is 'all' which incluces 'label + text + value'
            // text: response.otu_labels.slice(0,10),
            type: 'pie'
        };
        
        let data2 = [trace2];
        
        Plotly.newPlot("piedtickets", data2);

        let trace3 = {
            values: response.towsw,
            // marker: {
            //   colors: getColorScheme(response.otu_ids.slice(0,10), colorDict)
            // },
            labels: response.weekday,
            // hovertext: response.otu_labels.slice(0,10),
            // hoverinfo: 'text', // default value is 'all' which incluces 'label + text + value'
            // text: response.otu_labels.slice(0,10),
            type: 'pie'
            };
            
        let data3 = [trace3];
            
        Plotly.newPlot("piewtows", data3);
        
        let trace4 = {
            values: response.ticketsw,
            // marker: {
            //   colors: getColorScheme(response.otu_ids.slice(0,10), colorDict)
            // },
            labels: response.weekday,
            // hovertext: response.otu_labels.slice(0,10),
            // hoverinfo: 'text', // default value is 'all' which incluces 'label + text + value'
            // text: response.otu_labels.slice(0,10),
            type: 'pie'
        };
        
        let data4 = [trace4];
        
        Plotly.newPlot("piewtickets", data4);        

    });// end d3.json
}

function initDailySummary() {

    // console.log("In init()...");

    // Grab a reference to the dropdown select element
    var selector = d3.select("#selDaysDataset");

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
        buildDailySummary(firstEmergency);
        summarizeAllDays();
    });
}

function summarizeAllDays() {

    var stackedbar = `/stackedbar_days/tows`;

    console.log("In buildStackedBar");

    d3.json(stackedbar).then(function(response) {

        // now stacked bar
        console.log(response);

        var trace1 = {
            x: response.emergency,
            y: response.day1,
            name: 'Day 1',
            type: 'bar'
          };
          
          var trace2 = {
            x: response.emergency,
            y: response.day2,
            name: 'Day 2',
            type: 'bar'
          };
          
          var trace3 = {
            x: response.emergency,
            y: response.day3,
            name: 'Day3',
            type: 'bar'
          };

          var data = [trace3, trace2, trace1];
          
          var layout = {
            title: "Tickets by Day Across Emergencies",  
            xaxis: {
                tickangle: -45
              },
              barmode: 'stack'};
          
          Plotly.newPlot('days-tows', data, layout);

    });

    var stackedbar = `/stackedbar_days/tickets`;

    console.log("In buildStackedBar - tickets");

    d3.json(stackedbar).then(function(response) {

        // now stacked bar

        console.log(response);

        var trace1 = {
            x: response.emergency,
            y: response.day1,
            name: 'Day 1',
            type: 'bar'
          };
          
          var trace2 = {
            x: response.emergency,
            y: response.day2,
            name: 'Day 2',
            type: 'bar'
          };
          
          var trace3 = {
            x: response.emergency,
            y: response.day3,
            name: 'Day3',
            type: 'bar'
          };

          var data = [trace3, trace2, trace1];
          
          var layout = {
            title: "Tickets by Day Across Emergencies",
            xaxis: {
                tickangle: -45
              },
              barmode: 'stack'};
          
          Plotly.newPlot('days-tickets', data, layout);

    });


}

function optionChangedDays(newSample) {
    // Fetch new data each time a new sample is selected
    buildDailySummary(newSample);
}

// Initialize the dashboard
initDailySummary();