const ORBITS_WIDTH = Km2AU(0.001);

class Astro {
  static async FromInfo(name, info, dirname) {
    const currentInfo = {
      resourcesURL: undefined,
      radius: undefined,
      rotationalPeriod: undefined,
      obliquityToOrbit: undefined,
    };
    if (info.anchor) {
      Object.assign(currentInfo, {
        anchor: undefined,
      });
    }
    else {
      Object.assign(currentInfo, {
        orbitalRadius: undefined,
        orbitalPeriod: undefined,
        orbitalAzimuth: undefined,
        orbitalColor: undefined,
        orbitalInclination: undefined,
      });
    }
    for (let property in currentInfo) {
      currentInfo[property] = info[property];
    }
    const transforms = {
      radius: Km2AU,
      rotationalPeriod: h2Y,
      orbitalRadius: Km2AU,
      orbitalPeriod: h2Y,
      orbitalColor: RGB2Percentage,
    }
    for (let transform in transforms) {
      if (currentInfo[transform]) {
        currentInfo[transform] = transforms[transform](currentInfo[transform]);
      }
    }
    if (!currentInfo.name) {
      currentInfo.name = name;
    }
    if (!currentInfo.resourcesURL) {
      currentInfo.resourcesURL = `${dirname}/${currentInfo.name}`;
    }
    if (info.rings) {
      info.rings.innerRadius = Km2AU(info.rings.innerRadius);
      info.rings.outerRadius = Km2AU(info.rings.outerRadius);
      currentInfo.rings = info.rings;
    }
    if (info.light) {
      currentInfo.light = info.light;
    }
    if (info.model) {
      currentInfo.model = info.model;
    }
    const astro = new Astro(currentInfo);
    await astro.isDone();
    if (info.orbiters) {
      for (let orbiterName in info.orbiters) {
        const orbiterInfo = info.orbiters[orbiterName];
        const orbiter = await Astro.FromInfo(orbiterName, orbiterInfo, `${currentInfo.resourcesURL}/orbiters`);
        astro.addOrbiter(orbiter);
      }
    }
    return astro;
  }

  constructor(properties) {
    this.stillWaiting = true;
    this.waiters = [];
    Object.assign(this, properties);
    this.orbiters = [];
    this._buildSequence();
  }

  _digestWaiters() {
    this.stillWaiting = false;
    let waiter = undefined;
    while (waiter = this.waiters.pop()) {
      waiter();
    }
  }

  async _buildGeometry() {
    this.stillWaiting = true;
    return new Promise(
      (resolve, reject) => {
        if (this.model) {
          switch (this.model) {
            case "obj":
              const modelLoader = new THREE.OBJLoader();
              modelLoader.load(
                `${this.resourcesURL}/geometry/model.obj`,
                (model) => {
                  const bufferGeometry = model.children[0].geometry;
                  this.geometry = new THREE.Geometry();
                  this.geometry.fromBufferGeometry(bufferGeometry);
                  this.geometry.computeBoundingSphere();
                  const boundingSphere = this.geometry.boundingSphere;
                  const boundingRadius = boundingSphere.radius;
                  const scaleFactor = this.radius / boundingRadius;
                  this.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
                  this._digestWaiters();
                  resolve();
                },
                undefined,
                (error) => {
                  reject(error);
                }
              );
              break;
            default:
              break;
          }
        }
        else {
          this.geometry = new THREE.SphereBufferGeometry(this.radius, 100, 100);
          this._digestWaiters();
          resolve();
        }
      }
    );
  }

  _buildMaterial() {
    const textureLoader = new THREE.TextureLoader();
    const map = textureLoader.load(`${this.resourcesURL}/textures/texture.jpg`);
    const specularMap = textureLoader.load(`${this.resourcesURL}/textures/specular.jpg`);
    const bumpMap = textureLoader.load(`${this.resourcesURL}/textures/bump.jpg`);
    if (this.light) {
      this.material = new THREE.MeshBasicMaterial({
        map,
        specularMap,
        side: THREE.FrontSide,
        shadowSide: THREE.DoubleSide,
      });
    }
    else {
      this.material = new THREE.MeshPhongMaterial({
        shininess: 1,
        map,
        specularMap,
        bumpMap,
        bumpScale: 0,
        side: THREE.FrontSide,
        shadowSide: THREE.DoubleSide,
      });
    }
  }

  _buildObject() {
    if (this.light) {
      const light = new THREE.PointLight(0xffffff, 1.1, 0);
      light.castShadow = true;
      const sphere = new THREE.Mesh(this.geometry, this.material);
      light.add(sphere);
      this.threeObject = light;
    }
    else {
      this.threeObject = new THREE.Mesh(this.geometry, this.material);
      this.threeObject.castShadow = true;
      this.threeObject.receiveShadow = true;
    }
  }

