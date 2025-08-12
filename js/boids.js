// Configuration object for boid behavior
const BOID_CONFIG = {
    // Perception ranges
    ALIGNMENT_RADIUS: 50,
    COHESION_RADIUS: 60,
    SEPARATION_RADIUS: 35,
    MOUSE_RADIUS: 0,    // No mouse interaction
    
    // Force weights
    ALIGNMENT_WEIGHT: 1.0,
    COHESION_WEIGHT: 0.8,
    SEPARATION_WEIGHT: 1.2,
    MOUSE_WEIGHT: 0,    // No mouse influence
    
    // Movement constraints
    MIN_SPEED: 0,       // Minimum speed (0 allows stopping)
    MAX_SPEED: 2,       // Slower for smoother, more graceful movement
    MAX_FORCE: 0.12,    // Gentler turns
    BOID_MASS: 1.0      // Base mass of boids (affects turning)
};

// Vector utility functions
const Vector = {
    add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    subtract: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    multiply: (v, scalar) => ({ x: v.x * scalar, y: v.y * scalar }),
    divide: (v, scalar) => ({ x: v.x / scalar, y: v.y / scalar }),
    magnitude: (v) => Math.hypot(v.x, v.y),
    normalize: (v) => {
        const mag = Vector.magnitude(v);
        return mag > 0 ? Vector.divide(v, mag) : { x: 0, y: 0 };
    },
    limit: (v, max) => {
        const mag = Vector.magnitude(v);
        if (mag > max) {
            return Vector.multiply(Vector.normalize(v), max);
        }
        return v;
    }
};

class Boid {
    constructor(x, y) {
        this.position = { x, y };
        this.velocity = {
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1
        };
        this.acceleration = { x: 0, y: 0 };
        this.mass = BOID_CONFIG.BOID_MASS;
    }

    edges() {
        if (this.position.x > window.innerWidth) this.position.x = 0;
        if (this.position.x < 0) this.position.x = window.innerWidth;
        if (this.position.y > window.innerHeight) this.position.y = 0;
        if (this.position.y < 0) this.position.y = window.innerHeight;
    }

    align(boids) {
        let steering = { x: 0, y: 0 };
        let total = 0;
        
        for (let other of boids) {
            const distance = Vector.magnitude(Vector.subtract(this.position, other.position));
            if (other !== this && distance < BOID_CONFIG.ALIGNMENT_RADIUS) {
                steering = Vector.add(steering, other.velocity);
                total++;
            }
        }
        
        if (total > 0) {
            steering = Vector.divide(steering, total);
            steering = Vector.normalize(steering);
            steering = Vector.multiply(steering, BOID_CONFIG.MAX_SPEED);
            steering = Vector.subtract(steering, this.velocity);
            steering = Vector.limit(steering, BOID_CONFIG.MAX_FORCE);
        }
        
        return steering;
    }

    cohesion(boids) {
        let center = { x: 0, y: 0 };
        let total = 0;
        
        for (let other of boids) {
            const distance = Vector.magnitude(Vector.subtract(this.position, other.position));
            if (other !== this && distance < BOID_CONFIG.COHESION_RADIUS) {
                center = Vector.add(center, other.position);
                total++;
            }
        }
        
        if (total > 0) {
            center = Vector.divide(center, total);
            let desired = Vector.subtract(center, this.position);
            desired = Vector.normalize(desired);
            desired = Vector.multiply(desired, BOID_CONFIG.MAX_SPEED);
            let steering = Vector.subtract(desired, this.velocity);
            return Vector.limit(steering, BOID_CONFIG.MAX_FORCE);
        }
        
        return { x: 0, y: 0 };
    }

    separation(boids) {
        let steering = { x: 0, y: 0 };
        let total = 0;
        
        for (let other of boids) {
            const distance = Vector.magnitude(Vector.subtract(this.position, other.position));
            if (other !== this && distance < BOID_CONFIG.SEPARATION_RADIUS) {
                let diff = Vector.subtract(this.position, other.position);
                diff = Vector.divide(diff, distance * distance);
                steering = Vector.add(steering, diff);
                total++;
            }
        }
        
        if (total > 0) {
            steering = Vector.divide(steering, total);
            steering = Vector.normalize(steering);
            steering = Vector.multiply(steering, BOID_CONFIG.MAX_SPEED);
            steering = Vector.subtract(steering, this.velocity);
            return Vector.limit(steering, BOID_CONFIG.MAX_FORCE);
        }
        
        return steering;
    }

    mouseInteraction(mouseX, mouseY, isAttracting) {
        // No mouse interaction on homepage
        return { x: 0, y: 0 };
    }

