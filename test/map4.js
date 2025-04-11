//Removed Access Token
mapboxgl.accessToken = 'ACCESS TOKEN';

//Create Map
const map = new mapboxgl.Map({
container: 'map',
style: 'mapbox://styles/mapbox/light-v11',
center: [-79.379139, 43.657999],  //Centre on Toronto
attributionControl: false, //Allows the addition of the City of Toronto's attribution statement below
zoom: 12
})
.addControl(new mapboxgl.AttributionControl({
    customAttribution: 'Contains information licensed under the Open Government Licence - Toronto.'
}));

//Code from Module 11
map.on('load', () => {
    fetch('https://raw.githubusercontent.com/j1ok-tmu/CODG-136-W2025-A3/refs/heads/main/Clothing%20Drop-Box%20Locations%20-%204326.geojson', {
      headers: {
          'Accept': 'application/json'
      }
    })
    .then(response => response.json())
    .then(json => {

      // declaring an empty GeoJSON FeatureCollection
      const locations = {   //Locations is defined here
        "type": "FeatureCollection",
        "features": []
      }

      // accessing the json object markers key
      // markers is an array of objects so we can iterate over it and perform an action for each object inside the markers array
      for (const feature of json.features) {
        const coords = feature.geometry.coordinates[0];
        const tempMarker = {
          "type": "Feature",
          "properties": {
            "_id": feature.properties._id,
            "Permit_Holder": feature.properties.Permit_Holder,
            "Permit_Address_Street_No": feature.properties.Permit_Address_Street_No,
            "Permit_Address_Street_Name": feature.properties.Permit_Address_Street_Name,
          },
          "geometry": {
            "type": "Point",
            "coordinates": [
              coords[0],
              coords[1]
            ]
          }
        };
        // add tempMarker GeoJson point to the tempJson FeatureCollection
        locations.features.push(tempMarker);
      };
    
      //Add Data as Layer
      map.addSource('places', {
        'type': 'geojson',
        'data': locations   //But is undefined when referenced here
      });

      //Geocoder
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken, //Access Token
        mapboxgl: mapboxgl, // Set the mapbox-gl instance
        marker: true, // Use the geocoder's default marker style
        bbox: [-79.6392833814, 43.5796083019, -79.1132193804, 43.8554425781] //(rough) Toronto bounding box coordinates
      });

      map.addControl(geocoder, 'top-left');   //Adds Search Box to top left
      //Event Listener
      geocoder.on('result', (event) => {
        const searchResult = event.result.geometry;
        //Find Distance using Turf.JS
        const options = { units: 'kilometers' }; //Set Units to Kilometres since Toronto is in Canada
        for (const location of locations.features) {
          location.properties.distance = turf.distance(
            searchResult,
            location.geometry,
            options
          );
        }
        //Sort list entries by distance to geocoding result
        locations.features.sort((a, b) => {
          if (a.properties.distance > b.properties.distance) {
            return 1;
          }
          if (a.properties.distance < b.properties.distance) {
            return -1;
          }
          return 0; // a must be equal to b
        });

        //Rebuild list in Sidebar based on distance to geocoding result
        const listings = document.getElementById('listings');
        while (listings.firstChild) {
          listings.removeChild(listings.firstChild);
        }
        buildLocationList(locations); //Calls function to populate sidebar list
        
        //Highlight closest listing in sidebar based on geocoding result
        const activeListing = document.getElementById(
          `listing-${locations.features[0].properties._id}`
        );
        activeListing.classList.add('active');  //Active tag changes CSS styling

        //Set map frame to fit both the geocoding result and the closest marker
        const bbox = getBbox(locations, 0, searchResult);
        map.fitBounds(bbox, {
          padding: 100
        });

        //Creates popup for closest marker based on geocoding result
        createPopUp(locations.features[0]);
      });

      //Populate sidebar with Addresses
      buildLocationList(locations); //Calls function to populate sidebar list

      //Adds markers from GeoJSON object upon loading the map
      addMarkers(locations);
    
    });
  });

  //Function to add markers from GeoJSON
  function addMarkers(locations) {
    for (const marker of locations.features) {  //For each object within GeoJSON
      const el = document.createElement('div'); //Create container
      el.id = `marker-${marker.properties._id}`; //Add ID from GeoJSON "_id" field
      el.className = 'marker'; //Assign class for CSS styling
  
      //Add marker to container based on GeoJSON object coordinates
      new mapboxgl.Marker(el, { offset: [0, -23] })
        .setLngLat(marker.geometry.coordinates)
        .addTo(map);

      //On-click listener for markers
      el.addEventListener('click', (e) => {
        flyToLocation(marker); //Zooms to marker
        createPopUp(marker); //Creates popup

        //Highlights corresponding listing in sidebar using CSS styling
        const activeItem = document.getElementsByClassName('active'); //Removes CSS tag from currently highlighted listing
        e.stopPropagation();
        if (activeItem[0]) {
            activeItem[0].classList.remove('active');
        }
        const listing = document.getElementById(`listing-${marker.properties._id}`); //Adds CSS tag to new listing to highlight it
        listing.classList.add('active');
        });
    }
  }

