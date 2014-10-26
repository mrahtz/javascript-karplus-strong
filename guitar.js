// === String ===

function String(audioCtx, octave, semitone) {
    this.audioCtx = audioCtx;
    this.basicHz = String.C0_HZ * Math.pow(2, octave+semitone/12);
    this.hz = this.basicHz;
    
    var basicPeriod = 1/this.basicHz;
    var basicPeriodSamples = Math.round(basicPeriod * audioCtx.sampleRate);
    this.seedNoise = generateSeedNoise(basicPeriodSamples);

    function generateSeedNoise(samples) {
        var noiseArray = new Float32Array(samples);
        for (i = 0; i < samples; i++) {
            // Math.random() only returns between 0 and 1
            noiseArray[i] = -1 + 2*Math.random();
        }
        return noiseArray;
    }
}

// work from A0 as a reference,
// since it has a nice round frequency
String.A0_HZ = 27.5;
// an increase in octave by 1 doubles the frequency
// each octave is divided into 12 semitones
// the scale goes C0, C0#, D0, D0#, E0, F0, F0#, G0, G0#, A0, A0#, B0
// so go back 9 semitones to get to C0
String.C0_HZ = String.A0_HZ * Math.pow(2, -9/12);

String.prototype.pluck = function(time, velocity) {
    console.log(this.hz + " Hz string being plucked" +
                " with velocity " + velocity +
                " at time " + time + 
                ", actual time " + this.audioCtx.currentTime);

    var bufferSource = this.audioCtx.createBufferSource();
    var channels = 1;
    // 1 second buffer
    var frameCount = audioCtx.sampleRate;
    var sampleRate = audioCtx.sampleRate;
    var buffer = this.audioCtx.createBuffer(channels, frameCount, sampleRate);
    // getChannelData returns a Float32Array, so no performance problems these
    var bufferChannelData = buffer.getChannelData(0);
    //renderDecayedSine(bufferChannelData, sampleRate, this.hz, velocity);
    //renderKarplusStrong(bufferChannelData, this.seedNoise, sampleRate, this.hz, velocity);
    asmWrapper(bufferChannelData, this.seedNoise, sampleRate, this.hz, velocity);
    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);
    bufferSource.start(time);

    function renderDecayedSine(targetArray, sampleRate, hz, velocity) {
        var frameCount = targetArray.length;
        for (var i = 0; i < frameCount; i++) {
            targetArray[i] =
                velocity *
                Math.pow(2, -i/(frameCount/8)) *
                Math.sin(2 * Math.PI * hz * i/sampleRate);
        }
        // doesn't seem to make much effect
        /*for (var i = 0; i < bufferChannelData.length-2; i++) {
            bufferChannelData[i] = 0.5*(bufferChannelData[i+1] + bufferChannelData[i+2]);
        }*/
    }

    function renderKarplusStrong(targetArray, seedNoise, sampleRate, hz, velocity) {
        var period = 1/hz;
        var periodSamples = period * sampleRate;
        var frameCount = targetArray.length;
        for (var i = 0; i < frameCount; i++) {
            var noiseIndex = i % periodSamples;
            targetArray[i] =
                seedNoise[noiseIndex];
        }
    }

    function asmWrapper(targetArray, seedNoise, sampleRate, hz, velocity) {
        var heapSize = targetArray.length + seedNoise.length;
        // targetArray and seedNoise are both Float32Arrays
        // so to get the heap size in bytes, multiply by 4
        heapSize *= 4;
        var heap = new ArrayBuffer(heapSize);
        var heapFloat32 = new Float32Array(heap);
        for (var i = 0; i < seedNoise.length; i++) {
            heapFloat32[i] = seedNoise[i];
        }
        var asm = asmFunctions(window, null, heap);
        
        asm.renderKarplusStrong(0,
                                seedNoise.length-1,
                                seedNoise.length,
                                seedNoise.length+targetArray.length-1,
                                sampleRate,
                                hz,
                                velocity);
        
        /*
        asm.renderDecayedSine(0,
                              seedNoise.length-1,
                              seedNoise.length,
                              seedNoise.length+targetArray.length-1,
                              sampleRate,
                              hz,
                              velocity);
        */
        for (var i = 0; i < targetArray.length; i++) {
            targetArray[i] = heapFloat32[seedNoise.length+i];
        }
    }

    function asmFunctions(stdlib, foreign, heapBuffer) {
        "use asm";

        // heap is supposed to come in as just an ArrayBuffer
        // so first need to get a Float32 of it
        var heap = new Float32Array(heapBuffer);

        function renderKarplusStrong(seedNoiseStart, seedNoiseEnd,
                                     targetArrayStart, targetArrayEnd,
                                     sampleRate, hz, velocity) {
            // coersion to indicate type of arguments
            seedNoiseStart = seedNoiseStart|0;
            seedNoiseEnd = seedNoiseEnd|0;
            targetArrayStart = targetArrayStart|0;
            targetArrayEnd = targetArrayEnd|0;
            sampleRate = sampleRate|0;
            hz = hz|0;
            // use Math.fround(x) to specify x's type to be 'float'
            var hz_float = Math.fround(hz);
            var unity = Math.fround(1);
            var period = Math.fround(unity/hz_float);
            var periodSamples_float = Math.fround(period*sampleRate);
            // int
            var periodSamples = Math.round(periodSamples_float)|0;
            var frameCount = (targetArrayEnd-targetArrayStart+1)|0;

            var targetIndex = 0;
            while(1) {
                var noiseIndex = (targetIndex % periodSamples)|0;
                var heapNoiseIndex = (seedNoiseStart + noiseIndex)|0;
                var heapTargetIndex = (targetArrayStart + targetIndex)|0;
                heap[heapTargetIndex] =
                    velocity *
                    Math.pow(2, -Math.fround(targetIndex) / (Math.fround(frameCount)/8)) *
                    Math.fround(heap[heapNoiseIndex]);
                targetIndex = (targetIndex + 1)|0;
                if (targetIndex == frameCount) {
                    break;
                }
            }
        }

        function renderDecayedSine(seedNoiseStart, seedNoiseEnd,
                                   targetArrayStart, targetArrayEnd,
                                   sampleRate, hz, velocity) {
            // coersion to indicate type of arguments
            seedNoiseStart = seedNoiseStart|0;
            seedNoiseEnd = seedNoiseEnd|0;
            targetArrayStart = targetArrayStart|0;
            targetArrayEnd = targetArrayEnd|0;
            sampleRate = sampleRate|0;
            hz = hz|0;
            velocity = +velocity;
            // use Math.fround(x) to specify x's type to be 'float'
            var hz_float = Math.fround(hz);
            var unity = Math.fround(1);
            var period = Math.fround(unity/hz_float);
            var periodSamples_float = Math.fround(period*sampleRate);
            // int
            var periodSamples = Math.round(periodSamples_float)|0;
            var frameCount = (targetArrayEnd-targetArrayStart+1)|0;

            var targetIndex = 0;
            while(1) {
                var heapTargetIndex = (targetArrayStart + targetIndex)|0;
                var t = Math.fround(Math.fround(targetIndex)/Math.fround(sampleRate));
                heap[heapTargetIndex] = 
                    velocity *
                    Math.pow(2, -Math.fround(targetIndex) / (Math.fround(frameCount)/8)) *
                    Math.sin(2 * Math.PI * hz * t);
                targetIndex = (targetIndex + 1)|0;
                if (targetIndex == frameCount) {
                    break;
                }
            }
        }

        return { renderKarplusStrong: renderKarplusStrong,
                 renderDecayedSine: renderDecayedSine };
    }
}

