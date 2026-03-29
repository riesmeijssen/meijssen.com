/**
 * Piano Tuner - Main Application Logic
 * Handles UI, microphone access, and Web Worker communication
 */

class PianoTuner {
    constructor() {
        // Audio context and stream
        this.audioContext = null;
        this.mediaStream = null;
        this.analyser = null;
        this.scriptProcessor = null;

        // Web Worker
        this.worker = null;

        // State
        this.isRunning = false;
        this.referenceFrequency = 440;
        this.stretchFactor = 0.0001;

        // Note tracking
        this.tuningStatus = {}; // Track tuning status for each note

        // Note constants
        this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.A4_NOTE_NUMBER = 48; // A4 is the 49th note, 0-indexed at 48

        // UI Elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.refFreqSlider = document.getElementById('refFreq');
        this.refFreqDisplay = document.getElementById('refFreqDisplay');
        this.stretchSlider = document.getElementById('stretchFactor');
        this.stretchDisplay = document.getElementById('stretchFactorDisplay');
        this.frequencyDisplay = document.getElementById('frequency');
        this.noteNameDisplay = document.getElementById('noteName');
        this.centsValueDisplay = document.getElementById('centsValue');
        this.meterNeedle = document.getElementById('meterNeedle');
        this.statusLight = document.getElementById('statusLight');
        this.statusText = document.getElementById('statusText');
        this.signalStrength = document.getElementById('signalStrength');
        this.signalFill = document.getElementById('signalFill');
        this.stretchPointer = document.getElementById('stretchPointer');
        this.stretchDesc = document.getElementById('stretchDesc');
        this.pianoNotes = document.getElementById('pianoNotes');

        this.initializePianoGrid();
        this.setupEventListeners();
        
        // Initialize stretch factor visualization
        this.updateStretchFactor({ target: this.stretchSlider });
    }

    initializePianoGrid() {
        // Create note tracker for 4 octaves (C2 to C6, common piano tuning range)
        const startOctave = 2;
        const endOctave = 6;

        for (let octave = startOctave; octave <= endOctave; octave++) {
            for (let noteIndex = 0; noteIndex < this.NOTE_NAMES.length; noteIndex++) {
                const noteNumber = octave * 12 + noteIndex;
                const noteName = this.NOTE_NAMES[noteIndex] + octave;
                
                const noteElement = document.createElement('div');
                noteElement.className = 'note-tracker not-started';
                noteElement.id = `note-${noteName}`;
                noteElement.innerHTML = `<span>${this.NOTE_NAMES[noteIndex]}</span>`;
                noteElement.title = noteName;

                this.pianoNotes.appendChild(noteElement);
                this.tuningStatus[noteName] = 'not-started';
            }
        }
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.refFreqSlider.addEventListener('input', (e) => this.updateReferenceFrequency(e));
        this.stretchSlider.addEventListener('input', (e) => this.updateStretchFactor(e));
    }

    async start() {
        try {
            // Validate browser context before touching media APIs
            this.runPreflightChecks();

            // Initialize Web Worker
            this.initializeWorker();

            // Initialize Audio Context
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume audio context if suspended (required by browser autoplay policies)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio nodes
            const source = this.audioContext.createMediaStreamAudioSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096;
            this.analyser.smoothingTimeConstant = 0.85;

            // Create script processor for real-time analysis
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            const dataArray = new Float32Array(4096);

            this.scriptProcessor.onaudioprocess = () => {
                this.analyser.getFloatTimeDomainData(dataArray);
                // Send audio data to worker
                this.worker.postMessage({
                    type: 'analyze',
                    audioData: dataArray,
                    sampleRate: this.audioContext.sampleRate
                });
            };

            // Connect audio graph
            source.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            // Update UI
            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.statusLight.classList.remove('inactive');
            this.statusLight.classList.add('active');
            this.statusText.textContent = 'Listening...';

        } catch (error) {
            console.error('Error starting tuner:', error);
            this.handleStartError(error);
            this.stop();
        }
    }

