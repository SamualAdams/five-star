import * as THREE from 'three';

// Render the can in two layers so the fire and paper pass behind its front wall.
export function createTrashCan(backHost, frontHost) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.6923, 2.6923, 2.5, -2.5, .1, 40);
  camera.position.set(0, 5.4, 9);
  camera.lookAt(0, 1.4, 0);
  const renderers = [backHost, frontHost].map(host => {
    // No multisampling on 2x+ screens: it quadruples these large buffers (~190 MB for
    // the pair on a phone) to smooth edges the pixel density already hides.
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: devicePixelRatio < 2 });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(840, 780);
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);
    return renderer;
  });
  scene.add(new THREE.HemisphereLight('#eef1ff', '#55565a', 2.3));
  const key = new THREE.DirectionalLight('#ffffff', 3.4);
  key.position.set(-3, 5, 5); scene.add(key);
  const edge = new THREE.DirectionalLight('#d2dce8', 2.3);
  edge.position.set(4, 3, -2); scene.add(edge);
  const warm = new THREE.PointLight('#ff9f59', 2.5, 6);
  warm.position.set(0, .55, .15); scene.add(warm);
  const root = new THREE.Group(); scene.add(root);
  const rear = new THREE.Group(), front = new THREE.Group();
  root.add(rear, front);
  const metal = new THREE.MeshStandardMaterial({ color: '#8c979d', metalness: .52, roughness: .47 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: '#b3babc', metalness: .65, roughness: .34 });
  const innerMaterial = new THREE.MeshStandardMaterial({ color: '#272d30', metalness: .35, roughness: .7, side: THREE.BackSide });
  function mesh(geometry, material, parent = rear) {
    const object = new THREE.Mesh(geometry, material); parent.add(object); return object;
  }
  function ring(radius, tube, y, parent = rear, arc = Math.PI * 2) {
    const object = mesh(new THREE.TorusGeometry(radius, tube, 10, 80, arc), rimMaterial, parent);
    object.rotation.x = Math.PI / 2; object.position.y = y; return object;
  }
  function corrugatedShell(frontHalf = false) {
    const geometry = new THREE.CylinderGeometry(.91, .71, 1.95, frontHalf ? 144 : 288, 16, true, frontHalf ? -Math.PI / 2 : 0, frontHalf ? Math.PI : Math.PI * 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const radius = Math.hypot(x, z);
      const taper = Math.pow(Math.max(0, Math.sin((y + .975) / 1.95 * Math.PI)), .45);
      const corrugation = .016 * Math.cos(Math.atan2(x, z) * 36) * taper;
      positions.setXYZ(i, x * (1 + corrugation / radius), y, z * (1 + corrugation / radius));
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  mesh(corrugatedShell(), metal);
  mesh(new THREE.CylinderGeometry(.89, .69, 1.94, 80, 1, true), innerMaterial);
  const bottom = mesh(new THREE.CylinderGeometry(.70, .70, .035, 64), new THREE.MeshStandardMaterial({ color: '#1b2023', roughness: .85 }));
  bottom.position.y = -.965;
  ring(.91, .035, .98); ring(.715, .032, -.97); ring(.73, .02, -.86);
  // The camera-facing half provides real geometric occlusion of the falling cards.
  mesh(corrugatedShell(true), metal, front);
  ring(.91, .035, .98, front, Math.PI);
  ring(.715, .032, -.97, front, Math.PI);
  ring(.73, .02, -.86, front, Math.PI);
  for (const side of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(.16, .032, 10, 28, Math.PI * 1.5), rimMaterial);
    handle.position.set(side * .93, .52, 0); handle.rotation.y = Math.PI / 2; handle.rotation.z = Math.PI / 4;
  }
  // A loose metal lid lifts clear and settles onto the rolled rim.
  const lid = new THREE.Group(); rear.add(lid);
  mesh(new THREE.CylinderGeometry(.945, .96, .065, 80), rimMaterial, lid);
  const top = mesh(new THREE.ConeGeometry(.94, .13, 80), metal, lid); top.position.y = .095;
  ring(.949, .025, .03, lid);
  const grip = mesh(new THREE.TorusGeometry(.17, .035, 12, 32, Math.PI), rimMaterial, lid); grip.position.y = .16;
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  let lastProgress = -1;
  return {
    render(progress) {
      if (Math.abs(progress - lastProgress) < .00005) return;
      lastProgress = progress;
      root.position.y = -5 * (1 - smooth(progress / .24));
      const close = smooth((progress - .64) / .13);
      const open = 1 - close;
      lid.position.set(-.12 * open, 1.055 + 1.12 * open, -.38 * open);
      lid.rotation.set(-.18 * open, 0, -.10 * open);
      // Render a closing lid with the front shell for proper rim/lid depth.
      const lidLayer = close > 0 ? front : rear;
      if (lid.parent !== lidLayer) lidLayer.add(lid);
      warm.intensity = 1.3 * (1 - smooth((progress - .55) / .15));
      rear.visible = true; front.visible = false;
      renderers[0].render(scene, camera);
      rear.visible = false; front.visible = true;
      renderers[1].render(scene, camera);
    },
    dispose() {
      renderers.forEach(renderer => {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      });
    }
  };
}