String.prototype.setTab = function(tab) {
    console.log("Setting tab " + tab +
                " on string with basicHz " + this.basicHz);
    this.hz = this.basicHz * Math.pow(2, tab/12);
    console.log("New frequency is " + this.hz);
};

// === Guitar ===

function Guitar(audioCtx) {
    this.strings = [
        new String(audioCtx, 2, 4),   // E2
        new String(audioCtx, 2, 9),   // A2
        new String(audioCtx, 3, 2),   // D3
        new String(audioCtx, 3, 7),   // G3
        new String(audioCtx, 3, 11),  // B3
        new String(audioCtx, 4, 4)    // E4
    ]
}

Guitar.C_MAJOR = [-1,  3, 2, 0, 0, 0];
Guitar.G_MAJOR = [ 3,  2, 0, 0, 0, 3];
Guitar.A_MINOR = [ 0,  0, 2, 2, 0, 0];
Guitar.E_MINOR = [ 0,  2, 2, 0, 3, 0];

Guitar.prototype.setChord = function(chord) {
    console.log("Setting chord " + chord);
    for (var i = 0; i < 6; i++) {
        this.strings[i].setTab(chord[i]);
    }
};

Guitar.prototype.pluck = function(time, stringIndex, velocity) {
    console.log("Plucking string " + stringIndex +
                ", velocity " + velocity +
                ", time " + time); 
    this.strings[stringIndex].pluck(time, velocity);
};

