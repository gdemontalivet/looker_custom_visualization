looker.plugins.visualizations.add({
  id: "configurable_conditional_table",
  label: "Configurable Conditional Table",
  options: {
    // Section for formatting options to group them in the UI
    formatting_section: {
        type: 'string',
        label: 'Formatting',
        display: 'heading'
    },
    highlightString: {
        type: 'string',
        label: 'Highlighting Substring',
        section: 'Formatting',
        display: 'text',
        default: '\u00A0\u00A0\u00A0\u00A0', // Default to 4 non-breaking spaces
        placeholder: 'Substring that triggers highlighting'
    },
    highlightColor: {
      type: 'string',
      label: 'Highlight Color',
      section: 'Formatting',
      display: 'color',
      default: '#e6f7ff' // A pleasant light blue
    },
    baseColor: {
      type: 'string',
      label: 'Base Color',
      section: 'Formatting',
      display: 'color',
      default: '#f2f2f2' // A light grey
    }
  },

  create: function(element, config) {
    // Create a container for our table
    this._container = element.appendChild(document.createElement("div"));
    this._container.className = "table-container";
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Clear any previous errors
    this.clearErrors();

    // Validate the data structure
    if (queryResponse.fields.dimensions.length !== 1) {
      this.addError({title: "Incorrect Dimensions", message: "This visualization requires exactly one dimension."});
      return;
    }
    if (queryResponse.fields.measures.length !== 2) {
      this.addError({title: "Incorrect Measures", message: "This visualization requires exactly two measures."});
      return;
    }

    // Get field metadata from the query response
    const dimension = queryResponse.fields.dimensions[0];
    const measure1 = queryResponse.fields.measures[0];
    const measure2 = queryResponse.fields.measures[1];
    const fields = [dimension, measure1, measure2];

    // Get the special string from the configuration options, provided by the user
    const specialString = config.highlightString;

    // --- Begin building HTML ---

    let style = `
      <style>
        .conditional-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
          font-family: 'Google Sans', 'Noto Sans', 'Noto Sans JP', 'Noto Sans CJK KR', 'Noto Sans Arabic UI', 'Noto Sans Devanagari UI', 'Noto Sans Hebrew', 'Noto Sans Thai UI', Helvetica, Arial, sans-serif;
        }
        .conditional-table th, .conditional-table td {
          padding: 8px 12px;
          border: 1px solid #ddd;
          text-align: left;
          white-space: nowrap;
        }
        .conditional-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        .highlight-row {
          background-color: ${config.highlightColor};
        }
        .base-row {
          background-color: ${config.baseColor};
        }
      </style>
    `;

    let html = `${style}<table class="conditional-table">`;

    // Build the table header
    html += `<thead><tr>`;
    fields.forEach(field => {
      html += `<th>${field.label}</th>`;
    });
    html += `</tr></thead>`;

    // Build the table body
    html += `<tbody>`;
    data.forEach(row => {
      // Get the rendered value of the dimension cell
      const dimValue = LookerCharts.Utils.textForCell(row[dimension.name]);
      
      // Check if the special string is defined (not empty) AND if the dimension value includes it.
      const isHighlighted = specialString && dimValue.includes(specialString);
      const rowClass = isHighlighted ? 'highlight-row' : 'base-row';

      html += `<tr class="${rowClass}">`;
      fields.forEach(field => {
        html += `<td>${LookerCharts.Utils.textForCell(row[field.name])}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody>`;
    html += `</table>`;

    // Render the table to the container
    this._container.innerHTML = html;

    // Signal to Looker that rendering is complete
    done();
  }
});