    update(boids, mouseX, mouseY, isAttracting) {
        // Calculate base forces
        const baseAlignment = this.align(boids);
        const baseCohesion = this.cohesion(boids);
        const baseSeparation = this.separation(boids);
        const baseMouseForce = this.mouseInteraction(mouseX, mouseY, isAttracting);
        
        // Apply weights to forces
        const alignment = Vector.multiply(baseAlignment, BOID_CONFIG.ALIGNMENT_WEIGHT);
        const cohesion = Vector.multiply(baseCohesion, BOID_CONFIG.COHESION_WEIGHT);
        const separation = Vector.multiply(baseSeparation, BOID_CONFIG.SEPARATION_WEIGHT);
        const mouseForce = Vector.multiply(baseMouseForce, BOID_CONFIG.MOUSE_WEIGHT);
        
        // Log forces for debugging (occasionally)
        if (Math.random() < 0.01) {  // Log only 1% of the time to avoid console spam
            console.log('Forces:', {
                alignmentWeight: BOID_CONFIG.ALIGNMENT_WEIGHT,
                cohesionWeight: BOID_CONFIG.COHESION_WEIGHT,
                separationWeight: BOID_CONFIG.SEPARATION_WEIGHT,
                alignment: Vector.magnitude(alignment),
                cohesion: Vector.magnitude(cohesion),
                separation: Vector.magnitude(separation)
            });
        }
        
        // Sum up all forces
        let totalForce = { x: 0, y: 0 };
        totalForce = Vector.add(totalForce, alignment);
        totalForce = Vector.add(totalForce, cohesion);
        totalForce = Vector.add(totalForce, separation);
        totalForce = Vector.add(totalForce, mouseForce);
        
        // Apply mass to affect turning (F = ma, so a = F/m)
        this.acceleration = Vector.divide(totalForce, this.mass);
        this.acceleration = Vector.limit(this.acceleration, BOID_CONFIG.MAX_FORCE);
        
        this.velocity = Vector.add(this.velocity, this.acceleration);
        this.velocity = Vector.limit(this.velocity, BOID_CONFIG.MAX_SPEED);
        
        // Enforce minimum speed
        const currentSpeed = Vector.magnitude(this.velocity);
        if (currentSpeed < BOID_CONFIG.MIN_SPEED && currentSpeed > 0) {
            const scaleFactor = BOID_CONFIG.MIN_SPEED / currentSpeed;
            this.velocity = Vector.multiply(this.velocity, scaleFactor);
        }
        
        this.position = Vector.add(this.position, this.velocity);
        
        this.acceleration = { x: 0, y: 0 };
        
        this.edges();
    }

    draw(ctx) {
        console.log('Drawing boid at:', this.position.x, this.position.y);  // Debug line
        const angle = Math.atan2(this.velocity.y, this.velocity.x);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(angle);
        
        // Draw boid as a triangle
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, 4);
        ctx.lineTo(-5, -4);
        ctx.closePath();
        ctx.fillStyle = '#4a90e2';
        ctx.fill();
        
        ctx.restore();
    }
}

// Initialize boids
let boids = [];
let canvas, ctx;
let mouseX = 0, mouseY = 0;
let isMouseDown = false;

function init() {
    console.log('Initializing boids...');  // Debug line
    canvas = document.getElementById('boids-canvas');
    if (!canvas) {
        console.error('Could not find canvas element!');
        return;
    }
    console.log('Canvas found, getting context...');  // Debug line
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context!');
        return;
    }
    
    // Make canvas fullscreen
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        console.log('Canvas resized to:', canvas.width, canvas.height);  // Debug line
    }
    
    window.addEventListener('resize', resize);
    resize();
    
    // Create boids
    console.log('Creating boids...');  // Debug line
    const numBoids = window.innerWidth < 768 ? 150 : 250; // Reduced number of boids for better performance
    for (let i = 0; i < numBoids; i++) {
        boids.push(new Boid(
            Math.random() * canvas.width,
            Math.random() * canvas.height
        ));
    }
    console.log('Created', boids.length, 'boids');  // Debug line
    
    // Start animation
    console.log('Starting animation...');  // Debug line
    animate();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let boid of boids) {
        boid.update(boids, mouseX, mouseY, isMouseDown);
        boid.draw(ctx);
    }
    
    requestAnimationFrame(animate);
}

