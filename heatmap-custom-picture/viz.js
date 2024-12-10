looker.plugins.visualizations.add({
  options: {
    bounds_spacer_1: {
      section: "Bounds",
      display_size: "third",
      order: 1
    },
    north_bound: {
      section: "Bounds",
      type: "number",
      label: "North Latitude",
      default: -4.27035445855188,
      display: "number",
      placeholder: "North coordinate",
      display_size: "third",
      order: 2
    },
    bounds_spacer_2: {
      section: "Bounds",
      display_size: "third",
      order: 3
    },
    west_bound: {
      section: "Bounds",
      type: "number",
      label: "West Longitude",
      default: -5.641889063768989,
      display: "number",
      placeholder: "West coordinate",
      display_size: "half",
      order: 4
    },
    east_bound: {
      section: "Bounds",
      type: "number",
      label: "East Longitude",
      default: -1.2746579092371733,
      display: "number",
      placeholder: "East coordinate",
      display_size: "half",
      order: 5
    },
    bounds_spacer_3: {
      section: "Bounds",
      display_size: "third",
      order: 6
    },
    south_bound: {
      section: "Bounds",
      type: "number",
      label: "South Latitude",
      default: -7.1872367426397705,
      display: "number",
      placeholder: "South coordinate",
      display_size: "third",
      order: 7
    },
    bounds_spacer_4: {
      section: "Bounds",
      display_size: "third",
      order: 8
    },
    image_url: {
      section: "Image",
      type: "string",
      label: "Image URL",
      default: "https://i.imgur.com/HInq9mU.png",
      placeholder: "Enter the URL of your JPG image",
      order: 9
    },
    background_color: {
      section: "Style",
      type: "string",
      label: "Background Color",
      display: "color",
      default: "#FFFFFF",
      order: 10
    },
    heatmap_colors: {
      section: "Heatmap",
      type: "array",
      label: "Colors",
      display: "colors",
      default: ["#f7fbff", "#08306b"],
      order: 11
    },
    point_intensity: {
      section: "Heatmap",
      type: "number",
      label: "Point Intensity",
      default: 2.0,
      display: "range",
      min: 0.1,
      max: 5.0,
      step: 0.1,
      order: 12
    },
    heatmap_intensity: {
      section: "Heatmap",
      type: "number",
      label: "Overall Opacity",
      default: 0.8,
      display: "range",
      min: 0,
      max: 1,
      step: 0.1,
      order: 13
    },
    heatmap_radius: {
      section: "Heatmap",
      type: "number",
      label: "Point Size",
      default: 40,
      display: "range",
      min: 5,
      max: 150,
      step: 5,
      order: 14
    },
    heatmap_blur: {
      section: "Heatmap",
      type: "number",
      label: "Blur",
      default: 15,
      display: "range",
      min: 0,
      max: 50,
      step: 5,
      order: 15
    },
    min_opacity: {
      section: "Heatmap",
      type: "number",
      label: "Minimum Point Opacity",
      default: 0.3,
      display: "range",
      min: 0,
      max: 1,
      step: 0.1,
      order: 16
    },
    // Hidden config fields for storing map state
    zoom_level: {
      section: "Map State",
      type: "number",
      label: "Saved Zoom Level",
      default: null,
      hidden: true
    },
    center_lat: {
      section: "Map State",
      type: "number",
      label: "Saved Center Latitude",
      default: null,
      hidden: true
    },
    center_lon: {
      section: "Map State",
      type: "number",
      label: "Saved Center Longitude",
      default: null,
      hidden: true
    }
  },

  create: function(element, config) {
    // Create tooltip element
    this.tooltip = document.createElement("div");
    this.tooltip.style.position = "absolute";
    this.tooltip.style.padding = "8px";
    this.tooltip.style.background = "rgba(255, 255, 255, 0.9)";
    this.tooltip.style.border = "1px solid #ddd";
    this.tooltip.style.borderRadius = "4px";
    this.tooltip.style.pointerEvents = "none";
    this.tooltip.style.display = "none";
    this.tooltip.style.zIndex = "1000";
    this.tooltip.style.fontSize = "12px";
    this.tooltip.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    document.body.appendChild(this.tooltip);

    this.mapContainer = document.createElement("div");
    this.mapContainer.style.width = "100%";
    this.mapContainer.style.height = "600px";
    element.appendChild(this.mapContainer);

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.css";
    document.head.appendChild(style);

    this.initialized = false;
    this.currentConfig = {
      image_url: config.image_url || this.options.image_url.default,
      north_bound: config.north_bound || this.options.north_bound.default,
      south_bound: config.south_bound || this.options.south_bound.default,
      west_bound: config.west_bound || this.options.west_bound.default,
      east_bound: config.east_bound || this.options.east_bound.default,
      heatmap_colors: config.heatmap_colors || this.options.heatmap_colors.default,
      heatmap_intensity: config.heatmap_intensity || this.options.heatmap_intensity.default,
      heatmap_radius: config.heatmap_radius || this.options.heatmap_radius.default,
      heatmap_blur: config.heatmap_blur || this.options.heatmap_blur.default,
      point_intensity: config.point_intensity || this.options.point_intensity.default,
      min_opacity: config.min_opacity || this.options.min_opacity.default,
      background_color: config.background_color || this.options.background_color.default,
      zoom_level: config.zoom_level,
      center_lat: config.center_lat,
      center_lon: config.center_lon
    };

    this.loadScripts([
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.js",
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"
    ], 0);
  },

  loadScripts: function(urls, index) {
    if (index >= urls.length) {
      this.librariesLoaded = true;
      if (this.pendingUpdate) {
        this.pendingUpdate();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = urls[index];
    script.onload = () => {
      this.loadScripts(urls, index + 1);
    };
    document.head.appendChild(script);
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (!this.librariesLoaded) {
      this.pendingUpdate = () => this.updateAsync(data, element, config, queryResponse, details, done);
      return;
    }

    this.clearErrors();

    try {
      const configChanged = 
        this.currentConfig.image_url !== config.image_url ||
        this.currentConfig.north_bound !== config.north_bound ||
        this.currentConfig.south_bound !== config.south_bound ||
        this.currentConfig.west_bound !== config.west_bound ||
        this.currentConfig.east_bound !== config.east_bound ||
        this.currentConfig.heatmap_intensity !== config.heatmap_intensity ||
        this.currentConfig.heatmap_radius !== config.heatmap_radius ||
        this.currentConfig.heatmap_blur !== config.heatmap_blur ||
        this.currentConfig.point_intensity !== config.point_intensity ||
        this.currentConfig.min_opacity !== config.min_opacity ||
        this.currentConfig.background_color !== config.background_color ||
        JSON.stringify(this.currentConfig.heatmap_colors) !== JSON.stringify(config.heatmap_colors) ||
        this.currentConfig.zoom_level !== config.zoom_level ||
        this.currentConfig.center_lat !== config.center_lat ||
        this.currentConfig.center_lon !== config.center_lon;

      this.currentConfig = {
        image_url: config.image_url || this.options.image_url.default,
        north_bound: config.north_bound || this.options.north_bound.default,
        south_bound: config.south_bound || this.options.south_bound.default,
        west_bound: config.west_bound || this.options.west_bound.default,
        east_bound: config.east_bound || this.options.east_bound.default,
        heatmap_colors: config.heatmap_colors || this.options.heatmap_colors.default,
        heatmap_intensity: config.heatmap_intensity || this.options.heatmap_intensity.default,
        heatmap_radius: config.heatmap_radius || this.options.heatmap_radius.default,
        heatmap_blur: config.heatmap_blur || this.options.heatmap_blur.default,
        point_intensity: config.point_intensity || this.options.point_intensity.default,
        min_opacity: config.min_opacity || this.options.min_opacity.default,
        background_color: config.background_color || this.options.background_color.default,
        zoom_level: config.zoom_level,
        center_lat: config.center_lat,
        center_lon: config.center_lon
      };

      const latField = queryResponse.fields.dimensions.find(d => d.name.toLowerCase().includes('lat'));
      const lonField = queryResponse.fields.dimensions.find(d => d.name.toLowerCase().includes('lon'));

      if (!latField || !lonField) {
        this.addError({
          title: "Invalid Fields",
          message: "Please include latitude and longitude fields"
        });
        return;
      }

      // Store the data for tooltip lookup
      this.pointData = data.map(row => ({
        lat: Number(row[latField.name].value),
        lon: Number(row[lonField.name].value),
        data: row
      }));

      if (!this.initialized || configChanged) {
        if (this.map) {
          this.map.remove();
        }

        // Apply background color to container
        this.mapContainer.style.backgroundColor = this.currentConfig.background_color;

        this.map = L.map(this.mapContainer, {
          crs: L.CRS.Simple,
          minZoom: -2
        });

        const imageBounds = [
          [this.currentConfig.north_bound, this.currentConfig.west_bound],
          [this.currentConfig.south_bound, this.currentConfig.east_bound]
        ];

        this.map.createPane('image-pane');
        this.map.getPane('image-pane').style.zIndex = 200;
        this.map.getPane('image-pane').style.backgroundColor = this.currentConfig.background_color;

        this.map.createPane('heatmap-pane');
        this.map.getPane('heatmap-pane').style.zIndex = 400;

        L.imageOverlay(this.currentConfig.image_url, imageBounds, {
          pane: 'image-pane'
        }).addTo(this.map);

        // Restore view from config if available
        if (this.currentConfig.zoom_level !== null && 
            this.currentConfig.center_lat !== null && 
            this.currentConfig.center_lon !== null) {
          this.map.setView([this.currentConfig.center_lat, this.currentConfig.center_lon], this.currentConfig.zoom_level);
        } else {
          this.map.fitBounds(imageBounds);
        }

        // Save state when map is moved
        this.map.on('moveend', () => {
          const center = this.map.getCenter();
          const zoom = this.map.getZoom();
          this.trigger('updateConfig', [{
            zoom_level: zoom,
            center_lat: center.lat,
            center_lon: center.lng
          }]);
        });

        // Add mousemove handler for tooltips
        this.map.on('mousemove', (e) => this.handleMouseMove(e, queryResponse));
        this.map.on('mouseout', () => {
          this.tooltip.style.display = 'none';
        });

        this.initialized = true;
      }

      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
      }

      const heatData = this.pointData.map(point => [
        point.lat,
        point.lon,
        this.currentConfig.point_intensity
      ]);

      const canvas = document.createElement('canvas');
      canvas.willReadFrequently = true;

      const gradient = {};
      const colors = this.currentConfig.heatmap_colors;
      colors.forEach((color, index) => {
        gradient[index / (colors.length - 1)] = color;
      });

      this.heatmapLayer = L.heatLayer(heatData, {
        radius: this.currentConfig.heatmap_radius,
        blur: this.currentConfig.heatmap_blur,
        maxZoom: 10,
        max: this.currentConfig.point_intensity,
        minOpacity: this.currentConfig.min_opacity,
        opacity: this.currentConfig.heatmap_intensity,
        gradient: gradient,
        pane: 'heatmap-pane',
        canvas: canvas
      }).addTo(this.map);

      setTimeout(() => {
        this.map.invalidateSize();
      }, 100);

    } catch (e) {
      console.error(e);
      this.addError({
        title: "Visualization Error",
        message: e.message
      });
    }

    done();
  },

  handleMouseMove: function(e, queryResponse) {
    const point = e.latlng;
    const radius = this.currentConfig.heatmap_radius / 2;
    
    // Find the nearest point(s) within the radius
    const nearbyPoints = this.pointData.filter(p => {
      const distance = Math.sqrt(
        Math.pow(p.lat - point.lat, 2) + 
        Math.pow(p.lon - point.lng, 2)
      );
      return distance < radius / 100;
    });

    if (nearbyPoints.length > 0) {
      // Create tooltip content using all available fields
      const content = nearbyPoints.map(point => {
        return Object.entries(point.data)
          .map(([field, value]) => {
            if (value?.value !== undefined) {
              const fieldDef = queryResponse.fields.dimensions.find(d => d.name === field) ||
                               queryResponse.fields.measures.find(m => m.name === field);
              const label = fieldDef?.label || field;
              return `<strong>${label}:</strong> ${value.value}`;
            }
            return null;
          })
          .filter(item => item !== null)
          .join('<br>');
      }).join('<hr>');

      // Position tooltip near the cursor
      const containerPoint = this.map.latLngToContainerPoint(point);
      this.tooltip.style.left = (containerPoint.x + 10) + 'px';
      this.tooltip.style.top = (containerPoint.y + 10) + 'px';
      this.tooltip.innerHTML = content;
      this.tooltip.style.display = 'block';
    } else {
      this.tooltip.style.display = 'none';
    }
  }
});
