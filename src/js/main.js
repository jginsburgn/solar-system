let camera = undefined;
let renderer = undefined;
let controls = undefined;
let universe = undefined;
let target = undefined;

function createCamera() {
  camera = new THREE.OrthographicCamera();
  camera.lookAt(0, 0, 0);
}

function createRenderer() {
  renderer = new THREE.WebGLRenderer();
  renderer.autoClear = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap = THREE.PCFShadowMap;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $("#canvas-holder").append(renderer.domElement);
}

function createControls() {
  controls = new THREE.OrbitControls(camera, $("canvas").get(0));
}

const cameraDisplacement = new THREE.Vector3(0, 1, 50);
function updateCamera(fieldOfView) {
  if (!fieldOfView) {
    fieldOfView = 2;
  }
  const parent = $("#canvas-holder");
  const width = parent.width();
  const height = parent.height();
  const ratio = width / height;
  camera.left = -fieldOfView / 2 * ratio;
  camera.right = fieldOfView / 2 * ratio;
  camera.top = fieldOfView / 2;
  camera.bottom = -fieldOfView / 2;
  camera.near = 0;
  camera.far = cameraDisplacement.z * 3;
  camera.updateProjectionMatrix();
}

function flyCamera(target) {
  const targetPosition = target.getPosition();
  const cameraPosition = targetPosition.clone();
  updateCamera(target.radius * 10);
  cameraPosition.z = target.radius;
  cameraPosition.add(cameraDisplacement);
  camera.position.copy(cameraPosition);
  camera.lookAt(target.getPosition());
  camera.updateProjectionMatrix();
  controls.target = targetPosition;
  controls.update();
}

function updateRenderer() {
  const parent = $("#canvas-holder");
  const width = parent.width();
  const height = parent.height();
  renderer.setSize(width, height);
}

function bootSequence() {
  createCamera();
  createRenderer()
  createControls();
  updateCamera();
  updateRenderer();
}

function loadAstrosInfo(path, cb) {
  $.get(path, function (data) {
    cb(data);
  });
}

function centerCameraOn(target) {
  const targetPosition = target.getPosition && target.getPosition() || target.position;
  controls.target = targetPosition;
  controls.update();
}

function startAnimationLoop() {
  animate = function (time) {
    universe.tick(time);
    centerCameraOn(target);
    renderer.render(universe.threeScene, camera);
    requestAnimationFrame(animate);
  }
  animate(0);
}

function main() {
  bootSequence();

  universe = new Universe();

  loadAstrosInfo("src/js/astro-info.json", async function (astrosInfo) {
    const sunInfo = astrosInfo.sun;
    const sun = await Astro.FromInfo("sun", sunInfo);
    sun.isDone();
    $("#loading-holder").remove();
    universe.addAstro(sun);
    target = sun;
    flyCamera(target);
    startAnimationLoop();
    const tree = sun.getTreeInfo();
    buildTree(tree, function (_, action) {
      const astroName = action.node.text;
      const newTarget = sun.searchForAstro(astroName);
      target = newTarget;
      flyCamera(target);
    });
  });
}

window.addEventListener(
  "resize",
  function () {
    updateCamera();
    updateRenderer();
    flyCamera(target);
  },
  false
);

