const visObject = {
  /**
   * Configuration options for your visualization. In Looker, these show up in the vis editor
   * panel but here, you can just manually set your default values in the code.
   **/
  options: {
    chart_title: {
      type: "string",
      label: "Graph title",
      default: "Graph title",
    },
    yScale: {
      type: "string",
      label: "Y Scale",
      default: "##",
    },
    legend: {
      type: "string",
      label: "Legend",
      default: "Metric",
    },
    table: {
      type: "boolean",
      label: "Table",
      default: "true",
    },
  },

  /**
   * The create function gets called when the visualization is mounted but before any
   * data is passed to it.
   **/
  create: function (element, config) {
    element.innerHTML = "<></>";
  },

  /**
   * UpdateAsync is the function that gets called (potentially) multiple times. It receives
   * the data and should update the visualization with the new data.
   **/
  updateAsync: function (
    data,
    element,
    config,
    queryResponse,
    details,
    doneRendering
  ) {
    console.log({ data, queryResponse });

    // START PROCESSING
    const dataset = transformArray(data);
    const resultMonthly = calculateMonthlySum(
      dataset,
      getFirstDayLastYear(),
      getLastDayOfLastMonth()
    );
    const resultWeekly = calculateWeeklySum(
      dataset,
      getFirstDay6WeeksAgo(),
      getLastDayOfLastWeek()
    );

    const resultMonthlyPrevious = calculateMonthlySum(
      dataset,
      getFirstDayLastYear(true),
      getLastDayOfLastMonth(true)
    );
    const resultWeeklyPrevious = calculateWeeklySum(
      dataset,
      getFirstDay6WeeksAgo(true),
      getLastDayOfLastWeek(true)
    );
    console.log({
      resultMonthly,
      resultWeekly,
      resultMonthlyPrevious,
      resultWeeklyPrevious,
    });
    // END PROCESSING

    // set the dimensions and margins of the graph
    const CONTAINER_ID = "container";
    element.innerHTML = `<div id=${CONTAINER_ID} style="width: 100%; height: 100%; margin: 0 auto"></div>`;

    const markerMap = new Map([
      ["primary", "circle"],
      ["secondary", "square"],
      ["tertiary", "diamond"],
      ["quaternary", "triangle-down"],
    ]);
    const cyColorMap = new Map([
      ["primary", "#3944BC"],
      ["secondary", "#3141f5"],
      ["tertiary", "#6975fa"],
      ["quaternary", "#7c86fc"],
      ["quinary", "#979ffc"],
    ]);
    const pyColorMap = new Map([
      ["primary", "#FFC0CB"],
      ["secondary", "#ffd6dd"],
      ["tertiary", "#fad9df"],
      ["quaternary", "#fae1e5"],
      ["quinary", "#fff0f2"],
    ]);

    data = {
      axes: 2,
      table: {
        tableBody: [
          [
            428634, 3.207211892688422, 32.90358587972653, 1483031,
            27.21646247836165, 5549656, 37.28457045942717, 16389808,
            46.144738665357444,
          ],
        ],
        tableHeader: [
          "LastWk",
          "WOW",
          "YOY",
          "MTD",
          "YOY",
          "QTD",
          "YOY",
          "YTD",
          "YOY",
        ],
      },
      tooltip: "false",
      xAxis: [
        ...resultWeekly.map(({ date }) => date),
        " ",
        ...resultMonthly.map(({ date }) => date),
      ],
      yAxis: [
        {
          legendName: config.legend,
          lineStyle: "primary",
          metric: {
            current: [
              {
                primaryAxis: [
                  ...resultWeekly.map(({ value }) => value),
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                ],
              },
              {
                secondaryAxis: [
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  ...resultMonthly.map(({ value }) => value),
                ],
              },
            ],
            previous: [
              {
                primaryAxis: [
                  ...resultWeeklyPrevious.map(({ value }) => value),
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                ],
              },
              {
                secondaryAxis: [
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                  ...resultMonthlyPrevious.map(({ value }) => value),
                ],
              },
            ],
          },
        },
      ],
      yLabel: "",
      yScale: config.yScale,
    };

    const containerBlock = document.getElementById(CONTAINER_ID);

    const chartBlock = document.createElement("div");
    const chartBlockId = "chart";
    chartBlock.id = chartBlockId;
    containerBlock.appendChild(chartBlock);
    plotChart(chartBlockId, data);

    if (config.table) {
      const tableBlock = document.createElement("div");
      tableBlock.height = "100%";
      const tableBlockId = "table";
      tableBlock.id = tableBlockId;
      containerBlock.appendChild(tableBlock);
      createTable(tableBlockId, data);
    }

    function createTable(dynamicTable, data) {
      const { tableHeader, tableBody: tableValues } = data.table;
      var table = document.createElement("table");
      table.width = "100%";
      table.textAlign = "left";
      var tableHead = table.createTHead();
      var firstRow = tableHead.insertRow();

      for (var i = 0; i < tableHeader.length; i++) {
        var tableHeaderElement = document.createElement("th");
        tableHeaderElement.style.cssText = "text-align:center;";
        tableHeaderElement.innerHTML = tableHeader[i];
        firstRow.appendChild(tableHeaderElement);
      }

      tableValues.forEach(function (tablevalue, index) {
        tr = table.insertRow();
        for (var j = 0; j < tablevalue.length; j++) {
          var tabCell = tr.insertCell(-1);
          tabCell.style.cssText = "text-align:center;";
          var tableCellData = tablevalue[j];
          var formatMask = data.yScale;
          var precision = 0;
          if (formatMask.includes(".")) {
            precision = formatMask.split(".")[1][0];
          }
          if (tableCellData !== "N/A") {
            if ((j == 1 || j % 2 == 0) && j != 0) {
              tableCellData = tableCellData.toFixed(precision) + "%";
            } else {
              if (formatMask.includes("MM")) {
                if (tableCellData < 1) {
                  tableCellData = tableCellData.toFixed(precision);
                } else {
                  tableCellData = (tableCellData / 1000000).toFixed(precision);
                }
                if (tableCellData > 0) {
                  tableCellData += "M";
                }
              } else if (formatMask.includes("BB")) {
                if (tableCellData < 1) {
                  tableCellData = tableCellData.toFixed(precision);
                } else {
                  tableCellData = (tableCellData / 1000000000).toFixed(
                    precision
                  );
                }
                if (tableCellData > 0) {
                  tableCellData += "B";
                }
              } else if (formatMask.includes("KK")) {
                if (tableCellData < 1) {
                  tableCellData = tableCellData.toFixed(precision);
                } else {
                  tableCellData = (tableCellData / 1000).toFixed(precision);
                }
                if (tableCellData > 0) {
                  tableCellData += "k";
                }
              } else if (formatMask.includes("%")) {
                if (
                  Math.abs(tableCellData) < 1 &&
                  Math.abs(tableCellData) >= 1e-3
                ) {
                  tableCellData =
                    Math.round(tableCellData * 100, precision) + "%";
                } else {
                  tableCellData =
                    Math.round(tableCellData, precision) / 100 + "%";
                }
              } else {
                if (tableCellData < 1) {
                  tableCellData = tableCellData.toFixed(precision);
                } else {
                  tableCellData = tableCellData.toFixed(precision);
                }
              }
            }
          }
          tabCell.innerHTML = tableCellData;
        }
      });

      var divShowData = document.getElementById(dynamicTable);
      divShowData.innerHTML = "";
      divShowData.appendChild(table);
    }

    function plotChart(divId, data) {
      var subseries = [];
      data.yAxis.forEach(function (seriesData, index) {
        var lineName = seriesData.legendName;
        if (seriesData.lineStyle !== undefined) {
          if (seriesData.lineStyle !== "target") {
            if (data.axes == 2) {
              subseries.push(
                {
                  name: lineName + " - CY",
                  type: "spline",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.current[0] &&
                    seriesData.metric.current[0].primaryAxis,
                  marker: {
                    symbol: markerMap.get(seriesData.lineStyle),
                  },
                  dataLabels: {
                    enabled: true,
                    formatter: function () {
                      var formatMask = data.yScale;
                      var precision = 0;
                      if (formatMask.includes(".")) {
                        precision = formatMask.split(".")[1][0];
                      }
                      if (formatMask.includes("MM")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000,
                          precision
                        );
                      } else if (data.yScale.includes("BB")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000000,
                          precision
                        );
                      } else if (data.yScale.includes("KK")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000,
                          precision
                        );
                      } else if (data.yScale.includes("%")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        //                      if (this.y < 1 && this.y >= 1E-4){
                        return Highcharts.numberFormat(this.y * 100, precision);
                        //                      }
                        //                      return Highcharts.numberFormat(this.y, precision);
                      } else {
                        return Highcharts.numberFormat(this.y, precision);
                      }
                    },
                  },
                  color: cyColorMap.get(seriesData.lineStyle),
                },
                {
                  name: lineName + " - CY",
                  type: "spline",
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.current[1] &&
                    seriesData.metric.current[1].secondaryAxis,
                  dataLabels: {
                    enabled: true,
                    formatter: function () {
                      var formatMask = data.yScale;
                      var precision = 0;
                      if (formatMask.includes(".")) {
                        precision = formatMask.split(".")[1][0];
                      }
                      if (formatMask.includes("MM")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000,
                          precision
                        );
                      } else if (formatMask.includes("BB")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000000,
                          precision
                        );
                      } else if (formatMask.includes("KK")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000,
                          precision
                        );
                      } else if (formatMask.includes("%")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        //                        if (this.y < 1 && this.y >= 1E-4){
                        return Highcharts.numberFormat(this.y * 100, precision);
                        //                        }
                        //                        return Highcharts.numberFormat(this.y, precision);
                      } else {
                        return Highcharts.numberFormat(this.y, precision);
                      }
                    },
                  },
                  marker: {
                    symbol: markerMap.get(seriesData.lineStyle),
                  },
                  color: cyColorMap.get(seriesData.lineStyle),
                  linkedTo: ":previous",
                },
                {
                  name: lineName + " - PY",
                  type: "line",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.previous[0] &&
                    seriesData.metric.previous[0].primaryAxis,
                  marker: {
                    enabled: false,
                  },
                  color: pyColorMap.get(seriesData.lineStyle),
                },
                {
                  name: lineName + " - PY",
                  type: "line",
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.previous[1] &&
                    seriesData.metric.previous[1].secondaryAxis,
                  marker: {
                    enabled: false,
                  },
                  color: pyColorMap.get(seriesData.lineStyle),
                  linkedTo: ":previous",
                }
              );
            } else if (data.axes == 1) {
              subseries.push(
                {
                  name: lineName + " - CY",
                  type: "spline",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.current[0] &&
                    seriesData.metric.current[0].primaryAxis,
                  marker: {
                    symbol: markerMap.get(seriesData.lineStyle),
                  },
                  dataLabels: {
                    enabled: true,
                    formatter: function () {
                      var formatMask = data.yScale;
                      var precision = 0;
                      if (formatMask.includes(".")) {
                        precision = formatMask.split(".")[1][0];
                      }
                      if (formatMask.includes("MM")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000,
                          precision
                        );
                      } else if (formatMask.includes("BB")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000000,
                          precision
                        );
                      } else if (formatMask.includes("KK")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000,
                          precision
                        );
                      } else if (formatMask.includes("%")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        //                      if (this.y < 1 && this.y >= 1E-4){
                        return Highcharts.numberFormat(this.y * 100, precision);
                        //                      }
                        //                      return Highcharts.numberFormat(this.y, precision);
                      } else {
                        return Highcharts.numberFormat(this.y, precision);
                      }
                    },
                  },
                  color: cyColorMap.get(seriesData.lineStyle),
                },
                {
                  name: lineName + " - CY",
                  type: "spline",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.current[1] &&
                    seriesData.metric.current[1].secondaryAxis,
                  dataLabels: {
                    enabled: true,
                    formatter: function () {
                      var formatMask = data.yScale;
                      var precision = 0;
                      if (formatMask.includes(".")) {
                        precision = formatMask.split(".")[1][0];
                      }
                      if (formatMask.includes("MM")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000,
                          precision
                        );
                      } else if (formatMask.includes("BB")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000000000,
                          precision
                        );
                      } else if (formatMask.includes("KK")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        return Highcharts.numberFormat(
                          this.y / 1000,
                          precision
                        );
                      } else if (formatMask.includes("%")) {
                        if (this.y == 0) {
                          return this.y;
                        }
                        //                        if (this.y < 1 && this.y >= 1E-4){
                        return Highcharts.numberFormat(this.y * 100, precision);
                        //                        }
                        //                          return Highcharts.numberFormat(this.y, precision);
                      } else {
                        return Highcharts.numberFormat(this.y, precision);
                      }
                    },
                  },
                  marker: {
                    symbol: markerMap.get(seriesData.lineStyle),
                  },
                  color: cyColorMap.get(seriesData.lineStyle),
                  linkedTo: ":previous",
                },
                {
                  name: lineName + " - PY",
                  type: "line",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.previous[0] &&
                    seriesData.metric.previous[0].primaryAxis,
                  marker: {
                    enabled: false,
                  },
                  color: pyColorMap.get(seriesData.lineStyle),
                },
                {
                  name: lineName + " - PY",
                  type: "line",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.metric &&
                    seriesData.metric.previous[1] &&
                    seriesData.metric.previous[1].secondaryAxis,
                  marker: {
                    enabled: false,
                  },
                  color: pyColorMap.get(seriesData.lineStyle),
                  linkedTo: ":previous",
                }
              );
            }
          } else {
            if (data.axes == 2) {
              subseries.push(
                {
                  name: lineName,
                  type: "scatter",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.Target &&
                    seriesData.Target.current[0] &&
                    seriesData.Target.current[0].primaryAxis,
                  tooltip: {
                    formatter: function () {
                      var string = "week: " + this.value + ", value: " + this.y;
                      return string;
                    },
                  },
                  marker: {
                    symbol: "triangle",
                  },
                  color: "green",
                },
                {
                  name: lineName,
                  type: "scatter",
                  data:
                    seriesData &&
                    seriesData.Target &&
                    seriesData.Target.current[1] &&
                    seriesData.Target.current[1].secondaryAxis,
                  marker: {
                    symbol: "triangle",
                  },
                  color: "green",
                  linkedTo: ":previous",
                }
              );
            } else if (seriesData.axes == 1) {
              subseries.push(
                {
                  name: lineName,
                  type: "scatter",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.Target &&
                    seriesData.Target.current[0] &&
                    seriesData.Target.current[0].primaryAxis,
                  tooltip: {
                    formatter: function () {
                      var string = "week: " + this.value + ", value: " + this.y;
                      return string;
                    },
                  },
                  marker: {
                    symbol: "triangle",
                  },
                  color: "green",
                },
                {
                  name: lineName,
                  type: "scatter",
                  yAxis: 1,
                  data:
                    seriesData &&
                    seriesData.Target &&
                    seriesData.Target.current[1] &&
                    seriesData.Target.current[1].secondaryAxis,
                  marker: {
                    symbol: "triangle",
                  },
                  color: "green",
                  linkedTo: ":previous",
                }
              );
            }
          }
        }
      });

      Highcharts.setOptions({
        colors: [
          "#058DC7",
          "#50B432",
          "#ED561B",
          "#DDDF00",
          "#24CBE5",
          "#64E572",
          "#FF9655",
          "#FFF263",
          "#6AF9C4",
        ],
      });
      Highcharts.chart(divId, {
        chart: {
          zoomType: "xy",
        },
        title: {
          text: config.chart_title,
          align: "center",
        },
        tooltip: {
          enabled: data.tooltip == "true",
          formatter: function () {
            var tooltipValue;
            var formatMask = data.yScale;
            var precision = 0;
            if (formatMask.includes(".")) {
              precision = formatMask.split(".")[1][0];
            }
            if (formatMask.includes("MM")) {
              if (this.y == 0) {
                tooltipValue = this.y;
              }
              tooltipValue =
                Highcharts.numberFormat(this.y / 1000000, precision) + "M";
            } else if (formatMask.includes("BB")) {
              if (this.y == 0) {
                tooltipValue = this.y;
              }
              tooltipValue =
                Highcharts.numberFormat(this.y / 1000000000, precision) + "B";
            } else if (formatMask.includes("KK")) {
              if (this.y == 0) {
                tooltipValue = this.y;
              }
              tooltipValue =
                Highcharts.numberFormat(this.y / 1000, precision) + "K";
            } else if (formatMask.includes("%")) {
              if (this.y == 0) {
                tooltipValue = this.y;
              }
              tooltipValue =
                Highcharts.numberFormat(this.y * 100, precision) + "%";
            } else {
              tooltipValue = Highcharts.numberFormat(this.y, precision);
            }

            return "<b>" + this.x + "<b>: " + "<b>" + tooltipValue + "</b>";
          },
        },
        exporting: { enabled: false },
        xAxis: [
          {
            categories: data && data.xAxis,
            crosshair: true,
          },
        ],
        yAxis: [
          {
            // Primary yAxis
            labels: {
              formatter: function () {
                if (data.yScale.includes("MM")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  return this.value / 1000000 + "M";
                } else if (data.yScale.includes("BB")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  return this.value / 1000000000 + "B";
                } else if (data.yScale.includes("KK")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  return this.value / 1000 + "k";
                } else if (data.yScale.includes("%")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  if (this.value < 1 && this.value >= 1e-4) {
                    return Highcharts.numberFormat(this.value * 100, 0) + "%";
                  }
                  return this.value + "%";
                } else {
                  return this.value;
                }
              },
              style: {
                color: Highcharts.getOptions().colors[2],
              },
            },
            title: {
              text: "",
              style: {
                color: Highcharts.getOptions().colors[2],
              },
            },
            opposite: true,
          },
          {
            // Secondary yAxis
            gridLineWidth: 0,
            title: {
              text: "",
              style: {
                color: Highcharts.getOptions().colors[0],
              },
            },
            labels: {
              //            format: '{value}',
              formatter: function () {
                if (data.yScale.includes("MM")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  return this.value / 1000000 + "M";
                } else if (data.yScale.includes("BB")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  return this.value / 1000000000 + "B";
                } else if (data.yScale.includes("KK")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  return this.value / 1000 + "k";
                } else if (data.yScale.includes("%")) {
                  if (this.value == 0) {
                    return this.value;
                  }
                  if (this.value < 1 && this.value >= 1e-4) {
                    return Highcharts.numberFormat(this.value * 100, 0) + "%";
                  }
                  return this.value + "%";
                } else {
                  return this.value;
                }
              },
              style: {
                color: Highcharts.getOptions().colors[0],
              },
            },
          },
        ],

        legend: {
          align: "center",
          verticalAlign: "bottom",
          x: 0,
          y: 0,
        },
        plotOptions: {
          spline: {
            dataLabels: {
              enabled: true,
            },
          },
        },
        series: subseries,
        responsive: {
          rules: [
            {
              condition: {
                maxWidth: 500,
              },
              chartOptions: {
                legend: {
                  floating: false,
                  layout: "horizontal",
                  align: "center",
                  verticalAlign: "bottom",
                  x: 0,
                  y: 0,
                },
                yAxis: [
                  {
                    labels: {
                      align: "right",
                      x: 0,
                      y: -6,
                    },
                    showLastLabel: false,
                  },
                  {
                    labels: {
                      align: "left",
                      x: 0,
                      y: -6,
                    },
                    showLastLabel: false,
                  },
                  {
                    visible: false,
                  },
                ],
              },
            },
          ],
        },
      });
    }

    // START DATA PROCESSING FUNCTIONS
    function transformArray(inputArray) {
      const outputArray = [];
      const [dateKey, metricKey] = Object.keys(inputArray[0]);
      for (let i = 0; i < inputArray.length; i++) {
        const date = inputArray[i][dateKey].value;
        const value = inputArray[i][metricKey].value;
        outputArray.push({ date, value });
      }
      return outputArray;
    }

    function calculateMonthlySum(dataset, startDate, endDate) {
      let computedSum = [];

      dataset.forEach(({ date, value }) => {
        if (date >= startDate && date <= endDate) {
          const month = new Date(date).toLocaleString("default", {
            month: "short",
          });
          if (computedSum[computedSum.length - 1]?.date === month) {
            computedSum[computedSum.length - 1].value += value;
          } else {
            computedSum.push({ date: month, value });
          }
        }
      });
      computedSum.reverse();

      return computedSum;
    }

    function calculateWeeklySum(dataset, startDate, endDate) {
      let computedSum = [];

      dataset.forEach(({ date, value }) => {
        if (date >= startDate && date <= endDate) {
          const week = `wk ${getWeek(new Date(date))}`;
          if (computedSum[computedSum.length - 1]?.date === week) {
            computedSum[computedSum.length - 1].value += value;
          } else {
            computedSum.push({ date: week, value });
          }
        }
      });
      computedSum.reverse();

      return computedSum;
    }

    function getLastDayOfLastMonth(previous = false) {
      let date = new Date();
      previous && date.setFullYear(date.getFullYear() - 1);
      date.setDate(1);
      date.setDate(0);

      return formatDate(date);
    }

    function getFirstDayLastYear(previous = false) {
      let date = new Date();
      previous && date.setFullYear(date.getFullYear() - 1);
      date.setMonth(date.getMonth() - 13);
      date.setDate(1);
      return formatDate(date);
    }

    function getLastDayOfLastWeek(previous = false) {
      let date = new Date();
      previous && date.setFullYear(date.getFullYear() - 1);
      const lastDayLastWeek = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() - date.getDay()
      );

      return formatDate(lastDayLastWeek);
    }

    function getFirstDay6WeeksAgo(previous = false) {
      let date = new Date();
      previous && date.setFullYear(date.getFullYear() - 1);
      const today = date.getDate();
      const currentDay = date.getDay();
      date.setDate(today - currentDay - 6 * 7 + 1);

      return formatDate(date);
    }

    function formatDate(date) {
      return date.toISOString().substring(0, 10);
    }

    function getWeek(date) {
      var date = new Date(date.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
      var week1 = new Date(date.getFullYear(), 0, 4);
      return (
        1 +
        Math.round(
          ((date.getTime() - week1.getTime()) / 86400000 -
            3 +
            ((week1.getDay() + 6) % 7)) /
            7
        )
      );
    }

    // END DATA PROCESSING FUNCTIONS

    doneRendering();
  },
};

looker.plugins.visualizations.add(visObject);