Guitar.prototype.strum = function(time, downstroke, velocity) {
    console.log("Strumming with velocity " + velocity +
                ", downstroke: " + downstroke +
                ", at time " + time);
    if (downstroke == true) {
        for (var i = 0; i < 6; i++) {
            this.strings[i].pluck(time, velocity);
            time += Math.random()/128;
        }
    } else {
        for (var i = 5; i >= 0; i--) {
            this.strings[i].pluck(time, velocity);
            time += Math.random()/128;
        }
    }
};

// === Rhythm code ===

// dummy source used to start playback of next
// set of chords
function createDummySource(audioCtx) {
    dummySource = audioCtx.createBufferSource();
    var channels = 1;
    // 2 samples seems to the the minimum to get it to work
    var frameCount = 2;
    dummySource.buffer = 
        audioCtx.createBuffer(channels, frameCount, audioCtx.sampleRate);
    dummySource.connect(audioCtx.destination);
    return dummySource;
}

function queueStrums(startTime, chords, currentChordIndex) {
    var timeUnit = 3/32.0;
    var currentChord = chords[currentChordIndex];
    guitar.setChord(currentChord);
    guitar.strum(startTime + timeUnit * 0,  true,  1.0);
    guitar.strum(startTime + timeUnit * 4,  true,  1.0);
    guitar.strum(startTime + timeUnit * 6,  false, 0.8);
    guitar.strum(startTime + timeUnit * 10, false, 0.8);
    guitar.strum(startTime + timeUnit * 12, true,  1.0);
    guitar.strum(startTime + timeUnit * 14, false, 0.8);
    guitar.strum(startTime + timeUnit * 16, true,  1.0);
    guitar.strum(startTime + timeUnit * 20, true,  1.0);
    guitar.strum(startTime + timeUnit * 22, false, 0.8);
    guitar.strum(startTime + timeUnit * 26, false, 0.8);
    guitar.strum(startTime + timeUnit * 28, true,  1.0);
    guitar.strum(startTime + timeUnit * 30, false, 0.8);
    guitar.pluck(startTime + timeUnit * 31,   2, 0.7);
    guitar.pluck(startTime + timeUnit * 31.5, 1, 0.7);
    var nextChord = (currentChordIndex + 1) % 4;
    var dummySource = createDummySource(audioCtx);
    dummySource.onended = function() { 
        queueStrums(startTime + timeUnit*32, chords, nextChord);
    };
    dummySource.start(startTime + timeUnit*16);
}

// webkitAudioContext for Webkit browsers
// AudioContext for Firefox
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var guitar = new Guitar(audioCtx);
var startTime = audioCtx.currentTime;

chords = [Guitar.C_MAJOR,
          Guitar.G_MAJOR,
          Guitar.A_MINOR,
          Guitar.E_MINOR];
queueStrums(0, chords, 0);
