class Universe {
  constructor() {
    this.threeScene = new THREE.Scene();
    this.astros = [];
    this.pastTime = 0;
  }

  static _realToUniverseTime(time) {
    // Time given in milliseconds
    // Return value must be in years
    // return time / 1000 / 365 / 24 / 60; // Each second is a minute
    return time / 1000 / 365 / 24; // Each second is an hour
    // return time / 1000 / 365; // Each second is a day
    // return time / 1000 / 365 * 10 // Each second is ten days;
    // return time / 1000 / 365 * 30 // Each second is thirty days;
    // return time / 3.154E10; // Each second is a second
  }

  addAstro(astro) {
    this.astros.push(astro);
    this.threeScene.add(astro.getObject());
  }

  addObject(object) {
    this.threeScene.add(object);
  }

  tick(time) {
    const timeDelta = Universe._realToUniverseTime(time - this.pastTime);
    for (let astro of this.astros) {
      astro.tick(timeDelta);
    }
    this.pastTime = time;
  }
}