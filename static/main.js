import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// WebGL Globals
let scene, camera, renderer;

// Physics Globals
let world, vehicle;
const wheelVisuals = [];
let chassisVisual;

// Controls
const keys = { w: false, a: false, s: false, d: false, ' ': false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
let cameraMode = 0;

let prevTime = performance.now();

init();

function init() {
    initGraphics();
    initPhysics();
    initEnvironment();
    initControls();
    
    window.addEventListener('resize', onWindowResize, false);
    renderer.setAnimationLoop(animate);
}

function initGraphics() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5ca1e6); // Sky blue
    scene.fog = new THREE.FogExp2(0x5ca1e6, 0.0025);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, -15);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(100, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);
}

function initPhysics() {
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.81, 0)
    });

    const groundMaterial = new CANNON.Material('ground');
    const wheelMaterial = new CANNON.Material('wheel');
    const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
        friction: 0.6,
        restitution: 0,
        contactEquationStiffness: 1000
    });
    world.addContactMaterial(wheelGroundContactMaterial);

    // 1. Ground Physics
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // Ground Visual
    const planeGeo = new THREE.PlaneGeometry(1000, 1000);
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#222222';
    context.fillRect(0, 0, 256, 256);
    context.fillStyle = '#444444';
    context.fillRect(0, 0, 256, 4);
    context.fillRect(0, 0, 4, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(500, 500);

    const planeMat = new THREE.MeshStandardMaterial({ 
        map: texture,
        roughness: 0.9,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // 2. Chassis Physics
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.4, 2));
    const chassisBody = new CANNON.Body({ mass: 1500 });
    chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.4, 0)); 
    chassisBody.position.set(0, 4, 0);
    
    // Chassis Visual
    const chassisGroup = new THREE.Group();
    
    const bodyGeo = new THREE.BoxGeometry(2, 0.6, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, metalness: 0.7, roughness: 0.3 }); 
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.4;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    const cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 }); 
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 1.0, -0.2);
    cabinMesh.castShadow = true;
    cabinMesh.receiveShadow = true;
    chassisGroup.add(cabinMesh);

    scene.add(chassisGroup);
    chassisVisual = chassisGroup;

    // 3. Vehicle Setup
    vehicle = new CANNON.RaycastVehicle({
        chassisBody: chassisBody,
        indexRightAxis: 0, 
        indexUpAxis: 1,    
        indexForwardAxis: 2 
    });

    const wheelOptions = {
        radius: 0.4,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: 45,
        suspensionRestLength: 0.4,
        frictionSlip: 5,
        dampingRelaxation: 2.3,
        dampingCompression: 4.4,
        maxSuspensionForce: 100000,
        rollInfluence: 0.01,
        axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
        maxSuspensionTravel: 0.3,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true
    };

    wheelOptions.chassisConnectionPointLocal.set(-1.1, 0.2, -1.4);
    vehicle.addWheel(wheelOptions);
    wheelOptions.chassisConnectionPointLocal.set(1.1, 0.2, -1.4);
    vehicle.addWheel(wheelOptions);
    wheelOptions.chassisConnectionPointLocal.set(-1.1, 0.2, 1.4);
    vehicle.addWheel(wheelOptions);
    wheelOptions.chassisConnectionPointLocal.set(1.1, 0.2, 1.4);
    vehicle.addWheel(wheelOptions);

    vehicle.addToWorld(world);

    const wheelGeo = new THREE.CylinderGeometry(wheelOptions.radius, wheelOptions.radius, 0.4, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

    vehicle.wheelInfos.forEach(() => {
        const wheelObj = new THREE.Mesh(wheelGeo, wheelMat);
        wheelObj.castShadow = true;
        scene.add(wheelObj);
        wheelVisuals.push(wheelObj);
    });

    world.addEventListener('postStep', () => {
        for (let i = 0; i < vehicle.wheelInfos.length; i++) {
            vehicle.updateWheelTransform(i);
            const t = vehicle.wheelInfos[i].worldTransform;
            wheelVisuals[i].position.copy(t.position);
            wheelVisuals[i].quaternion.copy(t.quaternion);
        }
    });
}

function initEnvironment() {
    for(let i=0; i<80; i++) {
        const size = Math.random() * 3 + 1;
        const boxGeo = new THREE.BoxGeometry(size, size, size);
        const boxMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5),
            roughness: 0.6
        });
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        
        let x = (Math.random() - 0.5) * 200;
        let z = (Math.random() - 0.5) * 200;
        if(Math.abs(x) < 15 && Math.abs(z) < 15) {
            x += 25; z += 25;
        }

        boxMesh.position.set(x, size/2, z);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        scene.add(boxMesh);

        const boxShape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
        const boxBody = new CANNON.Body({ mass: size * 50 });
        boxBody.addShape(boxShape);
        boxBody.position.copy(boxMesh.position);
        world.addBody(boxBody);

        boxMesh.userData.physicsBody = boxBody;
    }
}

