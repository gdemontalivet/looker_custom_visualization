looker.plugins.visualizations.add({
  // Id and Label are legacy properties that no longer have any function besides documenting
  // what the visualization used to be
  id: "highcharts_scatter_with_bar",
  label: "Highcharts Scatter with Bar",
  options: {
    color_range: {
      type: "array",
      label: "Scatter Point Colors",
      display: "colors",
      default: ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#5F6368"]
    },
    bar_color: {
      type: "string",
      label: "Slope Line Color",
      display: "color",
      default: "#7F00FF"
    },
    point_size: {
      type: "number",
      label: "Point Size",
      display: "range",
      min: 2,
      max: 20,
      step: 1,
      default: 7
    },
    bar_opacity: {
      type: "number",
      label: "Slope Line Opacity",
      display: "range",
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 0.8
    },
    bar_width: {
      type: "number",
      label: "Slope Line Width",
      display: "range",
      min: 1,
      max: 10,
      step: 1,
      default: 2
    },
    point_opacity: {
      type: "number",
      label: "Point Opacity",
      display: "range",
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 1.0
    },
  },

  // Set up the initial state of the visualization
  create: function(element, config) {
    // Insert a container where Highcharts will be drawn
    element.innerHTML = `
      <style>
        #highcharts-container {
          height: 100%;
          width: 100%;
        }
      </style>
      <div id="highcharts-container"></div>
    `;
    
    // Check if Highcharts is available
    if (typeof Highcharts === 'undefined') {
      this.addError({
        title: "Highcharts Not Found",
        message: "This visualization requires Highcharts. Please add it as a dependency in your visualization manifest."
      });
    }
  },

  // Render in response to the data or settings changing
  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Clear any errors from previous updates
    this.clearErrors();

    // Throw an error if we don't have the required fields
    if (queryResponse.fields.dimensions.length < 2) {
      this.addError({
        title: "Insufficient Dimensions",
        message: "This chart requires at least 2 dimensions for the scatter plot."
      });
      return;
    }
    
    // Check if we have table calculations for mx
    const tableCalcs = queryResponse.fields.table_calculations || [];
    if (tableCalcs.length < 1 && queryResponse.fields.dimensions.length < 2) {
      this.addError({
        title: "Insufficient Fields",
        message: "This chart requires 2 dimensions for scatter points and 1 table calculation for mx."
      });
      return;
    }

    // Get the container and set up Highcharts
    const container = element.querySelector("#highcharts-container");
    
    // Get the dimensions for scatter plot
    const scatterDim1 = queryResponse.fields.dimensions[0].name;
    const scatterDim2 = queryResponse.fields.dimensions[1].name;
    
    // Get the fields for line (from table calculations)
    let mxField;
    
    if (queryResponse.fields.table_calculations && queryResponse.fields.table_calculations.length >= 1) {
      // Find the mx field in table calculations - we'll look for the one named 'mx'
      const mxCalc = queryResponse.fields.table_calculations.find(calc => calc.name === 'mx');
      mxField = mxCalc ? mxCalc.name : queryResponse.fields.table_calculations[0].name;
    } else {
      this.addError({
        title: "Missing Table Calculation",
        message: "This visualization requires a table calculation named 'mx' for the slope line."
      });
      return;
    }
    
    // Process the data for the scatter plot
    const scatterData = data.map((row, i) => {
      return {
        x: row[scatterDim1].value,
        y: row[scatterDim2].value,
        // Add any other metadata you want to include
        name: LookerCharts.Utils.textForCell(row[scatterDim1]) + ", " + LookerCharts.Utils.textForCell(row[scatterDim2])
      };
    });
    
    // Process the data for the line (mx and sale_price)
    const lineData = data.map((row, i) => {
      return {
        // For the line, we want mx as x and sale_price as y
        x: row[mxField].value,
        y: row[scatterDim2].value,
        name: `mx: ${LookerCharts.Utils.textForCell(row[mxField])}, Sale Price: ${LookerCharts.Utils.textForCell(row[scatterDim2])}`
      };
    });

    // Configure Highcharts
    Highcharts.chart(container, {
      chart: {
        type: 'scatter',
        zoomType: 'xy'
      },
      title: {
        text: ''
      },
      xAxis: {
        title: {
          text: queryResponse.fields.dimensions[0].label_short || scatterDim1
        }
      },
      yAxis: {
        title: {
          text: queryResponse.fields.dimensions[1].label_short || scatterDim2
        }
      },
      plotOptions: {
        scatter: {
          marker: {
            radius: config.point_size || 7,
            symbol: 'circle',
            fillOpacity: config.point_opacity || 1.0
          }
        },
        line: {
          lineWidth: config.bar_width || 2,
          opacity: config.bar_opacity || 0.8
        }
      },
      tooltip: {
        formatter: function() {
          if (this.series.name === 'Slope Line (mx)') {
            return `<b>Slope Value:</b><br>Sale Price: ${this.x.toFixed(2)}<br>mx: ${this.y.toFixed(2)}`;
          } else {
            return `<b>Order Data:</b><br>Sale Price: ${this.x.toFixed(2)}<br>Gross Margin: ${this.y.toFixed(2)}`;
          }
        }
      },
      series: [{
        name: 'Gross Margin vs Sale Price',
        color: config.color_range ? config.color_range[0] : '#4285F4',
        data: scatterData
      }, {
        name: 'Slope Line (mx)',
        type: 'line',
        color: config.bar_color || '#7F00FF',
        lineWidth: config.bar_width || 2,
        marker: {
          enabled: false
        },
        enableMouseTracking: true,
        data: lineData.map(point => ({
          x: point.x,
          y: point.y
        }))
      }]
    });

    // Add debugging information to the console
    console.log("Field information:", {
      dimensions: queryResponse.fields.dimensions,
      tableCalculations: queryResponse.fields.table_calculations
    });
    
    // We are done rendering! Let Looker know.
    done();
  }
});