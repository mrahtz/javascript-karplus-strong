// === String ===

function String(audioCtx, octave, semitone) {
    this.audioCtx = audioCtx;
    this.basicHz = String.C0_HZ * Math.pow(2, octave+semitone/12);
    this.basicHz = this.basicHz.toFixed(2);
    
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

String.prototype.pluck = function(time, velocity, tab) {
    console.log(this.basicHz + " Hz string being plucked" +
                " with tab " + tab +
                " with velocity " + velocity +
                " at time " + time + 
                ", actual time " + this.audioCtx.currentTime);

    var hz = this.basicHz * Math.pow(2, tab/12);
    var bufferSource = this.audioCtx.createBufferSource();
    var channels = 1;
    // 1 second buffer
    var frameCount = audioCtx.sampleRate;
    var sampleRate = audioCtx.sampleRate;
    var buffer = this.audioCtx.createBuffer(channels, frameCount, sampleRate);
    // getChannelData returns a Float32Array, so no performance problems these
    var bufferChannelData = buffer.getChannelData(0);
    //renderDecayedSine(bufferChannelData, sampleRate, hz, velocity);
    //renderKarplusStrong(bufferChannelData, this.seedNoise, sampleRate, hz, velocity);
    asmWrapper(bufferChannelData, this.seedNoise, sampleRate, hz, velocity);
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

    // asm.js spec at http://asmjs.org/spec/latest/
    function asmWrapper(targetArray, seedNoise, sampleRate, hz, velocity) {
        var heapFloat32Size = targetArray.length + seedNoise.length;
        var heapFloat32 = new Float32Array(heapFloat32Size);
        for (var i = 0; i < seedNoise.length; i++) {
            heapFloat32[i] = seedNoise[i];
        }

        // from the asm.js spec, it sounds like the heap must be
        // passed in as a plain ArrayBuffer
        var heapBuffer = heapFloat32.buffer;
        var asm = asmFunctions(window, null, heapBuffer);

        var stringDampingSlider = document.getElementById("stringDamping");
        var stringDamping = stringDampingSlider.valueAsNumber;
        
        asm.renderKarplusStrong(0,
                                seedNoise.length-1,
                                seedNoise.length,
                                seedNoise.length+targetArray.length-1,
                                sampleRate,
                                hz,
                                velocity,
                                stringDamping);
        
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
                                     sampleRate, hz, velocity,
                                     stringDamping
                                    ) {
            // coersion to indicate type of arguments
            // ORing with 0 indicates type int
            seedNoiseStart = seedNoiseStart|0;
            seedNoiseEnd = seedNoiseEnd|0;
            targetArrayStart = targetArrayStart|0;
            targetArrayEnd = targetArrayEnd|0;
            sampleRate = sampleRate|0;
            hz = hz|0;

            // Math.fround(x) indicates type float
            var hz_float = Math.fround(hz);
            var period = Math.fround(1/hz_float);
            var periodSamples_float = Math.fround(period*sampleRate);
            // int
            var periodSamples = Math.round(periodSamples_float)|0;
            var frameCount = (targetArrayEnd-targetArrayStart+1)|0;
            var targetIndex = 0;
            var lastOutputSample = 0;

            for (targetIndex = 0;
                    targetIndex < frameCount;
                    targetIndex = (targetIndex + 1)|0) {
                var heapTargetIndex = (targetArrayStart + targetIndex)|0;
                if (targetIndex < periodSamples) {
                    // for the first period, feed in noise
                    var heapNoiseIndex = (seedNoiseStart + targetIndex)|0;
                    var curInputSample = Math.fround(heap[heapNoiseIndex]);
                } else {
                    // for subsequent periods, feed in the output from
                    // one period ago
                    var lastPeriodIndex = heapTargetIndex - periodSamples;
                    var curInputSample = Math.fround(heap[lastPeriodIndex]);
                }

                // output is low-pass filtered version of input
                var curOutputSample =
                    stringDamping*curInputSample 
                    + (1 - stringDamping)*lastOutputSample;
                heap[heapTargetIndex] = curOutputSample;
                lastOutputSample = curOutputSample;
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

// === Guitar ===

// JavaScript's class definitions are just functions
// the function itself serves as the constructor for the class
function Guitar(audioCtx) {
    // 'strings' becomes a 'property'
    // (an instance variable)
    this.strings = [
        new String(audioCtx, 2, 4),   // E2
        new String(audioCtx, 2, 9),   // A2
        new String(audioCtx, 3, 2),   // D3
        new String(audioCtx, 3, 7),   // G3
        new String(audioCtx, 3, 11),  // B3
        new String(audioCtx, 4, 4)    // E4
    ]
}

// each fret represents an increase in pitch by one semitone
// (logarithmically, one-twelth of an octave)
// -1: don't pluck that string
Guitar.C_MAJOR = [-1,  3, 2, 0, 0, 0];
Guitar.G_MAJOR = [ 3,  2, 0, 0, 0, 3];
Guitar.A_MINOR = [ 0,  0, 2, 2, 0, 0];
Guitar.E_MINOR = [ 0,  2, 2, 0, 3, 0];

// To add a class method in JavaScript,
// we add a function property to the class's 'prototype' property
// strum strings set to be strummed by the chord
// (e.g. for C major, don't pluck string 0)
Guitar.prototype.strumChord = function(time, downstroke, velocity, chord) {
    console.log("Strumming with velocity " + velocity +
                ", downstroke: " + downstroke +
                ", at time " + time);
    if (downstroke == true) {
        var pluckOrder = [0, 1, 2, 3, 4, 5];
    } else {
        var pluckOrder = [5, 4, 3, 2, 1, 0];
    }

    for (var i = 0; i < 6; i++) {
        var stringNumber = pluckOrder[i];
        if (chord[stringNumber] == -1) {
            continue;
        }
        this.strings[stringNumber].pluck(time, velocity, chord[stringNumber]);
        time += Math.random()/128;
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
    //var timeUnit = 3/32.0;
    var timeUnit = 4/32.0;
    var currentChord = chords[currentChordIndex];
    guitar.strumChord(startTime + timeUnit * 0,  true,  1.0, currentChord);
    guitar.strumChord(startTime + timeUnit * 4,  true,  1.0, currentChord);
    guitar.strumChord(startTime + timeUnit * 6,  false, 0.8, currentChord);
    guitar.strumChord(startTime + timeUnit * 10, false, 0.8, currentChord);
    guitar.strumChord(startTime + timeUnit * 12, true,  1.0, currentChord);
    guitar.strumChord(startTime + timeUnit * 14, false, 0.8, currentChord);
    guitar.strumChord(startTime + timeUnit * 16, true,  1.0, currentChord);
    guitar.strumChord(startTime + timeUnit * 20, true,  1.0, currentChord);
    guitar.strumChord(startTime + timeUnit * 22, false, 0.8, currentChord);
    guitar.strumChord(startTime + timeUnit * 26, false, 0.8, currentChord);
    guitar.strumChord(startTime + timeUnit * 28, true,  1.0, currentChord);
    guitar.strumChord(startTime + timeUnit * 30, false, 0.8, currentChord);
    guitar.strings[2].pluck(startTime + timeUnit * 31,   0.7, currentChord[2]);
    guitar.strings[1].pluck(startTime + timeUnit * 31.5, 0.7, currentChord[1]);
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


guitarInfoPara = document.getElementById("guitarinfo");

for (var i = 0; i < guitar.strings.length; i++) {
    guitarInfoPara.innerHTML +=
        "String " + i
        + " has fundamental tone " + guitar.strings[i].basicHz + " Hz"
        + "<br />";
}

chords = [Guitar.C_MAJOR,
          Guitar.G_MAJOR,
          Guitar.A_MINOR,
          Guitar.E_MINOR];
queueStrums(0, chords, 0);
