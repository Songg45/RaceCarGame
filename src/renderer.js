import * as THREE from 'three';
import { sampleTrack } from './simulation.js';

const colors = { grass: 0x6e8856, asphalt: 0x343c43, concrete: 0xb1b3a8, yellow: 0xf4cb48 };
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.77, ...extra });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function textTexture(text, bg = '#101b28', fg = '#ffffff', width = 512, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = fg;
  let fontSize = height * .61;
  ctx.font = `900 italic ${fontSize}px Arial`;
  while (ctx.measureText(text).width > width * .93 && fontSize > 10) { fontSize -= 2; ctx.font = `900 italic ${fontSize}px Arial`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, width / 2, height * 0.54);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roadTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#3d4245'; ctx.fillRect(0, 0, 256, 256);
  let seed = 119;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 11000; i++) {
    const v = Math.floor(45 + rand() * 48); ctx.fillStyle = `rgba(${v},${v},${v},.3)`;
    ctx.fillRect(rand() * 256, rand() * 256, 1.5, 1.5);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class RaceRenderer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa9c5d0);
    this.scene.fog = new THREE.Fog(0xa9c5d0, 1400, 6200);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.2, 16000);
    this.contextLost = false; this.needsRender = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Live 3D racing track');
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true; this.needsRender = false;
      window.dispatchEvent(new CustomEvent('race-graphics-lost'));
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false; this.cameraReady = false; this.resize(); this.needsRender = true;
      window.dispatchEvent(new CustomEvent('race-graphics-restored'));
    });
    this.scene.add(new THREE.HemisphereLight(0xd9edff, 0x556335, 2.4));
    this.sun = new THREE.DirectionalLight(0xffefd3, 3.5);
    this.sun.position.set(-180, 350, 240);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 1000 });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    this.environment = new THREE.Group(); this.scene.add(this.environment);
    this.carGroup = new THREE.Group(); this.scene.add(this.carGroup);
    this.carMeshes = new Map(); this.mode = 'chase'; this.cameraReady = false;
    this.lookAt = new THREE.Vector3(); this.desiredLook = new THREE.Vector3();
    this.focusPosition = new THREE.Vector3(); this.focusDisplacement = new THREE.Vector3();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.resize();
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!this.contextLost) this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(height, 1); this.camera.updateProjectionMatrix(); this.needsRender = true;
  }

  ribbon(track, inner, outer, material, elevation = 0.03, segments = 720, startS = 0, endS = track.length) {
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      for (const lateral of [inner, outer]) {
        const s = startS + (endS - startS) * i / segments;
        const p = sampleTrack(track, s, lateral);
        positions.push(p.x, p.y + elevation, p.z); uvs.push(lateral / 8, s / 8);
      }
      if (i < segments) {
        const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true; this.environment.add(mesh); return mesh;
  }

  placeTrack(mesh, s, lateral, y = 0) {
    const p = sampleTrack(this.track, s, lateral);
    mesh.position.set(p.x, p.y + y, p.z); mesh.rotation.y = p.heading;
    this.environment.add(mesh); return mesh;
  }

  setRace(sim) {
    this.track = sim.track;
    const oldGeometries = new Set(), oldMaterials = new Set(), oldTextures = new Set();
    for (const root of [this.environment, this.carGroup]) {
      root.traverse(object => {
        if (object.geometry) oldGeometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
          oldMaterials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) oldTextures.add(value);
        }
      });
      root.clear();
    }
    for (const texture of oldTextures) texture.dispose();
    for (const material of oldMaterials) material.dispose();
    for (const geometry of oldGeometries) geometry.dispose();
    this.carMeshes.clear();
    const track = this.track, half = track.width / 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(22000, 22000), mat(colors.grass));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.12; ground.receiveShadow = true; this.environment.add(ground);
    // An infield grass ribbon meets the banked racing surface without a visible hole.
    this.ribbon(track, -Math.min(track.radius - 2, 120), -half, mat(0x6e8856), -0.08);
    this.ribbon(track, -half - 4, -half, mat(0x829459), 0);
    this.ribbon(track, -half, half, mat(0xa8afb2, { map: roadTexture(), side: THREE.DoubleSide }));
    this.ribbon(track, half, half + 2, mat(0xbcc0b4));
    this.ribbon(track, -half + .6, -half + .8, mat(0xf6d251), .07);
    this.ribbon(track, half - .65, half - .45, mat(0xe7e8df), .07);
    // Subtle lane markers are sparse to keep the racing surface visually quiet.
    const laneMaterial = mat(0xc9cbbd);
    for (let s = 0; s < track.length; s += 30) {
      for (const lateral of [-half / 3, half / 3]) {
        const marker = box(.12, .025, 7, laneMaterial);
        this.placeTrack(marker, s, lateral, .09);
      }
    }
    const barrierMat = mat(0xd4d7ca), stripeMat = mat(0x294a60), fenceMat = mat(0x647b82);
    const barrierSegments = Math.ceil(track.length / 16);
    for (let i = 0; i < barrierSegments; i++) {
      const s = i / barrierSegments * track.length;
      this.placeTrack(box(.8, 1.4, track.length / barrierSegments + .15, i % 7 === 0 ? stripeMat : barrierMat), s, half + 1.2, .7);
      if (i % 3 === 0) this.placeTrack(box(.15, 5, .15, fenceMat), s, half + 1.7, 2.5);
    }
    // Checkered start / finish stripe, and a sponsor-free race gantry.
    for (let row = 0; row < 4; row++) {
      for (let lane = 0; lane < Math.ceil(track.width); lane++) {
        const tile = box(.98, .035, .98, mat((row + lane) % 2 ? 0x1b232c : 0xf1f0dc));
        this.placeTrack(tile, row - 1.5, -half + lane + .5, .13);
      }
    }
    for (const lateral of [-half - 1, half + 4]) this.placeTrack(box(.9, 13, 1, mat(0x2a3a46)), -8, lateral, 6.5);
    const gantry = box(track.width + 8, 3, .7, mat(0x132431));
    this.placeTrack(gantry, -8, 1.5, 12);
    const gantryText = new THREE.Mesh(new THREE.PlaneGeometry(track.width + 6, 2.4), new THREE.MeshBasicMaterial({ map: textTexture('SPLIT / GRID', '#132431', '#e8f95a') }));
    this.placeTrack(gantryText, -8.5, 1.5, 12); gantryText.rotateY(Math.PI);
    // Grandstands follow the outside of both straights. Roofs frame the track at driver height.
    const standMat = mat(0x899ba2), seatsMat = mat(0x274c60), roofMat = mat(0x354b58);
    const standCount = Math.max(2, Math.floor(track.straightLength / 130));
    for (const opposite of [0, .5]) {
      for (let i = 0; i < standCount; i++) {
        const s = opposite * track.length + (i - (standCount - 1) / 2) * 112;
        const stand = new THREE.Group();
        for (let row = 0; row < 5; row++) {
          stand.add(box(5.5, 2.2 + row * 2.8, 100, row % 2 ? standMat : seatsMat, 4 + row * 5, (2.2 + row * 2.8) / 2, 0));
        }
        stand.add(box(33, .8, 108, roofMat, 14, 18, 0));
        this.placeTrack(stand, s, half + 23, 0); stand.rotateY(Math.PI);
      }
    }
    // Infield garages and a pit lane visually anchor this as a working oval circuit.
    const pitSpec = sim.pit;
    const pitLength = pitSpec.exitS - pitSpec.entryS;
    const pitInner = pitSpec.innerLateral ?? pitSpec.lateral - pitSpec.width / 2;
    const through = pitSpec.throughLateral ?? pitSpec.lateral;
    const throughWidth = pitSpec.throughWidth || 7;
    const strip = (inner, outer, start, end, material, elevation = .09) => this.ribbon(track, inner, outer, material, elevation, Math.max(2, Math.ceil((end - start) / 3)), start, end);
    strip(pitInner, -half, pitSpec.entryS, pitSpec.exitS, mat(0x59615d), .045);
    strip(through - throughWidth / 2, through + throughWidth / 2, pitSpec.entryS, pitSpec.exitS, mat(0x3c5559), .07);
    const pitLineMat = mat(0x69d6bf);
    strip(pitInner + .2, pitInner + .4, pitSpec.entryS, pitSpec.exitS, pitLineMat);
    strip(-half - .5, -half - .3, pitSpec.entryS, pitSpec.exitS, mat(0xdfdfaf));
    for (let s = pitSpec.entryS + 8; s < pitSpec.exitS - 8; s += 20) {
      strip(through - throughWidth / 2 - .05, through - throughWidth / 2 + .08, s, s + 8, pitLineMat, .1);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(.6, 2.8, 3), mat(0xc2dbcc));
      arrow.rotation.x = Math.PI / 2;
      const direction = new THREE.Group(); direction.add(arrow); this.placeTrack(direction, s, through, .14); direction.scale.y = .035;
    }
    this.bayVisuals = new Map();
    const bays = pitSpec.bays || [{ id: 'bay-01', carId: sim.player.id, number: 1, s: pitSpec.bayS, lateral: pitSpec.lateral, width: pitSpec.width, length: pitSpec.bayLength }];
    for (const bay of bays) {
      const start = bay.s - bay.length / 2, end = bay.s + bay.length / 2;
      const fill = mat(0x27595b);
      strip(bay.lateral - bay.width / 2, bay.lateral + bay.width / 2, start, end, fill, .08);
      for (const lateral of [bay.lateral - bay.width / 2 + .12, bay.lateral + bay.width / 2 - .12]) strip(lateral - .07, lateral + .07, start, end, pitLineMat, .11);
      for (const s of [start, end]) strip(bay.lateral - bay.width / 2, bay.lateral + bay.width / 2, s - .1, s + .1, pitLineMat, .11);
      const owner = sim.cars.find(car => car.id === bay.carId);
      const carLength = owner?.spec?.length || 5, carWidth = owner?.spec?.width || 2;
      const outlineLength = carLength + .8, outlineWidth = carWidth + .8;
      const parkingMark = mat(0xb9d8bd);
      for (const lateral of [bay.lateral - outlineWidth / 2, bay.lateral + outlineWidth / 2]) strip(lateral - .045, lateral + .045, bay.s - outlineLength / 2, bay.s + outlineLength / 2, parkingMark, .13);
      for (const s of [bay.s - outlineLength / 2, bay.s + outlineLength / 2]) strip(bay.lateral - outlineWidth / 2, bay.lateral + outlineWidth / 2, s - .045, s + .045, parkingMark, .13);
      // The cross marks the actual vehicle-origin target, not its front bumper.
      strip(bay.lateral - .04, bay.lateral + .04, bay.s - .6, bay.s + .6, parkingMark, .14);
      strip(bay.lateral - .5, bay.lateral + .5, bay.s - .04, bay.s + .04, parkingMark, .14);
      const stopS = bay.s + carLength / 2 + .4;
      strip(bay.lateral - outlineWidth / 2 - .4, bay.lateral + outlineWidth / 2 + .4, stopS - .09, stopS + .09, mat(0xf0d473), .15);
      const label = `${String(bay.number).padStart(2, '0')} / #${owner?.number ?? '?'}`;
      const labelMat = new THREE.MeshBasicMaterial({ map: textTexture(label, '#27595b', '#d4f6df') });
      const groundLabel = new THREE.Mesh(new THREE.PlaneGeometry(bay.width - .7, 2.3), labelMat);
      groundLabel.rotation.set(-Math.PI / 2, 0, Math.PI);
      const labelGroup = new THREE.Group(); labelGroup.add(groundLabel); this.placeTrack(labelGroup, start + 1.5, bay.lateral, .16);
      const sign = new THREE.Group(); sign.add(box(.13, 3.4, .13, mat(0x668584), 0, 1.7, 0));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: textTexture(`BAY ${label}`, '#173f41', '#bcecd0'), side: THREE.DoubleSide }));
      face.position.y = 3.5; face.rotation.y = Math.PI; sign.add(face); this.placeTrack(sign, bay.s, pitInner - .6, 0);
      this.bayVisuals.set(bay.carId, { bay, fill, sign, center: sampleTrack(track, bay.s, bay.lateral), outlineLength, outlineWidth, stopS });
    }
    this.bayMarker = new THREE.Mesh(new THREE.ConeGeometry(.8, 2.3, 3), mat(0xe8f95a, { emissive: 0x919b29, emissiveIntensity: .45 }));
    this.bayMarker.rotation.z = Math.PI; this.environment.add(this.bayMarker);
    for (const [s, label] of [[pitSpec.entryS + 3, 'PIT ENTRY'], [pitSpec.exitS - 3, 'PIT EXIT']]) {
      const sign = new THREE.Group(); sign.add(box(.2, 4, .2, mat(0x5d8585), 0, 2, 0));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: textTexture(label, '#173f41', '#a4f3c6'), side: THREE.DoubleSide }));
      face.position.y = 4; face.rotation.y = Math.PI; sign.add(face); this.placeTrack(sign, s, pitInner - 1.5, 0);
    }
    for (let i = 0; i < Math.min(15, Math.floor(pitLength / 40)); i++) {
      const s = -pitLength / 2 + 24 + i * 40;
      if (sampleTrack(track, s).curvature > 0) continue;
      const garage = new THREE.Group();
      garage.add(box(15, 5, 30, mat(0xc6c7b7), 0, 2.5, 0));
      garage.add(box(17, .6, 32, mat(i % 3 === 0 ? 0xa44c3d : 0x566b73), 0, 5.4, 0));
      garage.add(box(.1, 3.4, 22, mat(0x233948), 7.55, 2, 0));
      this.placeTrack(garage, s, pitInner - 14, 0); garage.rotateY(Math.PI);
    }
    const innerLabel = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(170, track.radius), Math.min(42, track.radius / 3)), new THREE.MeshBasicMaterial({ map: textTexture('STOCK vs STREET', '#6e8856', '#d7e0b9'), transparent: false }));
    innerLabel.rotation.x = -Math.PI / 2; innerLabel.position.set(0, .02, 0); this.environment.add(innerLabel);
    // Light poles and distant trees give speed cues without expensive imported assets.
    const poleMat = mat(0x84949b), treeMat = mat(0x405f43);
    for (let s = 0; s < track.length; s += 160) {
      const pole = new THREE.Group(); pole.add(box(.6, 30, .6, poleMat, 0, 15, 0));
      pole.add(box(9, 1.4, 2, mat(0xeee8d1), 0, 30, 0)); this.placeTrack(pole, s, half + 70, 0); pole.position.y = -.12;
    }
    for (let i = 0; i < 90; i++) {
      const treeHeight = 23 + i % 7;
      const tree = new THREE.Mesh(new THREE.ConeGeometry(7 + i % 4, treeHeight, 6), treeMat);
      this.placeTrack(tree, i / 90 * track.length, half + 160 + (i % 5) * 32, 0);
      tree.position.y = treeHeight / 2 - .12;
    }
    for (const car of sim.cars) {
      const model = this.makeCar(car); this.carGroup.add(model); this.carMeshes.set(car.id, model);
      if (car.streetClassId === 'suv') {
        model.userData.roadside = this.makeRoadsideCrew(car);
        this.carGroup.add(model.userData.roadside);
      }
    }
    // Two instanced layers keep hundreds of visible potholes inexpensive to draw.
    const holeGeometry = new THREE.CircleGeometry(1, 13);
    const holes = new THREE.InstancedMesh(holeGeometry, mat(0x101719, { side: THREE.DoubleSide }), sim.potholes.length);
    const rims = new THREE.InstancedMesh(new THREE.RingGeometry(.78, 1, 13), mat(0x77786a, { side: THREE.DoubleSide }), sim.potholes.length);
    const holePose = new THREE.Object3D();
    for (const [i, hole] of sim.potholes.entries()) {
      const p = sampleTrack(track, hole.s, hole.lateral);
      holePose.position.set(p.x, p.y + .13, p.z); holePose.rotation.set(-Math.PI / 2, 0, -p.heading);
      // Normal follows the local cross-track bank rather than the flat world plane.
      const normal = new THREE.Vector3(-p.nx * Math.sin(p.banking), Math.cos(p.banking), -p.nz * Math.sin(p.banking));
      holePose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      holePose.scale.set(hole.radius * 1.1, hole.radius * 1.3, 1); holePose.updateMatrix(); rims.setMatrixAt(i, holePose.matrix);
      holePose.scale.set(hole.radius * .9, hole.radius * 1.06, 1); holePose.position.y += .015; holePose.updateMatrix(); holes.setMatrixAt(i, holePose.matrix);
    }
    holes.instanceMatrix.needsUpdate = true; rims.instanceMatrix.needsUpdate = true;
    this.environment.add(rims, holes);
    this.cameraReady = false; this.needsRender = true;
  }

  makeCar(car) {
    const group = new THREE.Group();
    const stock = car.classId === 'stock', truck = car.body === 'pickup', suv = car.streetClassId === 'suv' || car.body === 'suv' || car.body === 'van';
    const sports = car.streetClassId === 'sports', van = car.body === 'van';
    const bodyColor = new THREE.Color(car.color || (stock ? '#eac548' : '#dfe6df'));
    const paint = mat(bodyColor, { metalness: .26, roughness: .4 });
    const glass = mat(0x18313c, { metalness: .45, roughness: .22 });
    const dark = mat(0x111a21), wheelMat = mat(0x171c20), rimMat = mat(0xc2c7c9, { metalness: .6 });
    const width = car.spec?.width || (stock ? 2 : truck ? 2.04 : 1.82);
    const length = car.spec?.length || (stock ? 5 : truck ? 5.5 : 4.5);
    const height = van ? 1.45 : suv || truck ? 1.25 : sports ? .82 : .94;
    group.add(box(width, .62, length, paint, 0, .7, 0));
    group.add(box(width * .88, .18, length * .93, paint, 0, 1.06, 0));
    group.add(box(width * .79, height * .6, truck ? 2 : van ? 3.2 : 2.2, glass, 0, 1.22 + (height - .94) * .5, truck ? .35 : -.22));
    group.add(box(width * .82, .12, truck ? 1.9 : van ? 3 : 1.88, paint, 0, 1.53 + height - .94, truck ? .34 : -.24));
    if (suv) {
      group.add(box(width * .68, .04, 1.25, dark, 0, 1.17, length / 2 - .8));
      const hood = new THREE.Group(); hood.position.set(0, 1.22, length / 2 - 1.65);
      hood.add(box(width * .87, .08, 1.6, paint, 0, 0, .8)); group.add(hood); group.userData.hood = hood;
    }
    group.add(box(width + .04, .16, .17, dark, 0, .48, length / 2));
    group.add(box(width + .04, .16, .17, dark, 0, .48, -length / 2));
    const headlights = mat(stock ? 0xe6e6cd : 0xe8f0d5, { emissive: 0xa6ad7a, emissiveIntensity: .2 });
    for (const side of [-1, 1]) {
      group.add(box(.48, .18, .05, headlights, side * width * .32, .86, length / 2 + .01));
      group.add(box(.48, .17, .05, mat(0xc13d37, { emissive: 0x8e1111, emissiveIntensity: .3 }), side * width * .32, .85, -length / 2 - .01));
    }
    const wheels = [];
    for (const x of [-width / 2, width / 2]) for (const z of [-length * .31, length * .31]) {
      const carrier = new THREE.Group(); carrier.position.set(x, .42, z);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.39, .39, .23, 12), wheelMat); wheel.rotation.z = Math.PI / 2; carrier.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .242, 8), rimMat); rim.rotation.z = Math.PI / 2; carrier.add(rim);
      carrier.userData.id = `${z > 0 ? 'F' : 'R'}${x < 0 ? 'R' : 'L'}`;
      carrier.userData.side = x < 0 ? 1 : -1;
      carrier.userData.tire = wheel; carrier.userData.rim = rim;
      group.add(carrier); wheels.push(carrier);
    }
    if (stock) {
      group.add(box(width + .06, .27, .35, dark, 0, 1.25, -length / 2 + .28));
      group.add(box(.28, .04, length * .8, mat(0xf2eee0), .39, 1.17, 0));
      const decalMaterial = new THREE.MeshBasicMaterial({ map: textTexture(String(car.number), car.color || '#d8bc45', '#fffdf2', 128, 128), side: THREE.DoubleSide });
      for (const side of [-1, 1]) {
        const decal = new THREE.Mesh(new THREE.PlaneGeometry(1, .72), decalMaterial); decal.position.set(side * (width / 2 + .015), .84, -.2); decal.rotation.y = side * Math.PI / 2; group.add(decal);
      }
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.15), decalMaterial); top.rotation.x = -Math.PI / 2; top.position.set(0, 1.601, -.2); group.add(top);
    } else if (truck) {
      group.add(box(width * .77, .05, 1.8, dark, 0, 1.15, -1.55));
    } else if (sports) {
      group.add(box(width * .93, .12, .24, dark, 0, 1.2, -length / 2 + .26));
    }
    if (car.isPlayer) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.65, 2.8, 48), new THREE.MeshBasicMaterial({ color: 0xe8f95a, side: THREE.DoubleSide, transparent: true, opacity: .8 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .08; group.add(ring);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(.35, .85, 3), mat(0xe8f95a, { emissive: 0xa6af2d, emissiveIntensity: .5 }));
      arrow.rotation.z = Math.PI; arrow.position.y = 3.5; group.add(arrow);
    }
    const smoke = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(.6 + i * .22, 1), new THREE.MeshStandardMaterial({ color: 0x39414a, transparent: true, opacity: .58 - i * .08, roughness: 1 }));
      puff.position.set(.15 + i * .13, 1.8 + i * .8, 1.1 - i * .15); smoke.add(puff);
    }
    smoke.visible = false; group.add(smoke);
    group.userData.wheels = wheels; group.userData.paint = paint; group.userData.smoke = smoke; return group;
  }

  makeRoadsideCrew(car) {
    const crew = new THREE.Group(); crew.visible = false; crew.name = `roadside-${car.id}`;
    const amber = new THREE.MeshBasicMaterial({ color: 0xffc55d, toneMapped: false });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf6ba43, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = .065; crew.add(floor);
    const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.5, 0, -.5), new THREE.Vector3(.5, 0, -.5), new THREE.Vector3(.5, 0, .5), new THREE.Vector3(-.5, 0, .5),
    ]), new THREE.LineBasicMaterial({ color: 0xffd66f, toneMapped: false }));
    border.position.y = .085; crew.add(border);
    const coneGeometry = new THREE.ConeGeometry(.15, .45, 8), cones = [];
    for (let i = 0; i < 4; i++) { const cone = new THREE.Mesh(coneGeometry, amber); crew.add(cone); cones.push(cone); }
    const uniform = mat(0x294f68), vest = mat(0xf5bd42), boots = mat(0x17222c), skin = mat(0xc7956e), tool = mat(0xb5c2c4, { metalness: .5 });
    const mechanics = [];
    for (const [index, z] of [car.spec.length * .32, -car.spec.length * .32].entries()) {
      const mechanic = new THREE.Group(); mechanic.position.set(car.spec.width / 2 + .6, 0, z); mechanic.rotation.y = -Math.PI / 2;
      for (const x of [-.11, .11]) { mechanic.add(box(.15, .43, .17, uniform, x, .3, 0)); mechanic.add(box(.18, .12, .27, boots, x, .07, .04)); }
      mechanic.add(box(.43, .47, .28, uniform, 0, .75, 0));
      mechanic.add(box(.45, .32, .30, vest, 0, .8, 0));
      mechanic.add(box(.28, .28, .26, skin, 0, 1.12, .025));
      mechanic.add(box(.34, .13, .32, vest, 0, 1.3, .025));
      const arms = [];
      for (const x of [-.26, .26]) {
        const arm = new THREE.Group(); arm.position.set(x, .93, 0);
        arm.add(box(.13, .4, .14, uniform, 0, -.17, 0)); arm.add(box(.14, .13, .14, skin, 0, -.4, 0));
        arm.add(box(.06, .22, .06, tool, 0, -.43, .08)); mechanic.add(arm); arms.push(arm);
      }
      mechanic.userData.arms = arms; mechanic.userData.phase = index * Math.PI;
      crew.add(mechanic); mechanics.push(mechanic);
    }
    const jack = new THREE.Group(); jack.position.set(car.spec.width / 2 + .16, 0, car.spec.length * .31);
    jack.add(box(.45, .08, .5, boots, 0, .05, 0));
    const jackRam = box(.18, .45, .25, tool, 0, .3, 0); jack.add(jackRam);
    const handle = box(.06, .65, .06, tool, .17, .4, -.1); handle.rotation.z = -.4; jack.add(handle); crew.add(jack);
    crew.add(box(.42, .28, .55, mat(0xba5d3e), car.spec.width / 2 + .6, .16, 0));
    crew.userData = { floor, border, cones, mechanics, jackRam, handle, area: null, elapsed: 0 };
    return crew;
  }

  updateRoadsideCrew(car, mesh) {
    const crew = mesh.userData.roadside, mobile = car.mobileRepair;
    if (!crew) return;
    const active = mobile?.state === 'active' && mobile.area && !car.wrecked;
    crew.visible = Boolean(active);
    const phase = active ? Math.max(0, mobile.duration - mobile.remaining) : 0;
    if (mesh.userData.hood) mesh.userData.hood.rotation.x = active ? -1.08 * Math.min(1, phase / .6) : 0;
    if (!active) { crew.userData.area = null; return; }
    const area = mobile.area, point = sampleTrack(this.track, area.s, area.lateral);
    crew.position.set(point.x, point.y + .03, point.z);
    crew.rotation.set(0, point.heading + (area.headingOffset || 0), 0);
    crew.userData.area = area; crew.userData.elapsed = phase;
    crew.userData.floor.scale.set(area.width, area.length, 1);
    crew.userData.border.scale.set(area.width, 1, area.length);
    crew.userData.cones.forEach((cone, index) => cone.position.set((index % 2 ? 1 : -1) * (area.width / 2 - .18), .225, (index < 2 ? -1 : 1) * (area.length / 2 - .18)));
    for (const mechanic of crew.userData.mechanics) {
      mechanic.position.y = .015 * Math.sin(phase * 3 + mechanic.userData.phase);
      mechanic.userData.arms.forEach((arm, index) => { arm.rotation.x = -.7 + Math.sin(phase * 5 + mechanic.userData.phase + index) * .22; });
    }
    crew.userData.jackRam.scale.y = .75 + Math.min(1, phase / 1.5) * .25;
    crew.userData.handle.rotation.z = -.4 + Math.sin(phase * 5) * .16;
  }

  render(sim, dt, menu = false, spectating = false) {
    if (this.contextLost || document.hidden) return;
    for (const car of sim.cars) {
      const mesh = this.carMeshes.get(car.id); if (!mesh) continue;
      const sample = sampleTrack(this.track, car.s, car.lateral);
      mesh.position.set(car.x ?? sample.x, (car.y ?? sample.y) + .03, car.z ?? sample.z);
      mesh.rotation.set(0, (car.heading ?? sample.heading) + (car.headingOffset || 0) + (car.wrecked ? .19 : 0), -sample.banking);
      if (car.wrecked && !mesh.userData.wrecked) {
        const burntEngine = car.engine?.status === 'burnt';
        mesh.userData.wrecked = true; mesh.userData.paint.color.multiplyScalar(burntEngine ? .7 : .35); mesh.userData.smoke.visible = true; mesh.scale.y = burntEngine ? 1 : .78;
      }
      for (const wheel of mesh.userData.wheels) {
        const component = car.wheels?.find(item => item.id === wheel.userData.id);
        const wear = component?.suspensionDamage || 0, blown = component?.tire === 'blown';
        const pressure = blown ? 0 : component?.pressure ?? 1;
        const bent = component?.bend || 0, broken = component?.suspensionStatus === 'broken';
        const movingSpeed = sim.state === 'paused' || sim.raceComplete ? 0 : car.speed;
        wheel.userData.spin = (wheel.userData.spin || 0) - movingSpeed * dt * 2.5;
        wheel.visible = component?.assembly !== 'destroyed';
        wheel.position.y = .28 + pressure * .14 - wear * .025 - (broken ? .05 : 0);
        wheel.rotation.y = wheel.userData.side * (wear * .08 + bent * .16);
        wheel.rotation.z = wheel.userData.side * (wear * .1 + (broken ? .35 : 0)) + Math.sin(wheel.userData.spin) * bent * .22;
        wheel.userData.tire.scale.set(.61 + pressure * .39, 1.2 - pressure * .2, 1.08 - pressure * .08);
        // The flattened tire stays grounded; only the circular rim spins.
        wheel.userData.rim.rotation.x = wheel.userData.spin;
      }
      this.updateRoadsideCrew(car, mesh);
    }
    const focusCar = spectating ? sim.getStandings().find(car => !car.wrecked && !car.finished) || sim.getStandings().find(car => !car.wrecked) || sim.player : sim.player;
    this.spectatorCar = spectating ? focusCar : null;
    for (const [carId, visual] of this.bayVisuals) visual.fill.color.setHex(carId === focusCar.id ? 0x899438 : 0x27595b);
    const focusBay = this.bayVisuals.get(focusCar.id)?.bay;
    if (focusBay) {
      const bayPoint = sampleTrack(this.track, focusBay.s, focusBay.lateral);
      this.bayMarker.position.set(bayPoint.x, bayPoint.y + 5.8, bayPoint.z);
      this.bayMarker.visible = true;
    } else this.bayMarker.visible = false;
    if (this.focusCarId !== focusCar.id) { this.focusCarId = focusCar.id; this.cameraReady = false; }
    const player = focusCar, p = sampleTrack(this.track, player.s, player.lateral);
    // Carry the follow rig with the same pose used by the car mesh. Damping
    // world-space translation made its distance lag and pulse with frame timing;
    // only the camera's relative offset and viewing direction should settle.
    if (this.cameraReady && !menu && this.mode !== 'pit') {
      this.focusDisplacement.set(p.x, p.y, p.z).sub(this.focusPosition);
      this.camera.position.add(this.focusDisplacement);
      this.lookAt.add(this.focusDisplacement);
    }
    this.focusPosition.set(p.x, p.y, p.z);
    const target = new THREE.Vector3();
    if (menu) {
      target.set(p.x - p.tx * 27 + p.nx * 23, p.y + 19, p.z - p.tz * 27 + p.nz * 23);
      this.desiredLook.set(p.x + p.tx * 32, p.y + 1, p.z + p.tz * 32);
    } else if (this.mode === 'pit') {
      const pitCenter = sampleTrack(this.track, 0, sim.pit.bays?.[0]?.lateral ?? sim.pit.lateral);
      const rowLength = sim.pit.bays?.length ? Math.max(...sim.pit.bays.map(bay => bay.s + bay.length / 2)) - Math.min(...sim.pit.bays.map(bay => bay.s - bay.length / 2)) : 330;
      const overviewLength = Math.max(rowLength + 40, sim.pit.exitS - sim.pit.entryS + 100);
      const height = Math.max(170, overviewLength / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect) * 1.15);
      target.set(pitCenter.x, pitCenter.y + height, pitCenter.z + height * .45);
      this.desiredLook.set(pitCenter.x, pitCenter.y, pitCenter.z);
    } else if (this.mode === 'overhead') {
      target.set(p.x - p.tx * 50, p.y + 92, p.z - p.tz * 50);
      this.desiredLook.set(p.x + p.tx * 35, p.y, p.z + p.tz * 35);
    } else if (this.mode === 'hood') {
      target.set(p.x + p.tx * 1.1, p.y + 1.75, p.z + p.tz * 1.1);
      this.desiredLook.set(p.x + p.tx * 70, p.y + 1.4, p.z + p.tz * 70);
    } else {
      target.set(p.x - p.tx * 13, p.y + 5.8, p.z - p.tz * 13);
      this.desiredLook.set(p.x + p.tx * 27, p.y + 1.2, p.z + p.tz * 27);
    }
    const smoothing = this.cameraReady ? 1 - Math.exp(-dt * 8) : 1;
    this.camera.position.lerp(target, smoothing); this.lookAt.lerp(this.desiredLook, smoothing);
    this.camera.lookAt(this.lookAt); this.cameraReady = true;
    // Distant views need a tighter depth range to keep centimeter-separated
    // pavement and markings distinct. Driver cameras retain close visibility.
    const near = !menu && ['pit', 'overhead'].includes(this.mode)
      ? Math.max(2, Math.min(50, this.camera.position.distanceTo(this.lookAt) * .02)) : .2;
    if (Math.abs(this.camera.near - near) > .001) { this.camera.near = near; this.camera.updateProjectionMatrix(); }
    this.sun.position.set(p.x - 180, p.y + 350, p.z + 240); this.sun.target.position.set(p.x, p.y, p.z);
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  }

  cycleCamera() {
    const modes = ['chase', 'hood', 'overhead', 'pit']; this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length]; this.cameraReady = false; this.needsRender = true; return this.mode;
  }
}
