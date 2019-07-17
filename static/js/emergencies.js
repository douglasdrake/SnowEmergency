
function buildPage(emergency) {

    var narrativeUrl = `/episode/${emergency}`;
    var imgUrl = `/episode_satellite/${emergency}`;

    d3.json(narrativeUrl).then((response) => {
        console.log(response.narrative);

        d3.json(imgUrl).then((imgResponse) => {
            console.log(imgResponse.gif_url[0]);

            splitNarrative = response.narrative[0].split("||");

            var narText = d3.select("#narrative");
            narText.html("");
            narText.append("p");

            narText.text(splitNarrative);

            // narText.text(response.narrative[0]);
            
            var imgBody = d3.select("#satellite");
            imgBody.html("")
                .append("img")
                .attr("src", imgResponse.gif_url[0])
                .attr("id", "mainpic");
        })
    });

}
function initPage() {

    console.log("In init()...");
  
    // Grab a reference to the dropdown select element
    var selector = d3.select("#selEmergencyDataset");
  
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
      buildPage(firstEmergency);
    });
  }
  
  function optionChangedEmergency(emergency) {
    buildPage(emergency);
  }

  initPage();
  