    runPreflightChecks() {
        if (!window.isSecureContext) {
            const err = new Error('Microphone requires a secure context (HTTPS).');
            err.name = 'InsecureContextError';
            throw err;
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            const err = new Error('getUserMedia is unavailable in this browser/context.');
            err.name = 'MediaDevicesUnavailableError';
            throw err;
        }
    }

    handleStartError(error) {
        const reason = this.getReadableStartError(error);
        this.statusText.textContent = reason;
        alert(`Error starting tuner:\n\n${reason}`);
    }

    getReadableStartError(error) {
        const name = error && error.name ? error.name : 'UnknownError';
        const message = error && error.message ? error.message : '';

        if (name === 'InsecureContextError') {
            return 'This page is not in a secure context. Use HTTPS with a valid certificate.';
        }

        if (name === 'MediaDevicesUnavailableError') {
            return 'Browser does not expose microphone APIs here. Check HTTPS, browser support, or restrictive site settings.';
        }

        if (name === 'NotAllowedError' || name === 'SecurityError') {
            return 'Microphone access was blocked. If permissions are already allowed, your host may send a Permissions-Policy header that disables microphone, or the page is inside an iframe without allow="microphone".';
        }

        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            return 'No microphone input device was found.';
        }

        if (name === 'NotReadableError' || name === 'TrackStartError') {
            return 'Microphone is busy or unavailable (possibly in use by another app/tab).';
        }

