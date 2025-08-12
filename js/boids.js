// FPS tracking variables
let lastTime = 0;
let frameCount = 0;
let fps = 0;
let lastFpsUpdate = 0;

// Configuration object for boid behavior
const NORMAL_CONFIG = {
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
    MIN_SPEED: 1,       // Minimum speed (0 allows stopping)
    MAX_SPEED: 2,       // Slower for smoother, more graceful movement
    MAX_FORCE: 0.12,    // Gentler turns
    BOID_MASS: 1.0,     // Base mass of boids (affects turning)
    GRID_SIZE: 100      // Size of spatial grid cells
};

const HIGH_PERFORMANCE_CONFIG = {
    // Reduced perception ranges for performance
    ALIGNMENT_RADIUS: 30,
    COHESION_RADIUS: 40,
    SEPARATION_RADIUS: 25,
    MOUSE_RADIUS: 0,
    
    // Adjusted weights for reduced ranges
    ALIGNMENT_WEIGHT: 1.2,
    COHESION_WEIGHT: 1.0,
    SEPARATION_WEIGHT: 1.4,
    MOUSE_WEIGHT: 0,
    
    // Faster movement for more dynamic appearance
    MIN_SPEED: 1,
    MAX_SPEED: 3,
    MAX_FORCE: 0.15,
    BOID_MASS: 1.0,
    GRID_SIZE: 150      // Larger grid cells for better performance
};

// Current configuration (starts with normal mode)
let BOID_CONFIG = { ...NORMAL_CONFIG };

// Spatial grid for optimization
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = new Array(this.cols * this.rows).fill().map(() => []);
    }

    clear() {
        for (let i = 0; i < this.grid.length; i++) {
            this.grid[i].length = 0;
        }
    }

    insert(boid) {
        const col = Math.floor(boid.position.x / this.cellSize);
        const row = Math.floor(boid.position.y / this.cellSize);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            this.grid[row * this.cols + col].push(boid);
        }
    }

    getNearbyBoids(boid, radius) {
        const nearby = [];
        const col = Math.floor(boid.position.x / this.cellSize);
        const row = Math.floor(boid.position.y / this.cellSize);
        const cellRadius = Math.ceil(radius / this.cellSize);

        for (let i = -cellRadius; i <= cellRadius; i++) {
            for (let j = -cellRadius; j <= cellRadius; j++) {
                const targetCol = col + i;
                const targetRow = row + j;
                if (targetCol >= 0 && targetCol < this.cols && targetRow >= 0 && targetRow < this.rows) {
                    const cell = this.grid[targetRow * this.cols + targetCol];
                    nearby.push(...cell);
                }
            }
        }
        return nearby;
    }
}

