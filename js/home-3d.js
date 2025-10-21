import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class SceneManager {
    constructor() {
        this.container = document.getElementById('scene-container');
        this.scrollPercent = 0;
        this.scene = new THREE.Scene();
        this.createCamera();
        this.createLights();
        this.createRenderer();
        this.createControls();
        this.createGeometries();
        this.addEventListeners();
        this.animate();
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            35, // FOV
            this.container.clientWidth / this.container.clientHeight, // aspect
            0.1, // near clipping plane
            1000 // far clipping plane
        );
        this.camera.position.set(0, 0, 10);
    }

    createLights() {
        const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x202020, 5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 5);
        mainLight.position.set(10, 10, 10);
        this.scene.add(mainLight);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.physicallyCorrectLights = true;
        this.container.appendChild(this.renderer.domElement);
    }

    createControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false;
    }

    createGeometries() {
        // Create abstract geometric shapes
        this.geometries = [];
        
        // Create nose group
        this.noseGroup = new THREE.Group();
        
        // Main nose shape (elongated cone)
        const noseGeometry = new THREE.ConeGeometry(1, 3, 4);
        noseGeometry.rotateX(Math.PI * 0.5); // Rotate to point forward
        const noseMaterial = new THREE.MeshStandardMaterial({
            color: 0xffb6b6, // Flesh color
            metalness: 0.1,
            roughness: 0.8,
        });
        this.nose = new THREE.Mesh(noseGeometry, noseMaterial);
        
        // Adjust nose shape
        this.nose.scale.set(1, 1.5, 1); // Make it wider
        this.nose.position.z = 1; // Move forward
        
        // Create eyes
        const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const eyeMaterial = new THREE.MeshStandardMaterial({
            color: 0x0077ff,
            metalness: 0.1,
            roughness: 1,
        });
        
        // Left eye
        this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        this.leftEye.position.set(0.7, 0.9, -0.7);
        this.leftEye.scale.set(1, 0.5, 1);
        
        // Right eye
        this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        this.rightEye.position.set(-0.7, 0.9, -0.7);
        this.rightEye.scale.set(1, 0.5, 1);
        
        // Add face
        const bridgeGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const bridge = new THREE.Mesh(bridgeGeometry, noseMaterial);
        bridge.position.set(0, 0, -1);
        bridge.scale.set(3, 4, 0.5);
        
        // Combine all parts
        this.noseGroup.add(this.nose);
        this.noseGroup.add(this.leftEye);
        this.noseGroup.add(this.rightEye);
        this.noseGroup.add(bridge);
        
        // Add to scene and store reference
        this.scene.add(this.noseGroup);
        this.geometries.push(this.noseGroup);

        // Floating Cubes
        this.cubes = [];
        const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x00BCD4,
            metalness: 0.7,
            roughness: 0.2,
        });
        
        for (let i = 0; i < 5; i++) {
            const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
            cube.position.set(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            cube.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            this.scene.add(cube);
            this.cubes.push(cube);
        }

        // Dodecahedron
        const dodecaGeometry = new THREE.DodecahedronGeometry(1);
        const dodecaMaterial = new THREE.MeshStandardMaterial({
            color: 0x4CAF50,
            metalness: 0.3,
            roughness: 0.4,
        });
        this.dodecahedron = new THREE.Mesh(dodecaGeometry, dodecaMaterial);
        this.dodecahedron.position.set(-3, 2, -2);
        this.scene.add(this.dodecahedron);

        // Icosahedron
        const icosaGeometry = new THREE.IcosahedronGeometry(0.7);
        const icosaMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF4081,
            metalness: 0.6,
            roughness: 0.3,
        });
        this.icosahedron = new THREE.Mesh(icosaGeometry, icosaMaterial);
        this.icosahedron.position.set(3, -2, -1);
        this.scene.add(this.icosahedron);

        // Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCnt = 5000;
        const posArray = new Float32Array(particlesCnt * 3);
        
        for(let i = 0; i < particlesCnt * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 15;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x00BCD4,
        });
        
        this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(this.particles);
    }

    addEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('scroll', this.onScroll.bind(this));

        // Navigation dots
        document.querySelectorAll('.nav-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const section = document.getElementById(dot.dataset.section);
                section.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    onScroll() {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        this.scrollPercent = window.scrollY / totalHeight;

        // Update nav dots
        const sections = ['intro', 'about', 'projects', 'contact'];
        const currentSection = sections[Math.floor(this.scrollPercent * sections.length)];
        
        document.querySelectorAll('.nav-dot').forEach(dot => {
            dot.classList.toggle('active', dot.dataset.section === currentSection);
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const time = performance.now() * 0.001; // Current time in seconds

        // Animate nose
        this.noseGroup.rotation.y = Math.sin(time * 0.5) * 0.5; // Gentle side-to-side movement
        this.noseGroup.rotation.z = Math.cos(time * 0.3) * 0.1; // Slight tilt
        this.noseGroup.rotation.x = this.scrollPercent * Math.PI * 0.5; // Tilt up/down with scroll
        
        // Make the nose "sniff" occasionally
        if (Math.sin(time * 2) > 0.95) {
            this.noseGroup.position.z = Math.sin(time * 20) * 0.2;
        } else {
            this.noseGroup.position.z = 0;
        }

        // Animate floating cubes
        this.cubes.forEach((cube, index) => {
            cube.rotation.x += 0.01 * (index + 1);
            cube.rotation.y += 0.02 * (index + 1);
            cube.position.y += Math.sin(time * 2 + index) * 0.02;
        });

        // Rotate dodecahedron
        this.dodecahedron.rotation.x = time * 0.4;
        this.dodecahedron.rotation.y = time * 0.5;
        this.dodecahedron.position.y = Math.sin(time) * 0.5 + 2;

        // Rotate icosahedron
        this.icosahedron.rotation.x = -time * 0.3;
        this.icosahedron.rotation.z = time * 0.4;
        this.icosahedron.position.x = Math.cos(time * 0.8) * 3;

        // Rotate particles
        this.particles.rotation.y += 0.001;
        
        // Update controls
        this.controls.update();

        // Dynamic camera movement based on scroll and mouse
        const scrollOffset = this.scrollPercent * 5;
        this.camera.position.z = 10 - scrollOffset;
        this.camera.position.y = this.scrollPercent * 3;
        
        // Add subtle camera sway
        this.camera.position.x = Math.sin(time * 0.5) * 0.5;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the scene when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SceneManager();
});