        if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
            return 'Requested audio constraints are not supported on this device.';
        }

        if (name === 'AbortError') {
            return 'Microphone initialization was interrupted. Please retry.';
        }

        if (name === 'WorkerInitError') {
            return 'Audio worker failed to load. Ensure tuner-worker.js is deployed at the same folder and not blocked by CSP/headers.';
        }

        if (name === 'TypeError' && message.includes('Failed to construct')) {
            return 'Worker or audio API initialization failed. Check browser compatibility and deployment paths.';
        }

        return `Unexpected startup error (${name}). ${message}`.trim();
    }

    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusLight.classList.remove('active');
        this.statusLight.classList.add('inactive');
        this.statusText.textContent = 'Not running';

        // Reset displays
        this.frequencyDisplay.textContent = '-- Hz';
        this.noteNameDisplay.textContent = '--';
        this.centsValueDisplay.textContent = '0.00';
        this.signalStrength.textContent = '-';
        this.signalFill.style.width = '0%';
        this.meterNeedle.style.left = '50%';
    }

    initializeWorker() {
        if (!this.worker) {
            try {
                const workerUrl = new URL('tuner-worker.js', window.location.href);
                this.worker = new Worker(workerUrl);
            } catch (error) {
                const err = new Error(error && error.message ? error.message : 'Failed to create worker');
                err.name = 'WorkerInitError';
                throw err;
            }

            this.worker.onerror = (event) => {
                console.error('Worker runtime error:', event.message || event);
            };

            this.worker.onmessage = (e) => this.handleWorkerMessage(e);
        }
    }

    handleWorkerMessage(event) {
        const { frequency, confidence, amplitude } = event.data;

        // Only process if we have reasonable confidence
        if (confidence < 0.9) {
            this.signalStrength.textContent = Math.round(confidence * 100);
            this.signalFill.style.width = `${Math.max(0, (confidence - 0.7) * 333.33)}%`;
            return;
        }

        // Update signal strength
        const signalPercent = Math.min(100, Math.round(confidence * 100));
        this.signalStrength.textContent = signalPercent;
        this.signalFill.style.width = `${signalPercent}%`;

        // Calculate target frequency using stretched tuning
        const closestNote = this.findClosestNote(frequency);
        const targetFrequency = this.calculateStretchedFrequency(closestNote.semitones);

        // Calculate cents offset
        const cents = this.frequencyToCents(frequency, targetFrequency);

        // Update displays
        this.frequencyDisplay.textContent = frequency.toFixed(2) + ' Hz';
        this.noteNameDisplay.textContent = closestNote.name + closestNote.octave;
        this.centsValueDisplay.textContent = cents.toFixed(2);

        // Update meter needle position
        const needlePosition = 50 + (cents / 100) * 50;
        const clampedPosition = Math.max(0, Math.min(100, needlePosition));
        this.meterNeedle.style.left = clampedPosition + '%';

        // Update tuning tracker for this note
        this.updateNoteTuningStatus(closestNote.name + closestNote.octave, cents);
    }

    updateNoteTuningStatus(noteName, cents) {
        const abscents = Math.abs(cents);
        let status = 'not-started';

        if (abscents <= 5) {
            status = 'tuned';
        } else if (abscents <= 15) {
            status = 'close';
        } else if (abscents <= 30) {
            status = 'off';
        } else {
            status = 'very-off';
        }

        // Always update to current status (allows going up or down as you tune)
        const noteElement = document.getElementById(`note-${noteName}`);
        if (noteElement) {
            this.tuningStatus[noteName] = status;
            noteElement.className = `note-tracker ${status}`;
        }
    }

    findClosestNote(frequency) {
        if (frequency <= 0) {
            return { name: '--', octave: '', semitones: 0 };
        }

        // Calculate semitones from A4 (reference note at index 48)
        // Using: semitones = 12 * log2(frequency / 440)
        const semitones = 12 * Math.log2(frequency / this.referenceFrequency);
        const closestSemitones = Math.round(semitones);

        // Calculate absolute note number (A4 is at 48)
        const noteNumber = this.A4_NOTE_NUMBER + closestSemitones;

        // Calculate octave and note name
        const noteIndex = ((noteNumber % 12) + 12) % 12;
        const octave = Math.floor((noteNumber + 9) / 12) - 1; // Adjust for octave numbering

        return {
            name: this.NOTE_NAMES[noteIndex],
            octave: octave,
            semitones: closestSemitones
        };
    }

    calculateStretchedFrequency(semitonesFromA4) {
        // Apply stretched tuning formula: f = f_ref * 2^(n/12) * (1 + S * n^2)
        const baseFrequency = this.referenceFrequency * Math.pow(2, semitonesFromA4 / 12);
        const stretchFactor = 1 + this.stretchFactor * (semitonesFromA4 * semitonesFromA4);
        return baseFrequency * stretchFactor;
    }

    frequencyToCents(detectedFreq, targetFreq) {
        // Cents = 1200 * log2(detected / target)
        if (targetFreq <= 0 || detectedFreq <= 0) {
            return 0;
        }
        return 1200 * Math.log2(detectedFreq / targetFreq);
    }

    updateReferenceFrequency(event) {
        this.referenceFrequency = parseFloat(event.target.value);
        this.refFreqDisplay.textContent = this.referenceFrequency.toFixed(1);
    }

    updateStretchFactor(event) {
        this.stretchFactor = parseFloat(event.target.value);
        this.stretchDisplay.textContent = this.stretchFactor.toFixed(5);

        // Update the stretch pointer visualization
        // Scale: 0 to 0.0005
        const percentage = (this.stretchFactor / 0.0005) * 100;
        this.stretchPointer.style.left = Math.max(0, Math.min(100, percentage)) + '%';

        // Update description based on factor value
        let description = 'Minimal inharmonicity compensation';
        if (this.stretchFactor < 0.00001) {
            description = 'No compensation (concert pitch only)';
        } else if (this.stretchFactor < 0.00015) {
            description = 'Conservative tuning (modern standards)';
        } else if (this.stretchFactor < 0.00025) {
            description = 'Normal piano tuning (standard range)';
        } else if (this.stretchFactor < 0.00035) {
            description = 'Aggressive compensation (older pianos)';
        } else {
            description = 'Very aggressive (extended range instruments)';
        }
        this.stretchDesc.textContent = description;
    }
}

// Initialize the Piano Tuner when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PianoTuner();
});
