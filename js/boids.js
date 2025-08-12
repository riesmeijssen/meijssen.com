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
    MAX_SPEED: 2,       // Slower for smoother, more graceful movement
    MAX_FORCE: 0.12     // Gentler turns
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
        const alignment = Vector.multiply(this.align(boids), BOID_CONFIG.ALIGNMENT_WEIGHT);
        const cohesion = Vector.multiply(this.cohesion(boids), BOID_CONFIG.COHESION_WEIGHT);
        const separation = Vector.multiply(this.separation(boids), BOID_CONFIG.SEPARATION_WEIGHT);
        const mouseForce = Vector.multiply(
            this.mouseInteraction(mouseX, mouseY, isAttracting),
            BOID_CONFIG.MOUSE_WEIGHT
        );
        
        this.acceleration = Vector.add(this.acceleration, alignment);
        this.acceleration = Vector.add(this.acceleration, cohesion);
        this.acceleration = Vector.add(this.acceleration, separation);
        this.acceleration = Vector.add(this.acceleration, mouseForce);
        
        this.velocity = Vector.add(this.velocity, this.acceleration);
        this.velocity = Vector.limit(this.velocity, BOID_CONFIG.MAX_SPEED);
        
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
    const numBoids = window.innerWidth < 768 ? 100 : 200; // Reduced number of boids for better performance
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

// Initialize when the page loads
window.addEventListener('load', init);