//Function to populate sidebar with address listings
function buildLocationList(locations) {
  for (const location of locations.features) { //For each object in GeoJSON
    const listings = document.getElementById('listings'); //Get current list of listings
    const listing = listings.appendChild(document.createElement('div')); //Add listing to list
    listing.id = `listing-${location.properties._id}`; //Add ID based on GeoJSON "_id" field
    listing.className = 'item'; //Assign `item` class for CSS styling

    //Add link to listing
    const link = listing.appendChild(document.createElement('a'));
    link.href = '#';
    link.className = 'title';
    link.id = `link-${location.properties._id}`;
    link.innerHTML = `${location.properties.Permit_Address_Street_No}`
                    +` `
                    +`${location.properties.Permit_Address_Street_Name}`; //Address based on two fields from GeoJSON

    //Add details to listing
    const details = listing.appendChild(document.createElement('div'));
    details.innerHTML = `${location.properties.Permit_Holder}`; //Organization name from GeoJON field

    //Add distance from geocoding result if called by geocoding function
    if (location.properties.distance) {
      const roundedDistance = Math.round(location.properties.distance * 100) / 100;
      details.innerHTML += `<div><strong>${roundedDistance} kilometres away</strong></div>`;
    }

    //On-Click listner for listings
    link.addEventListener('click', function () {
        for (const feature of locations.features) {
          if (this.id === `link-${feature.properties._id}`) { //If listing ID matches marker ID
            flyToLocation(feature); //Zoom to marker
            createPopUp(feature); //Create popup for marker
          }
        }
        const activeItem = document.getElementsByClassName('active'); //Removes CSS tag from currently highlighted listing
        if (activeItem[0]) {
          activeItem[0].classList.remove('active');
        }
        this.parentNode.classList.add('active'); //Adds CSS tag to selected listing to highlight it
      });
  }
}

//Zoom Function
function flyToLocation(currentFeature) {
    map.flyTo({
      center: currentFeature.geometry.coordinates,  //Centre map on coordinates from GeoJSON
      zoom: 15
    });
  }
  
  //Popup Function
  function createPopUp(currentFeature) {
    const popUps = document.getElementsByClassName('mapboxgl-popup');
    if (popUps[0]) popUps[0].remove();  //Removes current popups from map
  
    const popup = new mapboxgl.Popup({ closeOnClick: false }) //Creates new popup
      .setLngLat(currentFeature.geometry.coordinates) //At coordinates from GeoJSON
      //Address and Organization information from GeoJSON fields
      .setHTML(`<h3>${currentFeature.properties.Permit_Address_Street_No}`
                      +` `
                      +`${currentFeature.properties.Permit_Address_Street_Name}</h3><h4>${currentFeature.properties.Permit_Holder}</h4>`)
      .addTo(map);
  }

  //Bounding Box function for Geocoding
  function getBbox(sortedLocations, locationIdentifier, searchResult) {
    const lats = [
      sortedLocations.features[locationIdentifier].geometry.coordinates[1],
      searchResult.coordinates[1] //Stores latitude values from geocoding result and closest marker
    ];
    const lons = [
      sortedLocations.features[locationIdentifier].geometry.coordinates[0],
      searchResult.coordinates[0] //Stores longitude values from geocoding result and closest marker
    ];

    //Sorts longitude values from smallest to largest for Bounding Box
    const sortedLons = lons.sort((a, b) => {
      if (a > b) {
        return 1;
      }
      if (a.distance < b.distance) {
        return -1;
      }
      return 0;
    });

    //Sorts latitude values from smallest to largest for Bounding Box
    const sortedLats = lats.sort((a, b) => {
      if (a > b) {
        return 1;
      }
      if (a.distance < b.distance) {
        return -1;
      }
      return 0;
    });

    //Returns smaller and larger pairs of LngLat values to create the Bounding Box
    return [
      [sortedLons[0], sortedLats[0]],
      [sortedLons[1], sortedLats[1]]
    ];
  }

