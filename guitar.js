var timeUnit = 4/32;

// === resonate ===

// samples: a Float32Array containing samples to apply
// to a guitar body
function resonate(samples) {
    // asm.js requires all data in/out of function to
    // be done through heap object
    // from the asm.js spec, it sounds like the heap must be
    // passed in as a plain ArrayBuffer
    var heapBuffer = samples.buffer;
    var asm = asmFunctions(window, null, heapBuffer);
    asm.simpleBody();

    // standard asm.js block
    // stdlib: object through which standard library functions are called
    // foreign: object through which external javascript functions are called
    // heap: buffer used for all data in/out of function
    function asmFunctions(stdlib, foreign, heapBuffer) {
        "use asm";

        // heap is supposed to come in as just an ArrayBuffer
        // so first need to get a Float32 of it
        var heap = new Float32Array(heapBuffer);

        // this is copied verbatim from the original ActionScript source
        // haven't figured out how it works yet
        function simpleBody() {
            var r00, r01, f00, f01, r10, r11, f10, f11, f0,
                c0, c1, r0, r1;
            r00 = r01 = f00 = f01 = r10 = r11 = f10 = f11 = f0 = f1 = 0.0;
            c0 = 2 * Math.sin(Math.PI * 3.4375 / 44100);
            c1 = 2 * Math.sin(Math.PI * 6.124928687214833 / 44100);
            r0 = 0.98;
            r1 = 0.98;
            for (var i = 0; i < heap.length; i++) {
                var curSample = heap[i];
                r00 = r00 * r0;
                r00 = r00 + (f0 - f00) * c0;
                f00 = f00 + r00;
                f00 = f00 - f00 * f00 * f00 * 0.166666666666666;
                r01 = r01 * r0;
                r01 = r01 + (f1 - f01) * c0;
                f01 = f01 + r01;
                f01 = f01 - f01 * f01 * f01 * 0.166666666666666;
                r10 = r10 * r1;
                r10 = r10 + (f0 - f10) * c1;
                f10 = f10 + r10;
                f10 = f10 - f10 * f10 * f10 * 0.166666666666666;
                r11 = r11 * r1;
                r11 = r11 + (f1 - f11) * c1;
                f11 = f11 + r11;
                f11 = f11 - f11 * f11 * f11 * 0.166666666666666;
                f0 = heap[i];
                //f1 = _loc4_.c1;
                heap[i] = f0 + (f00 + f10) * 2;
                //_loc4_.c1 = f1 + (f01 + f11) * 2;
            }
        }

        return {
            simpleBody: simpleBody
        };
    }
}

// === String ===

