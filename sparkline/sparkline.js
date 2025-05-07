looker.plugins.visualizations.add({
  // Configuration options
  options: {
    title_text: {
      type: "string",
      label: "Title",
      placeholder: "Week to Week Comparison",
      section: "General",
      order: 1
    },
    measure_label: {
      type: "string",
      label: "Measure Label",
      placeholder: "Sales",
      section: "General",
      order: 2
    },
    comparison_type: {
      type: "string",
      label: "Comparison Type",
      display: "select",
      values: [
        {"Percentage": "percentage"},
        {"Absolute": "absolute"}
      ],
      default: "percentage",
      section: "General",
      order: 3
    },
    positive_is_good: {
      type: "boolean",
      label: "Positive values are good",
      default: true,
      section: "General",
      order: 4
    },
    sparkline_points: {
      type: "number",
      label: "Sparkline Data Points",
      default: 0,
      display: "number",
      section: "General",
      order: 5,
      description: "Limit the number of points in the sparkline (0 = all points)"
    },
    use_looker_font: {
      type: "boolean",
      label: "Use Looker's default font",
      default: true,
      section: "Style",
      order: 0
    },
    main_value_color: {
      type: "string",
      label: "Primary Value Color",
      default: "#3259a5",
      display: "color",
      section: "Style",
      order: 1
    },
    positive_color: {
      type: "string",
      label: "Positive Comparison Color",
      default: "#4CAF50",
      display: "color",
      section: "Style",
      order: 2
    },
    negative_color: {
      type: "string",
      label: "Negative Comparison Color",
      default: "#FF5722",
      display: "color",
      section: "Style",
      order: 3
    },
    sparkline_color: {
      type: "string",
      label: "Sparkline Color",
      default: "#808080",
      display: "color",
      section: "Style",
      order: 4
    }
  },

  // Create method - called once when visualization is created
  create: function(element, config) {
    // Create a container div
    this.container = document.createElement("div");
    this.container.className = "week-comparison-container";
    
    // Add styles
    const style = document.createElement("style");
    style.innerHTML = `
      .week-comparison-container {
        padding: 20px;
        text-align: center;
      }
      .week-comparison-container.looker-font {
        font-family: Roboto, 'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK KR', 'Noto Sans Arabic UI', 'Noto Sans Devanagari UI', 'Noto Sans Hebrew', 'Noto Sans Thai UI', Helvetica, Arial, sans-serif;
      }
      .week-comparison-container.custom-font {
        font-family: 'Open Sans', Helvetica, Arial, sans-serif;
      }
      .title {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 15px;
      }
      .primary-value {
        font-size: 36px;
        font-weight: bold;
        margin: 15px 0;
        cursor: pointer;
      }
      .comparison {
        font-size: 16px;
        margin: 10px 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .comparison-icon {
        margin-right: 5px;
      }
      .sparkline-container {
        height: 50px;
        margin-top: 20px;
      }
      .tooltip {
        position: absolute;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px;
        border-radius: 3px;
        font-size: 12px;
        pointer-events: none;
        visibility: hidden;
        z-index: 10;
      }
    `;
    
    element.appendChild(style);
    element.appendChild(this.container);
    
    // Add d3.js if not already loaded
    if (!window.d3) {
      const d3Script = document.createElement('script');
      d3Script.src = "https://d3js.org/d3.v7.min.js";
      d3Script.async = true;
      document.head.appendChild(d3Script);
    }
  },

  // UpdateAsync method - called every time data changes
  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Clear any errors
    this.clearErrors();
    
    // Check if we have D3 loaded
    if (!window.d3) {
      this.addError({
        title: "D3 Library Missing",
        message: "This visualization requires D3."
      });
      return;
    }
    
    // Validate the query response
    if (!queryResponse || !queryResponse.fields) {
      this.addError({
        title: "Invalid Query Response",
        message: "The visualization requires a valid query response."
      });
      return;
    }
    
    // Check for required fields (two time dimensions and one measure)
    const dimensions = queryResponse.fields.dimension_like || [];
    const measures = queryResponse.fields.measure_like || [];
    
    if (dimensions.length < 2 || measures.length < 1) {
      this.addError({
        title: "Incomplete Data Fields",
        message: "This visualization requires at least two time dimensions and one measure."
      });
      return;
    }
    
    // Identify time dimensions by checking type or name
    const timeDimensions = dimensions.filter(dim => 
      dim.type === "date" || 
      dim.type === "date_time" || 
      dim.type === "time" ||
      dim.name.includes("date") || 
      dim.name.includes("time") || 
      dim.name.includes("month") || 
      dim.name.includes("year") || 
      dim.name.includes("week") || 
      dim.name.includes("day") || 
      dim.name.includes("hour")
    );
    
    if (timeDimensions.length < 2) {
      this.addError({
        title: "Missing Required Time Dimensions",
        message: "This visualization requires two time dimensions of different granularity."
      });
      return;
    }
    
    // Determine granularity of each time dimension
    const granularityMap = {
      "year": 10,
      "quarter": 20,
      "month": 30,
      "week": 40,
      "day": 50,
      "hour": 60,
      "minute": 70,
      "second": 80
    };
    
    // Function to guess granularity from dimension name and LookML type
    const getGranularity = (dim) => {
      // First, check by name patterns
      for (const [unit, score] of Object.entries(granularityMap)) {
        if (dim.name.includes(unit)) {
          return { dimension: dim, granularity: unit, score: score };
        }
      }
      
      // If we can't determine by name, use field type with some default granularity
      if (dim.type === "date") {
        return { dimension: dim, granularity: "day", score: granularityMap["day"] };
      } else if (dim.type === "date_time") {
        return { dimension: dim, granularity: "minute", score: granularityMap["minute"] };
      }
      
      // Default case - treat as day
      return { dimension: dim, granularity: "day", score: granularityMap["day"] };
    };
    
    // Assign granularity to time dimensions
    const timeWithGranularity = timeDimensions.map(getGranularity);
    
    // Sort by granularity: highest score = most granular (e.g. hour is more granular than day)
    timeWithGranularity.sort((a, b) => b.score - a.score);
    
    // The most granular dimension will be used for sparkline
    const mostGranularDim = timeWithGranularity[0].dimension;
    
    // The less granular dimension will be used for week/period comparison
    const lessGranularDim = timeWithGranularity[1].dimension;
    
    console.log("Most granular dimension:", mostGranularDim.name);
    console.log("Less granular dimension:", lessGranularDim.name);
    
    // Get the measure
    const measure = measures[0];
    
    // Process the data
    this.processData(data, mostGranularDim, lessGranularDim, measure, config);
    
    // Render the visualization
    this.render(config);
    
    // Signal that rendering is complete
    done();
  },
  
  // Process the data to get current period, previous period, and time series
  processData: function(data, detailedDimension, periodDimension, measure, config) {
    // Find the friendly name of the period (week, month, quarter, etc.)
    let periodName = "period";
    
    if (periodDimension.name.includes("week")) {
      periodName = "week";
    } else if (periodDimension.name.includes("month")) {
      periodName = "month";
    } else if (periodDimension.name.includes("quarter")) {
      periodName = "quarter";
    } else if (periodDimension.name.includes("year")) {
      periodName = "year";
    } else if (periodDimension.name.includes("day")) {
      periodName = "day";
    } else if (periodDimension.name.includes("hour")) {
      periodName = "hour";
    }
    
    // Store the period name for display
    this.periodName = periodName;
    
    // Find all unique periods and sort them
    const periods = [...new Set(data.map(row => row[periodDimension.name].value))].sort();
    
    // Determine current period (last period in the data) and previous period
    const currentPeriodValue = periods[periods.length - 1];
    const previousPeriodValue = periods.length > 1 ? periods[periods.length - 2] : null;
    
    // Filter data for current period and previous period
    const currentPeriodData = data.filter(row => row[periodDimension.name].value === currentPeriodValue);
    const previousPeriodData = previousPeriodValue 
      ? data.filter(row => row[periodDimension.name].value === previousPeriodValue)
      : [];
    
    // Store the raw cell data for drill functionality
    this.currentPeriodCell = currentPeriodData.length > 0 ? currentPeriodData[0][periodDimension.name] : null;
    this.previousPeriodCell = previousPeriodData.length > 0 ? previousPeriodData[0][periodDimension.name] : null;
    
    // Calculate aggregate for current period and previous period
    this.currentPeriodTotal = currentPeriodData.reduce((sum, row) => sum + row[measure.name].value, 0);
    this.previousPeriodTotal = previousPeriodData.length > 0 
      ? previousPeriodData.reduce((sum, row) => sum + row[measure.name].value, 0)
      : 0;
    
    // Store the measure cell for drill functionality
    // We'll use the first row's measure cell as a representative for drill links
    this.measureCell = currentPeriodData.length > 0 ? currentPeriodData[0][measure.name] : null;
    
    // Calculate comparison value
    this.comparisonValue = this.currentPeriodTotal - this.previousPeriodTotal;
    this.comparisonPercentage = (this.previousPeriodTotal !== 0) 
      ? ((this.currentPeriodTotal - this.previousPeriodTotal) / this.previousPeriodTotal) * 100 
      : 0;
    
    // Format for display
    const formatNumber = d3.format(",");
    const formatPercentage = d3.format("+.1f");
    
    this.formattedCurrentPeriod = formatNumber(this.currentPeriodTotal);
    this.formattedPreviousPeriod = formatNumber(this.previousPeriodTotal);
    this.formattedComparisonValue = formatNumber(this.comparisonValue);
    this.formattedComparisonPercentage = formatPercentage(this.comparisonPercentage) + "%";
    
    // Prepare data for sparkline using the most granular dimension
    const timeSeriesData = [];
    
    // Group data by the detailed dimension
    const groupedByDetail = {};
    data.forEach(row => {
      const detailValue = row[detailedDimension.name].value;
      if (!groupedByDetail[detailValue]) {
        groupedByDetail[detailValue] = [];
      }
      groupedByDetail[detailValue].push(row);
    });
    
    // Calculate total for each detailed time unit
    const allDetailValues = Object.keys(groupedByDetail).sort();
    allDetailValues.forEach(detailValue => {
      const rows = groupedByDetail[detailValue];
      const detailTotal = rows.reduce((sum, row) => sum + row[measure.name].value, 0);
      
      // Get a display label for the point - use rendered value if available
      let label = detailValue;
      if (rows[0] && rows[0][detailedDimension.name].rendered) {
        label = rows[0][detailedDimension.name].rendered;
      }
      
      // Store the cell object for drill functionality
      const cell = rows[0] ? rows[0][detailedDimension.name] : null;
      const measureCell = rows[0] ? rows[0][measure.name] : null;
      
      timeSeriesData.push({
        time: detailValue,
        label: label,
        value: detailTotal,
        cell: cell,
        measureCell: measureCell
      });
    });
    
    // Limit the number of data points if specified in config
    let sparklineData = timeSeriesData;
    if (config.sparkline_points && config.sparkline_points > 0 && config.sparkline_points < timeSeriesData.length) {
      // Logic to sample data points while keeping the shape of the trend
      // We always include the first and last point, and sample the rest
      const numPoints = config.sparkline_points;
      
      // If we only want a few points
      if (numPoints <= 2) {
        sparklineData = [timeSeriesData[0], timeSeriesData[timeSeriesData.length - 1]];
      } else {
        // Sample evenly
        const step = (timeSeriesData.length - 1) / (numPoints - 1);
        sparklineData = [];
        
        for (let i = 0; i < numPoints - 1; i++) {
          const index = Math.floor(i * step);
          sparklineData.push(timeSeriesData[index]);
        }
        
        // Always include the last point
        sparklineData.push(timeSeriesData[timeSeriesData.length - 1]);
      }
    }
    
    this.timeSeriesData = sparklineData;
  },
  
  // Render the visualization
  render: function(config) {
    // Clear the container
    this.container.innerHTML = "";
    
    // Create title
    if (config.title_text) {
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = config.title_text;
      this.container.appendChild(title);
    }
    
    // Create primary value with drill capability
    const primaryValue = document.createElement("div");
    primaryValue.className = "primary-value";
    primaryValue.textContent = this.formattedCurrentPeriod;
    primaryValue.style.color = config.main_value_color || "#3259a5";
    
    // Add drill functionality if we have links
    if (this.measureCell && this.measureCell.links && this.measureCell.links.length > 0) {
      primaryValue.style.cursor = "pointer";
      primaryValue.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: this.measureCell.links,
          event: event
        });
      };
    }
    
    this.container.appendChild(primaryValue);
    
    // Add measure label if provided
    if (config.measure_label) {
      const measureLabel = document.createElement("div");
      measureLabel.className = "measure-label";
      measureLabel.textContent = config.measure_label;
      this.container.appendChild(measureLabel);
    }
    
    // Create comparison section
    const comparison = document.createElement("div");
    comparison.className = "comparison";
    
    // Determine if comparison is positive/negative and if that's good/bad
    const isPositive = this.comparisonValue > 0;
    const isGood = (isPositive && config.positive_is_good) || (!isPositive && !config.positive_is_good);
    
    // Create icon
    const icon = document.createElement("span");
    icon.className = "comparison-icon";
    icon.innerHTML = isPositive ? "▲" : "▼";
    icon.style.color = isGood ? (config.positive_color || "#4CAF50") : (config.negative_color || "#FF5722");
    
    // Create text with possible drill action
    const comparisonText = document.createElement("span");
    comparisonText.className = "comparison-text";
    comparisonText.textContent = (config.comparison_type === "percentage") 
      ? this.formattedComparisonPercentage 
      : this.formattedComparisonValue;
    comparisonText.style.color = isGood ? (config.positive_color || "#4CAF50") : (config.negative_color || "#FF5722");
    
    // Add drill functionality to comparison if measure has links
    if (this.measureCell && this.measureCell.links && this.measureCell.links.length > 0) {
      comparisonText.style.cursor = "pointer";
      comparisonText.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: this.measureCell.links,
          event: event
        });
      };
    }
    
    // Create the previous period text with possible drill action
    const previousPeriodText = document.createElement("span");
    previousPeriodText.textContent = ` vs previous ${this.periodName}`;
    
    // Add drill functionality to previous period text if it has links
    if (this.previousPeriodCell && this.previousPeriodCell.links && this.previousPeriodCell.links.length > 0) {
      previousPeriodText.style.cursor = "pointer";
      previousPeriodText.onclick = (event) => {
        LookerCharts.Utils.openDrillMenu({
          links: this.previousPeriodCell.links,
          event: event
        });
      };
    }
    
    comparison.appendChild(icon);
    comparison.appendChild(comparisonText);
    comparison.appendChild(previousPeriodText);
    this.container.appendChild(comparison);
    
    // Create sparkline container
    const sparklineContainer = document.createElement("div");
    sparklineContainer.className = "sparkline-container";
    this.container.appendChild(sparklineContainer);
    
    // Create tooltip div for sparkline
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    this.container.appendChild(tooltip);
    
    // Draw sparkline using D3
    this.drawSparkline(sparklineContainer, tooltip, config);
  },
  
  // Draw sparkline with D3
  drawSparkline: function(container, tooltip, config) {
    if (this.timeSeriesData.length === 0) {
      // No data to visualize
      const noDataMsg = document.createElement("div");
      noDataMsg.textContent = "No time series data available";
      noDataMsg.style.textAlign = "center";
      noDataMsg.style.color = "#888";
      noDataMsg.style.paddingTop = "15px";
      container.appendChild(noDataMsg);
      return;
    }
    
    // Get container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Create SVG
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
    
    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, this.timeSeriesData.length - 1])
      .range([0, width]);
    
    // Add a padding of 10% at the top and bottom
    const maxValue = d3.max(this.timeSeriesData, d => d.value);
    const minValue = d3.min(this.timeSeriesData, d => d.value);
    const valueRange = maxValue - minValue;
    const paddingTop = valueRange * 0.1;
    const paddingBottom = minValue > 0 ? valueRange * 0.1 : 0;
    
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, minValue - paddingBottom), maxValue + paddingTop])
      .range([height - 5, 5]);
    
    // Create line generator
    const line = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);
    
    // Add an invisible rect for tooltip area
    const tooltipArea = svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("opacity", 0);
    
    // Add the line path
    svg.append("path")
      .datum(this.timeSeriesData)
      .attr("fill", "none")
      .attr("stroke", config.sparkline_color || "#808080")
      .attr("stroke-width", 2)
      .attr("d", line);
    
    // Create array to store all data points with their circles for drilling
    const dots = [];
    
    // Add dots for each data point with drill functionality
    for (let i = 0; i < this.timeSeriesData.length; i++) {
      const point = this.timeSeriesData[i];
      
      const dot = svg.append("circle")
        .attr("class", "dot")
        .attr("cx", xScale(i))
        .attr("cy", yScale(point.value))
        .attr("r", 2)
        .attr("fill", config.sparkline_color || "#808080")
        .attr("opacity", 0); // Invisible by default
      
      // If the data point has links, add drill functionality
      if (point.cell && point.cell.links && point.cell.links.length > 0) {
        dot.style("cursor", "pointer")
          .on("click", (event) => {
            LookerCharts.Utils.openDrillMenu({
              links: point.cell.links,
              event: event
            });
          });
      }
      
      dots.push(dot);
    }
    
    // Add special dot for the last value
    const lastDot = svg.append("circle")
      .attr("cx", xScale(this.timeSeriesData.length - 1))
      .attr("cy", yScale(this.timeSeriesData[this.timeSeriesData.length - 1].value))
      .attr("r", 4)
      .attr("fill", config.main_value_color || "#3259a5");
    
    // Add drill functionality to the last dot if it has links
    const lastPoint = this.timeSeriesData[this.timeSeriesData.length - 1];
    if (lastPoint.cell && lastPoint.cell.links && lastPoint.cell.links.length > 0) {
      lastDot.style("cursor", "pointer")
        .on("click", (event) => {
          LookerCharts.Utils.openDrillMenu({
            links: lastPoint.cell.links,
            event: event
          });
        });
    }
    
    // Handle mouse events for tooltip
    tooltipArea
      .on("mousemove", (event) => {
        // Calculate the index based on mouse position
        const mouseX = d3.pointer(event)[0];
        const index = Math.round(xScale.invert(mouseX));
        
        if (index >= 0 && index < this.timeSeriesData.length) {
          const d = this.timeSeriesData[index];
          
          // Format the tooltip text
          const formatNumber = d3.format(",");
          const tooltipText = `${d.label}: ${formatNumber(d.value)}`;
          
          // Update tooltip position and content
          d3.select(tooltip)
            .style("visibility", "visible")
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px")
            .text(tooltipText);
          
          // Highlight the corresponding dot
          dots.forEach((dot, i) => {
            dot.attr("opacity", i === index ? 1 : 0)
               .attr("r", i === index ? 4 : 2);
          });
        }
      })
      .on("mouseout", () => {
        d3.select(tooltip).style("visibility", "hidden");
        dots.forEach(dot => {
          dot.attr("opacity", 0)
             .attr("r", 2);
        });
      });
  }
});
