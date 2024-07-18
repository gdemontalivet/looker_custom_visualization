looker.plugins.visualizations.add({
  id: "custom_map_polygon_labels",
  label: "Custom Map with Polygons and Labels",
  options: {
    polygonLineColor: {
      type: "string",
      label: "Line Color",
      display: "color",
      default: "#000000"
    },
    polygonLineWidth: {
      type: "number",
      label: "Line Width",
      display: "number",
      default: 2
    },
    polygonFillOpacity: {
      type: "number",
      label: "Fill Opacity",
      display: "number",
      default: 0.5,
      min: 0,
      max: 1
    },
    labelFontSize: {
      type: "number",
      label: "Label Font Size",
      display: "number",
      default: 14
    },
    showLabels: {
      type: "boolean",
      label: "Show Labels",
      display: "select",
      values: [
        { "Show": true },
        { "Hide": false }
      ],
      default: true
    },
    polygonColor: {
      type: "string",
      label: "Polygon Color",
      display: "color",
      default: "#ff0000"
    },
    gradientStartColor: {
      type: "string",
      label: "Gradient Start Color",
      display: "color",
      default: "#ff0000"
    },
    gradientEndColor: {
      type: "string",
      label: "Gradient End Color",
      display: "color",
      default: "#00ff00"
    },
    googleMapsApiKey: {
      type: "string",
      label: "Google Maps API Key",
      display: "text",
      default: ""
    }
  },
  create: function(element, config) {
    // Create the container element for the map
    element.innerHTML = `
      <div id='map' style='width: 100%; height: 90%;'></div>
      <button id='reset-selection' style='width: 100%; height: 10%;'>Reset Selection</button>
    `;

    this._map = null;
    this._drawingManager = null;
    this._shapes = [];
    this._currentRectangle = null; // Track the current rectangle

    // Load Google Maps JavaScript API
    const apiKey = config.googleMapsApiKey;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,marker&v=weekly&callback=initMap`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('Google Maps API loaded');
      this._googleMapsLoaded = true;
      if (this._pendingUpdate) {
        this.update(this._pendingUpdate.data, this._pendingUpdate.element, this._pendingUpdate.config, this._pendingUpdate.queryResponse, this._pendingUpdate.details);
        this._pendingUpdate = null;
      }
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps JavaScript API');
      console.log('Current referrer URL:', window.location.href);
    };
    document.head.appendChild(script);
  },
  update: async function(data, element, config, queryResponse, details) {
    if (!this._googleMapsLoaded) {
      this._pendingUpdate = { data, element, config, queryResponse, details };
      return;
    }

    // Ensure the data is formatted correctly
    if (!data || data.length === 0) {
      console.warn("No data available");
      return;
    }

    // Dynamically identify the relevant columns
    const geoColumn = queryResponse.fields.dimensions.find(d => {
      try {
        const sampleValue = data[0][d.name].value;
        return sampleValue.startsWith('LINESTRING') || sampleValue.startsWith('POLYGON');
      } catch (e) {
        return false;
      }
    });

    if (!geoColumn) {
      console.error("Geo data column not found");
      return;
    }

    const labelColumn = queryResponse.fields.dimensions.find(d => d.name !== geoColumn.name);

    if (!labelColumn) {
      console.error("Label column not found");
      return;
    }

    const measureColumn = queryResponse.fields.measures.length > 0 ? queryResponse.fields.measures[0] : null;

    // Initialize the map if not already created
    var mapContainer = element.querySelector('#map');
    var resetButton = element.querySelector('#reset-selection');
    if (!this._map) {
      this._map = new google.maps.Map(mapContainer, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapId: 'DEMO_MAP_ID'  // Replace with your actual Map ID
      });

      // Initialize the drawing manager
      this._drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
        drawingControl: true,
        drawingControlOptions: {
          position: google.maps.ControlPosition.TOP_CENTER,
          drawingModes: ['rectangle']
        },
        rectangleOptions: {
          fillColor: '#ffff00',
          fillOpacity: 0.5,
          strokeWeight: 2,
          clickable: true,
          editable: true,
          draggable: true
        }
      });

      this._drawingManager.setMap(this._map);

      google.maps.event.addListener(this._drawingManager, 'rectanglecomplete', (rectangle) => {
        // Remove the existing rectangle if there is one
        if (this._currentRectangle) {
          this._currentRectangle.setMap(null);
        }
        this._currentRectangle = rectangle;

        const bounds = rectangle.getBounds();
        const ne = bounds.getNorthEast(); // North East corner
        const sw = bounds.getSouthWest(); // South West corner

        // Handle the coordinates for the drawn rectangle
        console.log(`Rectangle drawn with coordinates: NE(${ne.lat()}, ${ne.lng()}), SW(${sw.lat()}, ${sw.lng()})`);

        // Trigger the filter
        this.trigger('filter', [{
          field: "sql_runner_query2.int_point_lat", // Replace with the actual field name for latitude
          value: `${sw.lat()} to ${ne.lat()}`, // Filter range for latitude
          run: true,
        }, {
          field: "sql_runner_query2.int_point_lon", // Replace with the actual field name for longitude
          value: `${sw.lng()} to ${ne.lng()}`, // Filter range for longitude
          run: true,
        }]);

        // Optionally do something with the rectangle, e.g., filter data or highlight on the map
      });

      // Add event listener for reset button
      resetButton.addEventListener('click', () => {
        // Remove the current rectangle
        if (this._currentRectangle) {
          this._currentRectangle.setMap(null);
          this._currentRectangle = null;
        }
        // Disable drawing mode
        this._drawingManager.setDrawingMode(null);
      });
    } else {
      this._shapes.forEach(shape => shape.setMap(null));
      this._shapes = [];
    }

    // Helper function to parse coordinates from geo formats
    function parseCoordinates(geoValue) {
      if (geoValue.startsWith('LINESTRING') || geoValue.startsWith('POLYGON')) {
        return geoValue
          .replace(/(LINESTRING|POLYGON|\(|\))/g, '')
          .split(',')
          .map(coord => {
            const [lng, lat] = coord.trim().split(' ').map(Number);
            return { lat, lng };
          });
      }
      return [];
    }

    // Helper function to interpolate colors
    function interpolateColor(color1, color2, factor) {
      const result = color1.slice();
      for (let i = 0; i < 3; i++) {
        result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
      }
      return result;
    }

    // Convert hex to RGB
    function hexToRgb(hex) {
      if (!hex || hex.length !== 7 || hex[0] !== '#') {
        console.error(`Invalid hex color: ${hex}`);
        return [0, 0, 0]; // Default to black
      }
      const bigint = parseInt(hex.slice(1), 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = (bigint & 255);
      return [r, g, b];
    }

    const startColor = hexToRgb(config.gradientStartColor || "#ff0000");
    const endColor = hexToRgb(config.gradientEndColor || "#00ff00");

    // Determine the min and max measure values for scaling
    const measureValues = measureColumn ? data.map(row => row[measureColumn.name].value) : [];
    const minMeasureValue = measureColumn ? Math.min(...measureValues) : 0;
    const maxMeasureValue = measureColumn ? Math.max(...measureValues) : 1;

    // Load AdvancedMarkerElement library
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // Process each row of data to create shapes and labels
    data.forEach((row) => {
      // Process geo data
      const geoData = row[geoColumn.name].value;
      const coordinates = parseCoordinates(geoData);
      const label = row[labelColumn.name]; // Use the second dimension for labels
      const measureValue = measureColumn ? row[measureColumn.name].value : null;

      if (coordinates.length > 0) {
        // Calculate the color based on the measure value or use a fixed color if no measure is available
        const factor = measureColumn ? (measureValue - minMeasureValue) / (maxMeasureValue - minMeasureValue) : 0;
        const fillColor = measureColumn ? `rgb(${interpolateColor(startColor, endColor, factor).join(',')})` : config.polygonColor;

        let shape;
        if (geoData.startsWith('POLYGON')) {
          shape = new google.maps.Polygon({
            paths: coordinates,
            strokeColor: config.polygonLineColor,
            strokeOpacity: 1.0,
            strokeWeight: config.polygonLineWidth,
            fillColor: fillColor,
            fillOpacity: config.polygonFillOpacity
          });
        } else if (geoData.startsWith('LINESTRING')) {
          shape = new google.maps.Polyline({
            path: coordinates,
            geodesic: true,
            strokeColor: config.polygonLineColor,
            strokeOpacity: 1.0,
            strokeWeight: config.polygonLineWidth
          });
        }

        if (shape) {
          shape.setMap(this._map);
          this._shapes.push(shape);

          // Add label to the shape if showLabels is true
          if (config.showLabels && label && label.value) {
            const centroid = getCentroid(coordinates);
            const marker = new AdvancedMarkerElement({
              position: centroid,
              map: this._map,
              content: document.createTextNode(label.value),
              title: label.value
            });

            // Add hover tooltip
            const infowindow = new google.maps.InfoWindow({
              content: label.value
            });
            shape.addListener('mouseover', () => {
              infowindow.setPosition(centroid);
              infowindow.open(this._map);
            });
            shape.addListener('mouseout', () => {
              infowindow.close();
            });
          }
        }
      }
    });

    // Fit map to bounds
    const bounds = new google.maps.LatLngBounds();
    this._shapes.forEach(shape => {
      if (shape.getPath) {
        shape.getPath().forEach((latlng) => {
          bounds.extend(latlng);
        });
      } else if (shape.getPaths) {
        shape.getPaths().forEach((path) => {
          path.forEach((latlng) => {
            bounds.extend(latlng);
          });
        });
      }
    });
    this._map.fitBounds(bounds);

    // Update CSS for label font size
    updateLabelFontSize(config.labelFontSize);
  }
});

// Function to initialize the Google Maps
function initMap() {
  // Just to ensure Google Maps API is loaded correctly
  console.log('Google Maps API loaded');
}

// Function to calculate the centroid of a polygon
function getCentroid(latlngs) {
  var latSum = 0;
  var lngSum = 0;
  latlngs.forEach(function(latlng) {
    latSum += latlng.lat;
    lngSum += latlng.lng;
  });
  return { lat: latSum / latlngs.length, lng: lngSum / latlngs.length };
}

// Function to update the CSS for label font size
function updateLabelFontSize(fontSize) {
  const existingStyle = document.getElementById('polygon-label-style');
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = 'polygon-label-style';
  style.type = 'text/css';
  style.innerHTML = `
    .polygon-label {
      background: none !important;
      border: none !important;
      color: black !important;
      font-weight: bold !important;
      font-size: ${fontSize}px !important;
      text-shadow: none !important;
    }
  `;
  document.getElementsByTagName('head')[0].appendChild(style);
}