function String(audioCtx, octave, semitone) {
    this.audioCtx = audioCtx;
    this.basicHz = String.C0_HZ * Math.pow(2, octave+semitone/12);
    this.basicHz = this.basicHz.toFixed(2);

    // this is only used in a magical calculation of filter coefficients
    this.semitoneIndex = octave*12 + semitone - 9;
    
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
                " at beat " + (time/timeUnit).toFixed(2) + 
                ", actual time " + this.audioCtx.currentTime);

    var bufferSource = this.audioCtx.createBufferSource();
    var channels = 1;
    // 1 second buffer
    var frameCount = audioCtx.sampleRate;
    var sampleRate = audioCtx.sampleRate;
    var buffer = this.audioCtx.createBuffer(channels, frameCount, sampleRate);
    // getChannelData returns a Float32Array, so no performance problems these
    var bufferChannelData = buffer.getChannelData(0);

    var options = getOptions();
    var smoothingFactor = calculateSmoothingFactor(this, tab, options);
    var hz = this.basicHz * Math.pow(2, tab/12);

    asmWrapper(bufferChannelData, this.seedNoise, sampleRate, hz, smoothingFactor, velocity, options);
    if (options.body == "simple") {
        resonate(bufferChannelData);
    }

    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);
    // start playing at 'time'
    bufferSource.start(time);

    // calculate the constant used for the low-pass filter
    // used in the Karplus-Strong loop
    function calculateSmoothingFactor(string, tab, options) {
        var smoothingFactor;
        if (options.stringDampingCalculation == "direct") {
            smoothingFactor = options.stringDamping;
        } else if (options.stringDampingCalculation == "magic") {
            // this is copied verbatim from the flash one
            // is magical, don't know how it works
            var noteNumber = (string.semitoneIndex + tab - 19)/44;
            smoothingFactor = 
                options.stringDamping
                + Math.pow(noteNumber, 0.5) * (1 - options.stringDamping) * 0.5
                + (1 - options.stringDamping)
                    * Math.random()
                    * options.stringDampingVariation;
        }
        return smoothingFactor;
    }

    function getOptions() {
        var stringTensionSlider =
            document.getElementById("stringTension");
        var stringTension = stringTensionSlider.valueAsNumber;

        var characterVariationSlider =
            document.getElementById("characterVariation");
        var characterVariation = characterVariationSlider.valueAsNumber;

        var stringDampingSlider =
            document.getElementById("stringDamping");
        var stringDamping = stringDampingSlider.valueAsNumber;

        var stringDampingVariationSlider =
            document.getElementById("stringDampingVariation");
        var stringDampingVariation = stringDampingVariationSlider.valueAsNumber;

        var magicCalculationRadio =
            document.getElementById("magicCalculation");
        var directCalculationRadio =
            document.getElementById("directCalculation");
        if (magicCalculationRadio.checked) {
            var stringDampingCalculation = "magic";
        } else if (directCalculationRadio.checked) {
            var stringDampingCalculation = "direct";
        }

        var noBodyRadio =
            document.getElementById("noBody");
        var simpleBodyRadio =
            document.getElementById("simpleBody");
        if (noBodyRadio.checked) {
            var body = "none"
        } else if (simpleBodyRadio.checked) {
            var body = "simple";
        }
        
        return {
            stringTension: stringTension,
            characterVariation: characterVariation,
            stringDamping: stringDamping,
            stringDampingVariation: stringDampingVariation,
            stringDampingCalculation: stringDampingCalculation,
            body: body
        };
    }

    // asm.js spec at http://asmjs.org/spec/latest/
    function asmWrapper(targetArray, seedNoise, sampleRate, hz, smoothingFactor, velocity, options) {
        var heapFloat32Size = targetArray.length + seedNoise.length;
        var heapFloat32 = new Float32Array(heapFloat32Size);
        for (var i = 0; i < seedNoise.length; i++) {
            heapFloat32[i] = seedNoise[i];
        }

        // from the asm.js spec, it sounds like the heap must be
        // passed in as a plain ArrayBuffer
        var heapBuffer = heapFloat32.buffer;
        var asm = asmFunctions(window, null, heapBuffer);

        var heapOffsets = {
            seedStart: 0,
            seedEnd: seedNoise.length-1,
            targetStart: seedNoise.length,
            targetEnd: seedNoise.length+targetArray.length-1
        };

        asm.renderKarplusStrong(heapOffsets,
                                sampleRate,
                                hz,
                                velocity,
                                smoothingFactor,
                                options.stringTension,
                                options.characterVariation);
        
        /*
        asm.renderDecayedSine(heapOffsets,
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

        // the "smoothing factor" parameter is the coefficient
        // used on the terms in the low-pass filter
        function renderKarplusStrong(heapOffsets,
                                     sampleRate, hz, velocity,
                                     smoothingFactor, stringTension,
                                     characterVariation
                                    ) {
            // coersion to indicate type of arguments
            // ORing with 0 indicates type int
            var seedNoiseStart = heapOffsets.noiseStart|0;
            var seedNoiseEnd = heapOffsets.noiseEnd|0;
            var targetArrayStart = heapOffsets.targetStart|0;
            var targetArrayEnd = heapOffsets.targetEnd|0;
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
                    targetIndex++) {
                var heapTargetIndex = (targetArrayStart + targetIndex)|0;
                if (targetIndex < periodSamples) {
                    // for the first period, feed in noise
                    var heapNoiseIndex = (seedNoiseStart + targetIndex)|0;
                    var curInputSample = Math.fround(heap[heapNoiseIndex]);
                    // create room for character variation noise
                    curInputSample *= (1 - characterVariation);
                    // add character variation
                    curInputSample += characterVariation * (-1 + 2*Math.random());
                } else {
                    // for subsequent periods, feed in the output from
                    // about one period ago
                    var lastPeriodIndex = heapTargetIndex - periodSamples;
                    var skipFromTension = Math.round(stringTension * periodSamples);
                    var inputIndex = lastPeriodIndex + skipFromTension;
                    var curInputSample = Math.fround(heap[inputIndex]);
                }

                // output is low-pass filtered version of input
                var curOutputSample =
                    smoothingFactor*curInputSample 
                    + (1 - smoothingFactor)*lastOutputSample;
                heap[heapTargetIndex] = curOutputSample;
                lastOutputSample = curOutputSample;
            }
        }

        function renderDecayedSine(heapOffsets,
                                   sampleRate, hz, velocity) {
            // coersion to indicate type of arguments
            var seedNoiseStart = heapOffsets.noiseStart|0;
            var seedNoiseEnd = heapOffsets.noiseEnd|0;
            var targetArrayStart = heapOffsets.targetStart|0;
            var targetArrayEnd = heapOffsets.targetEnd|0;
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
                ", at beat " + (time/timeUnit));
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

// dummy source used to queue next part of rhythm
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

// Create sound samples for the current part of the rhythm sequence,
// and queue creation of the following part of the rhythm.
// The rhythms parts have as fine a granularity as possible to enable
// adjustment of guitar parameters with real-time feedback.
// (The larger the parts, the longer the possible delay between
//  parameter adjustments and samples created with the new parameters.)
function queueSequence(sequenceN, startTime, chords, chordIndex) {
    console.log("Sequence number " + sequenceN);
    var chord = chords[chordIndex];

    switch(sequenceN % 13) {
        case 0:
            var samplePlayTime = startTime + timeUnit * 0;
            guitar.strumChord(samplePlayTime,  true,  1.0, chord);
            break;
        case 1:
            var samplePlayTime = startTime + timeUnit * 4;
            guitar.strumChord(samplePlayTime,  true,  1.0, chord);
            break;
        case 2:
            var samplePlayTime = startTime + timeUnit * 6;
            guitar.strumChord(samplePlayTime,  false, 0.8, chord);
            break;
        case 3:
            var samplePlayTime = startTime + timeUnit * 10;
            guitar.strumChord(samplePlayTime, false, 0.8, chord);
            break;
        case 4:
            var samplePlayTime = startTime + timeUnit * 12;
            guitar.strumChord(samplePlayTime, true,  1.0, chord);
            break;
        case 5:
            var samplePlayTime = startTime + timeUnit * 14;
            guitar.strumChord(samplePlayTime, false, 0.8, chord);
            break;
        case 6:
            var samplePlayTime = startTime + timeUnit * 16;
            guitar.strumChord(samplePlayTime, true,  1.0, chord);
            break;
        case 7:
            var samplePlayTime = startTime + timeUnit * 20;
            guitar.strumChord(samplePlayTime, true,  1.0, chord);
            break;
        case 8:
            var samplePlayTime = startTime + timeUnit * 22;
            guitar.strumChord(samplePlayTime, false, 0.8, chord);
            break;
        case 9:
            var samplePlayTime = startTime + timeUnit * 26;
            guitar.strumChord(samplePlayTime, false, 0.8, chord);
            break;
        case 10:
            var samplePlayTime = startTime + timeUnit * 28;
            guitar.strumChord(samplePlayTime, true,  1.0, chord);
            break;
        case 11:
            var samplePlayTime = startTime + timeUnit * 30;
            guitar.strumChord(samplePlayTime, false, 0.8, chord);
            break;
        case 12:

            var samplePlayTime = startTime + timeUnit * 31;
            guitar.strings[2].pluck(samplePlayTime,   0.7, chord[2]);

            var samplePlayTime = startTime + timeUnit * 31.5;
            guitar.strings[1].pluck(samplePlayTime, 0.7, chord[1]);

            chordIndex = (chordIndex + 1) % 4;
            startTime += timeUnit*32;

            break;
    }

    var queuerSource = createDummySource(audioCtx);
    queuerSource.onended = function() { 
        queueSequence(sequenceN + 1, startTime, chords, chordIndex);
    };
    // generate the sample following the one we've just generated
    // at the same time as the current sample starts playing
    // (should allow enough time for that next sample to be generated
    //  before it comes time to play it)
    queuerSource.start(samplePlayTime);
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
var startTime = 0;
var startChordIndex = 0;
var startSequenceN = 0;
queueSequence(startSequenceN, startTime, chords, startChordIndex);
