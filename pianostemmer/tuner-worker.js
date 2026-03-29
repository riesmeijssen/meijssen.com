/**
 * Piano Tuner - Web Worker
 * Performs autocorrelation-based pitch detection
 */

// Buffer to accumulate audio samples
let sampleBuffer = new Float32Array(4096);
let bufferIndex = 0;

// Listen for messages from main thread
self.onmessage = function(event) {
    if (event.data.type === 'analyze') {
        const audioData = event.data.audioData;
        const sampleRate = event.data.sampleRate;

        // Accumulate samples
        for (let i = 0; i < audioData.length; i++) {
            sampleBuffer[bufferIndex++] = audioData[i];

            // Once buffer is full, perform analysis
            if (bufferIndex >= 4096) {
                const result = analyzeAudioBuffer(sampleBuffer, sampleRate);
                self.postMessage(result);
                bufferIndex = 0;
            }
        }
    }
};

/**
 * Analyze audio buffer using autocorrelation algorithm
 * @param {Float32Array} buffer - Audio samples (4096 samples)
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {Object} Detection result with frequency, confidence, and amplitude
 */
function analyzeAudioBuffer(buffer, sampleRate) {
    // Pre-process: normalize and remove DC offset
    const normalized = preprocessAudio(buffer);

    // Calculate RMS to check signal strength
    const rms = calculateRMS(normalized);

    // If signal is too weak, return low confidence
    if (rms < 0.01) {
        return {
            frequency: 0,
            confidence: 0,
            amplitude: rms
        };
    }

    // Perform autocorrelation analysis
    const result = autocorrelation(normalized, sampleRate);

    return {
        frequency: result.frequency,
        confidence: result.confidence,
        amplitude: rms
    };
}

/**
 * Preprocess audio: normalize and remove DC offset
 * @param {Float32Array} buffer - Raw audio samples
 * @returns {Float32Array} Preprocessed samples
 */
function preprocessAudio(buffer) {
    const processed = new Float32Array(buffer.length);

    // Calculate DC offset (mean)
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
    }
    const dcOffset = sum / buffer.length;

    // Remove DC offset and find max amplitude
    let maxAmplitude = 0;
    for (let i = 0; i < buffer.length; i++) {
        processed[i] = buffer[i] - dcOffset;
        maxAmplitude = Math.max(maxAmplitude, Math.abs(processed[i]));
    }

    // Normalize to [-1, 1]
    if (maxAmplitude > 0) {
        for (let i = 0; i < buffer.length; i++) {
            processed[i] /= maxAmplitude;
        }
    }

    return processed;
}

/**
 * Calculate RMS (Root Mean Square) of audio signal
 * @param {Float32Array} buffer - Audio samples
 * @returns {number} RMS value
 */
function calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
}

/**
 * Autocorrelation Lag Windowing ACF (Accurate Correlation Function)
 * Efficient pitch detection algorithm suitable for real-time processing
 * @param {Float32Array} buffer - Audio samples
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {Object} Frequency and confidence
 */
function autocorrelation(buffer, sampleRate) {
    const SIZE = buffer.length;
    const MAX_SAMPLES = SIZE;

    // Apply Hann window to reduce spectral leakage
    const windowedBuffer = applyHannWindow(buffer);

    // Compute autocorrelation
    const autocorr = computeAutocorrelation(windowedBuffer);

    // Find the first peak in autocorrelation (which represents the fundamental frequency)
    const { lag, strength } = findAutocorrelationPeak(autocorr, sampleRate);

    if (lag === 0 || strength < 0.1) {
        return {
            frequency: 0,
            confidence: 0
        };
    }

    // Convert lag to frequency
    const frequency = sampleRate / lag;

    // Estimate confidence based on peak strength
    const confidence = Math.min(1, strength);

    return {
        frequency: frequency,
        confidence: confidence
    };
}

/**
 * Apply Hann (Hanning) window to reduce spectral leakage
 * @param {Float32Array} buffer - Audio samples
 * @returns {Float32Array} Windowed samples
 */
function applyHannWindow(buffer) {
    const windowed = new Float32Array(buffer.length);
    const N = buffer.length;

    for (let i = 0; i < N; i++) {
        const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        windowed[i] = buffer[i] * window;
    }

    return windowed;
}

/**
 * Compute autocorrelation using efficient method
 * Correlation(x, x) at different lags
 * @param {Float32Array} buffer - Audio samples
 * @returns {Float32Array} Autocorrelation values
 */
function computeAutocorrelation(buffer) {
    const SIZE = buffer.length;
    const autocorr = new Float32Array(SIZE / 2);

    // Compute energy
    let energy = 0;
    for (let i = 0; i < SIZE; i++) {
        energy += buffer[i] * buffer[i];
    }

    // Compute autocorrelation for different lags
    for (let lag = 0; lag < SIZE / 2; lag++) {
        let sum = 0;
        for (let i = 0; i < SIZE - lag; i++) {
            sum += buffer[i] * buffer[i + lag];
        }
        // Normalize by energy for correlation coefficient
        autocorr[lag] = energy > 0 ? sum / energy : 0;
    }

    return autocorr;
}

/**
 * Find the first significant peak in autocorrelation
 * This peak corresponds to the fundamental frequency
 * @param {Float32Array} autocorr - Autocorrelation values
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {Object} Lag where peak occurs and strength of peak
 */
function findAutocorrelationPeak(autocorr, sampleRate) {
    // Piano range: approximately 27 Hz (A0) to 4186 Hz (C8)
    // Calculate corresponding lag ranges
    const minFrequency = 27.5; // A0
    const maxFrequency = 4200; // Upper limit
    const minLag = Math.floor(sampleRate / maxFrequency);
    const maxLag = Math.ceil(sampleRate / minFrequency);

    let bestLag = 0;
    let bestStrength = 0;

    // Search for peak in valid frequency range
    for (let lag = minLag; lag < Math.min(maxLag, autocorr.length); lag++) {
        // Look for local maximum
        const value = autocorr[lag];

        // Check if this is a local maximum
        if (lag > minLag && lag < autocorr.length - 1) {
            if (value > autocorr[lag - 1] && value > autocorr[lag + 1]) {
                // Additional checks for valid peaks
                if (value > 0.1) { // Threshold for valid peak
                    if (value > bestStrength) {
                        bestStrength = value;
                        bestLag = lag;
                    }
                }
            }
        }
    }

    // If no peak found in the range, use a simple threshold search
    if (bestLag === 0) {
        for (let lag = minLag; lag < Math.min(maxLag, autocorr.length); lag++) {
            if (autocorr[lag] > bestStrength && autocorr[lag] > 0.1) {
                bestStrength = autocorr[lag];
                bestLag = lag;
            }
        }
    }

    // Refine peak position using parabolic interpolation
    if (bestLag > 0 && bestLag < autocorr.length - 1) {
        const y1 = autocorr[bestLag - 1];
        const y2 = autocorr[bestLag];
        const y3 = autocorr[bestLag + 1];

        if (y2 > y1 && y2 > y3) {
            // Parabolic interpolation
            const a = (y3 + y1 - 2 * y2) / 2;
            const b = (y3 - y1) / 2;

            if (Math.abs(a) > 0.0001) {
                const refinement = -b / (2 * a);
                bestLag = bestLag + refinement;
            }
        }
    }

    return {
        lag: bestLag,
        strength: bestStrength
    };
}