// Optimized Vector utility functions
const Vector = {
    // Reuse objects to reduce garbage collection
    _temp: { x: 0, y: 0 },
    _temp2: { x: 0, y: 0 },

    add: (v1, v2, result = { x: 0, y: 0 }) => {
        result.x = v1.x + v2.x;
        result.y = v1.y + v2.y;
        return result;
    },
    
    addInPlace: (v1, v2) => {
        v1.x += v2.x;
        v1.y += v2.y;
        return v1;
    },

    subtract: (v1, v2, result = { x: 0, y: 0 }) => {
        result.x = v1.x - v2.x;
        result.y = v1.y - v2.y;
        return result;
    },

    multiply: (v, scalar, result = { x: 0, y: 0 }) => {
        result.x = v.x * scalar;
        result.y = v.y * scalar;
        return result;
    },

    multiplyInPlace: (v, scalar) => {
        v.x *= scalar;
        v.y *= scalar;
        return v;
    },

    divide: (v, scalar, result = { x: 0, y: 0 }) => {
        const invScalar = 1 / scalar;
        result.x = v.x * invScalar;
        result.y = v.y * invScalar;
        return result;
    },

    magnitudeSquared: (v) => v.x * v.x + v.y * v.y,

    magnitude: (v) => Math.sqrt(v.x * v.x + v.y * v.y),

    normalize: (v, result = { x: 0, y: 0 }) => {
        const mag = Math.sqrt(v.x * v.x + v.y * v.y);
        if (mag > 0) {
            const invMag = 1 / mag;
            result.x = v.x * invMag;
            result.y = v.y * invMag;
        } else {
            result.x = 0;
            result.y = 0;
        }
        return result;
    },

    limit: (v, max, result = { x: 0, y: 0 }) => {
        const magSquared = v.x * v.x + v.y * v.y;
        if (magSquared > max * max) {
            const scale = max / Math.sqrt(magSquared);
            result.x = v.x * scale;
            result.y = v.y * scale;
            return result;
        }
        result.x = v.x;
        result.y = v.y;
        return result;
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
    canvas = document.getElementById('boids-canvas');
    if (!canvas) {
        console.error('Could not find canvas element!');
        return;
    }
    ctx = canvas.getContext('2d', { alpha: false });  // Disable alpha for better performance
    if (!ctx) {
        console.error('Could not get canvas context!');
        return;
    }
    
    // Enable image smoothing for better appearance
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Make canvas fullscreen
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        console.log('Canvas resized to:', canvas.width, canvas.height);  // Debug line
    }
    
    window.addEventListener('resize', resize);
    resize();
    
    // Initialize spatial grid (cell size based on maximum perception radius)
    const maxRadius = Math.max(
        BOID_CONFIG.ALIGNMENT_RADIUS,
        BOID_CONFIG.COHESION_RADIUS,
        BOID_CONFIG.SEPARATION_RADIUS
    );
    spatialGrid = new SpatialGrid(canvas.width, canvas.height, BOID_CONFIG.GRID_SIZE);
    
    // Create boids with initial count
    const numBoids = window.innerWidth < 768 ? 750 : 1500;
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

// Initialize spatial grid
let spatialGrid;

function animate(currentTime) {
    // Calculate FPS
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    frameCount++;
    
    // Update FPS every 500ms
    if (currentTime - lastFpsUpdate > 500) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = currentTime;
    }
    
    // Clear canvas with alpha for motion blur effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Display FPS
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${fps} FPS`, canvas.width - 10, canvas.height - 10);
    
    // Update spatial grid
    spatialGrid.clear();
    for (let boid of boids) {
        spatialGrid.insert(boid);
    }
    
    // Batch update all boids
    for (let boid of boids) {
        // Get only nearby boids for each behavior
        const alignmentNeighbors = spatialGrid.getNearbyBoids(boid, BOID_CONFIG.ALIGNMENT_RADIUS);
        const cohesionNeighbors = spatialGrid.getNearbyBoids(boid, BOID_CONFIG.COHESION_RADIUS);
        const separationNeighbors = spatialGrid.getNearbyBoids(boid, BOID_CONFIG.SEPARATION_RADIUS);
        
        // Calculate forces based on local neighbors only
        const alignment = boid.align(alignmentNeighbors);
        const cohesion = boid.cohesion(cohesionNeighbors);
        const separation = boid.separation(separationNeighbors);
        
        // Apply forces
        Vector.multiply(alignment, BOID_CONFIG.ALIGNMENT_WEIGHT, alignment);
        Vector.multiply(cohesion, BOID_CONFIG.COHESION_WEIGHT, cohesion);
        Vector.multiply(separation, BOID_CONFIG.SEPARATION_WEIGHT, separation);
        
        // Update boid position
        Vector.add(boid.acceleration, alignment, boid.acceleration);
        Vector.add(boid.acceleration, cohesion, boid.acceleration);
        Vector.add(boid.acceleration, separation, boid.acceleration);
        
        Vector.divide(boid.acceleration, boid.mass, boid.acceleration);
        Vector.limit(boid.acceleration, BOID_CONFIG.MAX_FORCE, boid.acceleration);
        
        Vector.add(boid.velocity, boid.acceleration, boid.velocity);
        Vector.limit(boid.velocity, BOID_CONFIG.MAX_SPEED, boid.velocity);
        
        // Enforce minimum speed
        const currentSpeed = Vector.magnitude(boid.velocity);
        if (currentSpeed < BOID_CONFIG.MIN_SPEED && currentSpeed > 0) {
            Vector.multiply(boid.velocity, BOID_CONFIG.MIN_SPEED / currentSpeed, boid.velocity);
        }
        
        Vector.add(boid.position, boid.velocity, boid.position);
        boid.acceleration.x = 0;
        boid.acceleration.y = 0;
        boid.edges();
    }
    
    // Batch render all boids
    ctx.fillStyle = '#4a90e2';
    for (let boid of boids) {
        const angle = Math.atan2(boid.velocity.y, boid.velocity.x);
        ctx.save();
        ctx.translate(boid.position.x, boid.position.y);
        ctx.rotate(angle);
        
        // Simpler shape for better performance
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, 2);
        ctx.lineTo(-3, -2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
    
    requestAnimationFrame(animate);
}

// Update configuration based on slider values
function setupControls() {
    // Performance mode toggle
    const performanceToggle = document.getElementById('performanceMode');
    performanceToggle.addEventListener('change', (e) => {
        const isHighPerformance = e.target.checked;
        const newCount = isHighPerformance ? 
            (window.innerWidth < 768 ? 1000 : 10000) : 
            (window.innerWidth < 768 ? 150 : 200);
        
        // Update configuration
        BOID_CONFIG = isHighPerformance ? { ...HIGH_PERFORMANCE_CONFIG } : { ...NORMAL_CONFIG };
        
        // Recreate spatial grid with new cell size
        spatialGrid = new SpatialGrid(canvas.width, canvas.height, BOID_CONFIG.GRID_SIZE);
        
        // Update the number of boids slider
        const numBoidsSlider = document.getElementById('numBoids');
        numBoidsSlider.value = newCount;
        document.getElementById('numBoidsValue').textContent = newCount;
        
        // Update actual boids count and reinitialize with new settings
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
