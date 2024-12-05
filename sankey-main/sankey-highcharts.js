(function() {
  // Include the handleErrors function
  function handleErrors(vis, res, options) {
    // Handle the errors
    let checks = {
      pivots: res.fields.pivots.length,
      dimensions: res.fields.dimension_like.length,
      measures: res.fields.measure_like.length
    };

    if (options.min_pivots != null && checks.pivots < options.min_pivots) {
      vis.addError({
        group: "pivot-req",
        title: "Not Enough Pivots",
        message: "This chart requires " + options.min_pivots + " pivots."
      });
      return false;
    } else {
      vis.clearErrors("pivot-req");
    }

    if (options.max_pivots != null && checks.pivots > options.max_pivots) {
      vis.addError({
        group: "pivot-req",
        title: "Too Many Pivots",
        message: "This chart requires no more than " + options.max_pivots + " pivots."
      });
      return false;
    } else {
      vis.clearErrors("pivot-req");
    }

    if (options.min_dimensions != null && checks.dimensions < options.min_dimensions) {
      vis.addError({
        group: "dim-req",
        title: "Not Enough Dimensions",
        message: "This chart requires " + options.min_dimensions + " dimensions."
      });
      return false;
    } else {
      vis.clearErrors("dim-req");
    }

    if (options.max_dimensions != null && checks.dimensions > options.max_dimensions) {
      vis.addError({
        group: "dim-req",
        title: "Too Many Dimensions",
        message: "This chart requires no more than " + options.max_dimensions + " dimensions."
      });
      return false;
    } else {
      vis.clearErrors("dim-req");
    }

    if (options.min_measures != null && checks.measures < options.min_measures) {
      vis.addError({
        group: "mes-req",
        title: "Not Enough Measures",
        message: "This chart requires " + options.min_measures + " measures."
      });
      return false;
    } else {
      vis.clearErrors("mes-req");
    }

    if (options.max_measures != null && checks.measures > options.max_measures) {
      vis.addError({
        group: "mes-req",
        title: "Too Many Measures",
        message: "This chart requires no more than " + options.max_measures + " measures."
      });
      return false;
    } else {
      vis.clearErrors("mes-req");
    }

    return true;
  }

  const vis = {
    id: 'sankey_highcharts',
    label: 'Sankey (Highcharts)',
    options: {
      color_range: {
        type: 'array',
        label: 'Color Range',
        display: 'colors',
        default: ['#dd3333', '#80ce5d', '#f78131', '#369dc1', '#c572d3', '#36c1b3', '#b57052', '#ed69af']
      },
      label_type: {
        default: 'name',
        display: 'select',
        label: 'Label Type',
        type: 'string',
        values: [
          { 'Name': 'name' },
          { 'Name (value)': 'name_value' }
        ]
      },
      show_null_points: {
        type: 'boolean',
        label: 'Plot Null Values',
        default: true
      }
    },
    // Set up the initial state of the visualization
    create: function(element, config) {
      element.innerHTML = '';
    },
    // Render in response to the data or settings changing
    updateAsync: function(data, element, config, queryResponse, details, doneRendering) {
      if (!handleErrors(this, queryResponse, {
        min_pivots: 0, max_pivots: 0,
        min_dimensions: 2, max_dimensions: undefined,
        min_measures: 1, max_measures: 1
      })) return;

      // Clean up the element
      element.innerHTML = '';

      // Prepare the data for Highcharts Sankey
      const dimensions = queryResponse.fields.dimension_like;
      const measure = queryResponse.fields.measure_like[0];

      const nodesSet = new Set();
      const linksMap = new Map();

      data.forEach(function(row) {
        const path = [];
        for (let i = 0; i < dimensions.length; i++) {
          const dim = dimensions[i];
          if (row[dim.name].value === null && !config.show_null_points) break;
          path.push(row[dim.name].value + '');
        }

        for (let i = 0; i < path.length - 1; i++) {
          const source = path[i];
          const target = path[i + 1];
          nodesSet.add(source);
          nodesSet.add(target);

          const value = +row[measure.name].value;

          // Create a unique key for the link
          const linkKey = source + '->' + target;

          // Aggregate values if the link already exists
          if (linksMap.has(linkKey)) {
            linksMap.get(linkKey).weight += value;
          } else {
            linksMap.set(linkKey, {
              from: source,
              to: target,
              weight: value
            });
          }
        }
      });

      const nodes = Array.from(nodesSet).map(name => ({ id: name }));
      const links = Array.from(linksMap.values());

      // Highcharts options
      const chartOptions = {
        chart: {
          type: 'sankey',
          renderTo: element
        },
        title: {
          text: ''
        },
        tooltip: {
          formatter: function() {
            return this.point.isNode ?
              `<b>${this.point.id}</b>` :
              `<b>${this.point.fromNode.id} → ${this.point.toNode.id}</b><br/>Value: ${this.point.weight}`;
          }
        },
        plotOptions: {
          series: {
            dataLabels: {
              enabled: true,
              format: '{point.name}',
              color: '#333',
              style: {
                fontWeight: 'bold',
                textOutline: 'none'
              }
            },
            nodeWidth: 20,
            cursor: 'pointer',
            point: {
              events: {
                click: function() {
                  // Add drill menu event
                  const event = {
                    pageX: this.plotX + this.series.chart.container.getBoundingClientRect().left,
                    pageY: this.plotY + this.series.chart.container.getBoundingClientRect().top
                  };
                  LookerCharts.Utils.openDrillMenu({
                    links: this.links || [],
                    event: event
                  });
                }
              }
            }
          }
        },
        series: [{
          keys: ['from', 'to', 'weight'],
          data: links,
          nodes: nodes,
          colorByPoint: false,
          colors: config.color_range || vis.options.color_range.default
        }]
      };

      // Render the chart
      Highcharts.chart(chartOptions);

      doneRendering();
    }
  };

  looker.plugins.visualizations.add(vis);
}());