function initControls() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if(keys.hasOwnProperty(key)) keys[key] = true;
        
        if (key === 'c') {
            cameraMode = (cameraMode + 1) % 4;
        }
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if(keys.hasOwnProperty(key)) keys[key] = false;
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const now = performance.now();
    const dt = Math.max(0.01, Math.min((now - prevTime) / 1000, 0.1));
    prevTime = now;

    const maxSteerVal = 0.5;
    const maxForce = 3500;
    const normalBrake = 120;
    const handbrakeForce = 400; // Lock rear wheels
    const handbrake = keys[' '];

    const isForward = keys['w'] || keys['arrowup'];
    const isBackward = keys['s'] || keys['arrowdown'];
    
    // Calculate local velocity to determine forward/backward movement
    const v = vehicle.chassisBody.velocity;
    const q = vehicle.chassisBody.quaternion;
    const localVelocity = q.inverse().vmult(v); 
    const forwardSpeed = -localVelocity.z; // -z is forward in this setup

    let engineForce = 0;
    let frontBrake = 0;
    let rearBrake = 0;

    if (isForward) {
        if (forwardSpeed < -2) { // Moving backward fast
            frontBrake = normalBrake;
            rearBrake = normalBrake;
        } else {
            engineForce = maxForce;
        }
    }
    if (isBackward) {
        if (forwardSpeed > 2) { // Moving forward fast
            frontBrake = normalBrake;
            rearBrake = normalBrake;
        } else {
            engineForce = -maxForce / 2; // reverse slower
        }
    }

    if (handbrake) {
        engineForce = 0; // Cut power
        rearBrake = handbrakeForce; // Lock rears
    }

    vehicle.applyEngineForce(engineForce, 2);
    vehicle.applyEngineForce(engineForce, 3);
    
    const isLeft = keys['a'] || keys['arrowleft'];
    const isRight = keys['d'] || keys['arrowright'];
    let steering = 0;
    if (isLeft) steering = maxSteerVal;
    if (isRight) steering = -maxSteerVal;
    
    vehicle.setSteeringValue(steering, 0);
    vehicle.setSteeringValue(steering, 1);

    vehicle.setBrake(frontBrake, 0);
    vehicle.setBrake(frontBrake, 1);
    vehicle.setBrake(rearBrake, 2);
    vehicle.setBrake(rearBrake, 3);

    world.step(1 / 60, dt, 3);

    chassisVisual.position.copy(vehicle.chassisBody.position);
    chassisVisual.quaternion.copy(vehicle.chassisBody.quaternion);

    scene.children.forEach(child => {
        if(child.userData.physicsBody) {
            child.position.copy(child.userData.physicsBody.position);
            child.quaternion.copy(child.userData.physicsBody.quaternion);
        }
    });

    let relativeCameraOffset;
    switch(cameraMode) {
        case 0: relativeCameraOffset = new THREE.Vector3(0, 4, 10); break; // Chase High
        case 1: relativeCameraOffset = new THREE.Vector3(0, 2, 7); break;  // Chase Low
        case 2: relativeCameraOffset = new THREE.Vector3(0, 1, -0.6); break; // Hood Cam
        case 3: relativeCameraOffset = new THREE.Vector3(0, 20, 2); break; // Top-Down
    }

    const euler = new THREE.Euler().setFromQuaternion(chassisVisual.quaternion, 'YXZ');
    const yaw = euler.y;
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    
    const cameraTargetMatrix = new THREE.Matrix4().makeTranslation(
        relativeCameraOffset.x,
        relativeCameraOffset.y,
        relativeCameraOffset.z
    );
    
    const cameraTargetMatrixWorld = new THREE.Matrix4().compose(
        chassisVisual.position,
        yawQuat,
        new THREE.Vector3(1, 1, 1)
    ).multiply(cameraTargetMatrix);

    const targetPos = new THREE.Vector3();
    targetPos.setFromMatrixPosition(cameraTargetMatrixWorld);

    camera.position.lerp(targetPos, cameraMode === 2 ? 0.8 : dt * 5);

    const lookAtTarget = chassisVisual.position.clone();
    if (cameraMode === 2) { // Hood Cam looks straight ahead
        lookAtTarget.add(new THREE.Vector3(0, 0, -10).applyQuaternion(yawQuat));
        lookAtTarget.y += 0.8;
    } else {
        lookAtTarget.y += 1.0;
    }
    camera.lookAt(lookAtTarget);

    const velocity = vehicle.chassisBody.velocity.length();
    const speedKmH = Math.round(velocity * 3.6);
    document.getElementById('speed-value').innerText = speedKmH;

    renderer.render(scene, camera);
}