// Update configuration based on slider values
function setupControls() {
    // Slider event listeners
    document.getElementById('numBoids').addEventListener('input', (e) => {
        const newCount = parseInt(e.target.value);
        while (boids.length > newCount) {
            boids.pop();
        }
        while (boids.length < newCount) {
            boids.push(new Boid(
                Math.random() * canvas.width,
                Math.random() * canvas.height
            ));
        }
    });

    // Behavior sliders
    document.getElementById('alignmentWeight').addEventListener('input', (e) => {
        BOID_CONFIG.ALIGNMENT_WEIGHT = parseFloat(e.target.value);
    });

    document.getElementById('cohesionWeight').addEventListener('input', (e) => {
        BOID_CONFIG.COHESION_WEIGHT = parseFloat(e.target.value);
    });

    document.getElementById('separationWeight').addEventListener('input', (e) => {
        BOID_CONFIG.SEPARATION_WEIGHT = parseFloat(e.target.value);
    });

    // Range sliders
    document.getElementById('alignmentRadius').addEventListener('input', (e) => {
        BOID_CONFIG.ALIGNMENT_RADIUS = parseFloat(e.target.value);
    });

    document.getElementById('cohesionRadius').addEventListener('input', (e) => {
        BOID_CONFIG.COHESION_RADIUS = parseFloat(e.target.value);
    });

    document.getElementById('separationRadius').addEventListener('input', (e) => {
        BOID_CONFIG.SEPARATION_RADIUS = parseFloat(e.target.value);
    });

    // Speed and force
    document.getElementById('maxSpeed').addEventListener('input', (e) => {
        BOID_CONFIG.MAX_SPEED = parseFloat(e.target.value);
    });

    document.getElementById('maxForce').addEventListener('input', (e) => {
        BOID_CONFIG.MAX_FORCE = parseFloat(e.target.value);
    });
}

function updateBoidsConfig() {
    // Update all configuration values from sliders and log them
    const newValues = {
        alignment: parseFloat(document.getElementById('alignmentWeight').value),
        cohesion: parseFloat(document.getElementById('cohesionWeight').value),
        separation: parseFloat(document.getElementById('separationWeight').value),
        minSpeed: parseFloat(document.getElementById('minSpeed').value),
        maxSpeed: parseFloat(document.getElementById('maxSpeed').value),
        alignRadius: parseFloat(document.getElementById('alignmentRadius').value),
        cohesionRadius: parseFloat(document.getElementById('cohesionRadius').value),
        separationRadius: parseFloat(document.getElementById('separationRadius').value),
        maxForce: parseFloat(document.getElementById('maxForce').value),
        mass: parseFloat(document.getElementById('boidMass').value)
    };

    // Update configuration
    BOID_CONFIG.ALIGNMENT_WEIGHT = newValues.alignment;
    BOID_CONFIG.COHESION_WEIGHT = newValues.cohesion;
    BOID_CONFIG.SEPARATION_WEIGHT = newValues.separation;
    BOID_CONFIG.MIN_SPEED = newValues.minSpeed;
    BOID_CONFIG.MAX_SPEED = newValues.maxSpeed;
    BOID_CONFIG.ALIGNMENT_RADIUS = newValues.alignRadius;
    BOID_CONFIG.COHESION_RADIUS = newValues.cohesionRadius;
    BOID_CONFIG.SEPARATION_RADIUS = newValues.separationRadius;
    BOID_CONFIG.MAX_FORCE = newValues.maxForce;
    BOID_CONFIG.BOID_MASS = newValues.mass;

    // Log the changes to verify they're being updated
    console.log('Updated BOID_CONFIG:', {
        alignment: BOID_CONFIG.ALIGNMENT_WEIGHT,
        cohesion: BOID_CONFIG.COHESION_WEIGHT,
        separation: BOID_CONFIG.SEPARATION_WEIGHT
    });

    // Update all boids' mass
    boids.forEach(boid => {
        boid.mass = BOID_CONFIG.BOID_MASS;
    });

    // Update number of boids if changed
    const newBoidsCount = parseInt(document.getElementById('numBoids').value);
    if (newBoidsCount !== boids.length) {
        while (boids.length > newBoidsCount) {
            boids.pop();
        }
        while (boids.length < newBoidsCount) {
            boids.push(new Boid(
                Math.random() * canvas.width,
                Math.random() * canvas.height
            ));
        }
    }
}

// Initialize when the page loads
window.addEventListener('load', () => {
    init();
    
    // Set up event listeners for all sliders
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        const display = document.getElementById(slider.id + 'Value');
        if (display) {
            // Set initial display value
            display.textContent = slider.value;
            
            // Update display and config when slider changes
            slider.addEventListener('input', (e) => {
                const newValue = e.target.value;
                display.textContent = newValue;
                console.log(`Slider ${slider.id} changed to ${newValue}`); // Debug log
                updateBoidsConfig();
            });
            
            // Also trigger on change event to ensure updates happen
            slider.addEventListener('change', (e) => {
                updateBoidsConfig();
            });
        }
    });
    
    // Initial configuration update
    updateBoidsConfig();
});