  _buildRings() {
    const inner = this.rings.innerRadius;
    const outer = this.rings.outerRadius;
    const geometry = new THREE.RingGeometry(inner, outer, 100);

    const faces = geometry.faces;
    const vertices = geometry.vertices;
    const vertexNames = ["a", "b", "c"];

    const uvs = [];

    const fullAngle = Math.PI * 2;

    for (let i = 0; i < faces.length; i++) {

      const face = faces[i];
      const subUVs = [];
      for (let vertexName of vertexNames) {
        const currentVertex = vertices[face[vertexName]];
        let theta = Math.atan2(currentVertex.y, currentVertex.x);
        if (theta < 0) {
          theta = Math.PI - theta;
        }
        const r = (Math.sqrt(currentVertex.x ** 2 + currentVertex.y ** 2) - inner) / (outer - inner);
        subUVs.push(new THREE.Vector2(r, theta / fullAngle));
      }

      uvs.push(subUVs);
    }

    geometry.faceVertexUvs[0] = uvs;
    geometry.faceVertexUvs[1] = uvs;
    geometry.uvsNeedUpdate = true;
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(`${this.resourcesURL}/textures/ring-texture.jpg`);
    texture.mapping = THREE.SphericalReflectionMapping;
    const transparency = textureLoader.load(`${this.resourcesURL}/textures/ring-transparency.gif`);
    const material = new THREE.MeshPhongMaterial({ map: texture, alphaMap: transparency, side: THREE.DoubleSide });
    material.transparent = true;
    const rings = new THREE.Mesh(geometry, material);
    rings.castShadow = true;
    rings.receiveShadow = true;
    rings.rotateX(º2r(90));
    this.astroParent.add(rings);
  }

  async _buildSequence() {
    await this._buildGeometry();
    this._buildMaterial();
    this._buildObject();

    this.astroRoot = new THREE.Group();

    if (this.anchor) {
      const anchor = new THREE.Vector3();
      anchor.fromArray(this.anchor);
      this.astroRoot.position.copy(anchor);
    }

    this.astroParent = new THREE.Group();

    this.astroRoot.add(this.astroParent);
    this.astroParent.add(this.threeObject);

    this.astroParent.rotateZ(º2r(this.obliquityToOrbit));

    if (this.rings) {
      this._buildRings();
    }
  }

  _addOrbit(astro) {
    const orbitRadius = astro.orbitalRadius;
    const inner = orbitRadius - ORBITS_WIDTH / 2;
    const outer = orbitRadius + ORBITS_WIDTH / 2;
    const geometry = new THREE.RingBufferGeometry(inner, outer, Math.max(Math.floor(1000 * orbitRadius), 1000));
    const color = new THREE.Color(...astro.orbitalColor);
    const material = new THREE.PointsMaterial({ color, size: 1.5, opacity: 0.1 });
    const orbit = new THREE.Line(geometry, material);
    orbit.rotateX(º2r(90));
    orbit.rotateY(º2r(astro.orbitalInclination));
    this.astroRoot.add(orbit);
    return orbit;
  }

  async isDone() {
    return new Promise((resolve, _) => {
      if (this.stillWaiting) {
        this.waiters.push(resolve);
      }
      else {
        resolve();
      }
    });
  }

  getObject() {
    return this.astroRoot;
  }

  getPosition() {
    const position = new THREE.Vector3();
    this.astroRoot.getWorldPosition(position);
    return position;
  }

  addOrbiter(orbiter) {
    const orbiterObject = orbiter.getObject();
    const orbiterParent = new THREE.Group();
    const localPosition = new THREE.Vector3(orbiter.orbitalRadius, 0, 0);
    orbiterObject.position.copy(localPosition);
    orbiterParent.add(orbiterObject);
    orbiterParent.rotateZ(º2r(orbiter.orbitalInclination));
    orbiterParent.rotateY(º2r(orbiter.orbitalAzimuth));
    const orbit = this._addOrbit(orbiter);
    this.astroRoot.add(orbiterParent);
    this.orbiters.push({ orbiter, orbiterParent, orbit });
  }

  getTreeInfo() {
    const root = { text: this.name, children: [] };
    for (let orbiter of this.orbiters) {
      root.children.push(orbiter.orbiter.getTreeInfo());
    }
    return root;
  }

  searchForAstro(name) {
    if (name == this.name) {
      return this;
    }
    else {
      for (let orbiter of this.orbiters) {
        const searchResult = orbiter.orbiter.searchForAstro(name);
        if (searchResult) {
          return searchResult;
        }
      }
    }
    return undefined;
  }

  tick(timeDelta) {
    this.threeObject.rotateY(º2r(timeDelta * 360 / this.rotationalPeriod));
    for (let orbiter of this.orbiters) {
      const angleDelta = º2r(timeDelta * 360 / orbiter.orbiter.orbitalPeriod);
      orbiter.orbiterParent.rotateY(angleDelta);
      orbiter.orbiter.tick(timeDelta);
    }
  }
}