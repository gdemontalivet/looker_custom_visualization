looker.plugins.visualizations.add({
  options: {
    point_size: {
      type: "number",
      label: "Point Size",
      default: 10,
      section: "Style"
    },
    point_color: {
      type: "string",
      label: "Point Color",
      default: "#ff0000",
      display: "color",
      section: "Style"
    },
    background_color: {
      type: "string",
      label: "Background Color",
      default: "#ffffff",
      display: "color",
      section: "Style"
    }
  },

  create: function(element, config) {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'absolute';
    element.style.height = '400px';
    element.appendChild(container);

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.padding = '8px';
    this.tooltip.style.background = 'rgba(0,0,0,0.8)';
    this.tooltip.style.color = 'white';
    this.tooltip.style.borderRadius = '4px';
    this.tooltip.style.fontSize = '12px';
    this.tooltip.style.pointerEvents = 'none'; // Prevent tooltip from interfering with mouse events
    this.tooltip.style.display = 'none';
    this.tooltip.style.zIndex = '1000';
    container.appendChild(this.tooltip);

    this.container = container;
    this.initThreeJS();
  },

  initThreeJS: function() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // Camera setup
    this.cameraDistance = Math.sqrt(108);
    this.spherical = new THREE.Spherical(
      this.cameraDistance,
      Math.PI/4,
      Math.PI/4
    );
    this.updateCameraPosition();

    // Raycaster for tooltips
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.1; // Adjust picking precision
    this.mouse = new THREE.Vector2();

    // Mouse controls for rotation
    this.isMouseDown = false;
    this.mousePosition = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isMouseDown = true;
      this.mousePosition.x = e.clientX;
      this.mousePosition.y = e.clientY;
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      e.preventDefault();

      if (this.isMouseDown) {
        const deltaX = e.clientX - this.mousePosition.x;
        const deltaY = e.clientY - this.mousePosition.y;

        this.spherical.theta -= deltaX * 0.01;
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi - deltaY * 0.01));

        this.updateCameraPosition();

        this.mousePosition.x = e.clientX;
        this.mousePosition.y = e.clientY;

        // Hide tooltip during rotation
        this.tooltip.style.display = 'none';
      } else {
        // Update tooltip
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.updateTooltip(e.clientX, e.clientY);
      }
    });

    this.renderer.domElement.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY);
      const zoomSpeed = 0.1;
      this.spherical.radius = Math.max(2, Math.min(20, this.spherical.radius * (1 - delta * zoomSpeed)));
      this.updateCameraPosition();
    }, { passive: false });

    // Mouse leave handler
    this.renderer.domElement.addEventListener('mouseleave', () => {
      this.tooltip.style.display = 'none';
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);

    window.addEventListener('resize', this.handleResize.bind(this));

    this.animate();
  },

  updateTooltip: function(x, y) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.points);

    if (intersects.length > 0) {
      const point = intersects[0];
      const position = point.point;
      const index = point.index;
      const data = this.pointsData[index];

      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (x + 10) + 'px';
      this.tooltip.style.top = (y + 10) + 'px';
      this.tooltip.innerHTML = `
        x: ${data.x.toFixed(2)}<br>
        y: ${data.y.toFixed(2)}<br>
        z: ${data.z.toFixed(2)}
      `;
    } else {
      this.tooltip.style.display = 'none';
    }
  },

  updateCameraPosition: function() {
    const sinPhiRadius = Math.sin(this.spherical.phi) * this.spherical.radius;
    this.camera.position.set(
      sinPhiRadius * Math.sin(this.spherical.theta) + 2,
      this.spherical.radius * Math.cos(this.spherical.phi) + 2,
      sinPhiRadius * Math.cos(this.spherical.theta) + 2
    );
    this.camera.lookAt(2, 2, 2);
  },

  handleResize: function() {
    if (this.camera && this.renderer && this.container) {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  },

  animate: function() {
    requestAnimationFrame(this.animate.bind(this));
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (!this.scene || !data) {
      done();
      return;
    }

    // Update background color
    this.scene.background = new THREE.Color(config.background_color || '#ffffff');

    const toRemove = [];
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Light)) {
        toRemove.push(object);
      }
    });
    toRemove.forEach(object => this.scene.remove(object));

    try {
      // Store points data for tooltip
      this.pointsData = data.map(row => ({
        x: Number(row['cube.x']?.value) || 0,
        y: Number(row['cube.y']?.value) || 0,
        z: Number(row['cube.z']?.value) || 0
      }));

      const vertices = this.pointsData.map(p => new THREE.Vector3(p.x, p.y, p.z));

      const pointsGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
      const pointsMaterial = new THREE.PointsMaterial({
        size: Number(config.point_size) || 10,
        color: new THREE.Color(config.point_color || '#ff0000'),
        sizeAttenuation: false
      });
      this.points = new THREE.Points(pointsGeometry, pointsMaterial);
      this.scene.add(this.points);

      const axesHelper = new THREE.AxesHelper(5);
      this.scene.add(axesHelper);

    } catch (error) {
      console.error('Error updating visualization:', error);
    }

    done();
  }
});
