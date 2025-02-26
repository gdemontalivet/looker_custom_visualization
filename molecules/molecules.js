looker.plugins.visualizations.add({
  id: "smiles_visualization",
  label: "SMILES Visualization",
  options: {
    // Add any configuration options if needed
  },
  create: function(element, config) {
    // Create a container to hold the molecule renderings.
    element.innerHTML = "<div id='smiles_container'></div>";
  },
  update: function(data, element, config, queryResponse) {
    // Clear the container for fresh rendering.
    const container = element.querySelector("#smiles_container");
    container.innerHTML = "";

    // Loop through each data row.
    data.forEach(function(row) {
      // Assume your SMILES string is in a field called 'smiles_field'
      const smiles = row['smiles_field'].value;

      // Create a canvas element for the rendering.
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 200;
      container.appendChild(canvas);

      // Parse and render the SMILES string.
      SmilesDrawer.parse(smiles, function(tree) {
        const drawer = new SmilesDrawer.Drawer({width: 200, height: 200});
        drawer.draw(tree, canvas, "light", false);
      }, function(err) {
        console.error("Error parsing SMILES: ", err);
      });
    });
  }
});
