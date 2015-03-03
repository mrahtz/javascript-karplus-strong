// this was derived experimentally to match Andre Michelle's
// TODO
// * currently sounds strange when characterVariation = 0

// I've no idea how it works out as this...
// it doesn't seem to appear in the code anywhere
var timeUnit = 0.12;

// === resonate ===

// samples: a Float32Array containing samples to apply
// to a guitar body
function resonate(samples) {
    // asm.js requires all data in/out of function to
    // be done through heap object
    // from the asm.js spec, it sounds like the heap must be
    // passed in as a plain ArrayBuffer
    // (.buffer is the ArrayBuffer referenced by the Float32Buffer)
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
            var r00, f00, r10, f10, f0,
                c0, c1, r0, r1;
            r00 = f00 = r10 = f10 = f0 = f1 = 0.0;
            c0 = 2 * Math.sin(Math.PI * 3.4375 / 44100);
            c1 = 2 * Math.sin(Math.PI * 6.124928687214833 / 44100);
            r0 = 0.98;
            r1 = 0.98;
            var lastInput = 0, lastOutput = 0;
            for (var i = 0; i < heap.length; i++) {
                r00 = r00 * r0;
                r00 = r00 + (f0 - f00) * c0;
                f00 = f00 + r00;
                f00 = f00 - f00 * f00 * f00 * 0.166666666666666;
                r10 = r10 * r1;
                r10 = r10 + (f0 - f10) * c1;
                f10 = f10 + r10;
                f10 = f10 - f10 * f10 * f10 * 0.166666666666666;
                f0 = heap[i];
                heap[i] = f0 + (f00 + f10) * 2;

                var curInput = heap[i];
                heap[i] = 0.99 * lastOutput + 0.99*(curInput - lastInput);
                lastInput = curInput;
                lastOutput = heap[i];
            }
        }

        return {
            simpleBody: simpleBody
        };
    }
}

// === GuitarString ===

function GuitarString(audioCtx, stringN, octave, semitone) {
    this.audioCtx = audioCtx;
    this.basicHz = GuitarString.C0_HZ * Math.pow(2, octave+semitone/12);
    this.basicHz = this.basicHz.toFixed(2);

    // this is only used in a magical calculation of filter coefficients
    this.semitoneIndex = octave*12 + semitone - 9;
    // also magic, used for stereo spread
    // from -1 for first string to +1 for last
    this.prePan = (stringN - 2.5) * 0.4;
    
    var basicPeriod = 1/this.basicHz;
    var basicPeriodSamples = Math.round(basicPeriod * audioCtx.sampleRate);
    this.seedNoise = generateSeedNoise(65535, basicPeriodSamples);

    function generateSeedNoise(seed, samples) {
        var noiseArray = new Float32Array(samples);
        for (var i = 0; i < samples; i++) {
            // taken directly from ActionScript
            var _loc1_ = 16807 * (seed & 65535);
            var _loc2_ = 16807 * (seed >> 16);
            _loc1_ = _loc1_ + ((_loc2_ & 32767) << 16);
            _loc1_ = _loc1_ + (_loc2_ >> 15);
            if (_loc1_ > 4.151801719E9)
            {
                _loc1_ = _loc1_ - 4.151801719E9;
            }
            var rand = (seed = _loc1_) / 4.151801719E9 * 2 - 1;
            noiseArray[i] = rand;
        }
        return noiseArray;
    }
}

// work from A0 as a reference,
// since it has a nice round frequency
GuitarString.A0_HZ = 27.5;
// an increase in octave by 1 doubles the frequency
// each octave is divided into 12 semitones
// the scale goes C0, C0#, D0, D0#, E0, F0, F0#, G0, G0#, A0, A0#, B0
// so go back 9 semitones to get to C0
GuitarString.C0_HZ = GuitarString.A0_HZ * Math.pow(2, -9/12);

GuitarString.prototype.pluck = function(time, velocity, tab) {
    console.log(this.basicHz + " Hz string being plucked" +
                " with tab " + tab +
                " with velocity " + velocity +
                " at beat " + (time/timeUnit).toFixed(2) + 
                ", actual time " + this.audioCtx.currentTime);

    var bufferSource = this.audioCtx.createBufferSource();
    var channels = 2;
    // 1 second buffer
    var frameCount = audioCtx.sampleRate;
    var sampleRate = audioCtx.sampleRate;
    var buffer = this.audioCtx.createBuffer(channels, frameCount, sampleRate);

    var options = getOptions();
    var smoothingFactor = calculateSmoothingFactor(this, tab, options);
    var hz = this.basicHz * Math.pow(2, tab/12);

    asmWrapper(buffer, this.seedNoise, sampleRate, hz, smoothingFactor, velocity, options, this);
    if (options.body == "simple") {
        resonate(buffer.getChannelData(0));
        resonate(buffer.getChannelData(1));
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
                options.stringDamping +
                Math.pow(noteNumber, 0.5) * (1 - options.stringDamping) * 0.5 +
                (1 - options.stringDamping) *
                    Math.random() *
                    options.stringDampingVariation;
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

        var pluckDampingSlider =
            document.getElementById("pluckDamping");
        var pluckDamping = pluckDampingSlider.valueAsNumber;

        var magicCalculationRadio =
            document.getElementById("magicCalculation");
        var directCalculationRadio =
            document.getElementById("directCalculation");
        var stringDampingCalculation;
        if (magicCalculationRadio.checked) {
            stringDampingCalculation = "magic";
        } else if (directCalculationRadio.checked) {
            stringDampingCalculation = "direct";
        }

        var noBodyRadio =
            document.getElementById("noBody");
        var simpleBodyRadio =
            document.getElementById("simpleBody");
        var body;
        if (noBodyRadio.checked) {
            body = "none";
        } else if (simpleBodyRadio.checked) {
            body = "simple";
        }

        var stereoSpreadSlider =
            document.getElementById("stereoSpread");
        var stereoSpread = stereoSpreadSlider.valueAsNumber;
        
        return {
            stringTension: stringTension,
            characterVariation: characterVariation,
            stringDamping: stringDamping,
            stringDampingVariation: stringDampingVariation,
            stringDampingCalculation: stringDampingCalculation,
            pluckDamping: pluckDamping,
            body: body,
            stereoSpread: stereoSpread
        };
    }

    // asm.js spec at http://asmjs.org/spec/latest/
    function asmWrapper(channelBuffer, seedNoise, sampleRate, hz, smoothingFactor, velocity, options, string) {
        var targetArrayL = channelBuffer.getChannelData(0);
        var targetArrayR = channelBuffer.getChannelData(1);

        var heapFloat32Size = seedNoise.length + 
                              targetArrayL.length +
                              targetArrayR.length;
        var heapFloat32 = new Float32Array(heapFloat32Size);
        var i;
        for (i = 0; i < seedNoise.length; i++) {
            heapFloat32[i] = seedNoise[i];
        }

        // from the asm.js spec, it sounds like the heap must be
        // passed in as a plain ArrayBuffer
        var heapBuffer = heapFloat32.buffer;
        var asm = asmFunctions(window, null, heapBuffer);

        var heapOffsets = {
            seedStart: 0,
            seedEnd: seedNoise.length - 1,
            targetStart: seedNoise.length,
            targetEnd: seedNoise.length + targetArrayL.length - 1
        };

        asm.renderKarplusStrong(heapOffsets,
                                sampleRate,
                                hz,
                                velocity,
                                smoothingFactor,
                                options.stringTension,
                                options.pluckDamping,
                                options.characterVariation);

        asm.fadeTails(heapOffsets.targetStart,
                heapOffsets.targetEnd - heapOffsets.targetStart + 1);
        
        /*
        asm.renderDecayedSine(heapOffsets,
                              sampleRate,
                              hz,
                              velocity);
        */

        // string.prePan is set individually for each string such that
        // the lowest note has a value of -1 and the highest +1
        var stereoSpread = options.stereoSpread * string.prePan;
        // for negative stereoSpreads, the note is pushed to the left
        // for positive stereoSpreads, the note is pushed to the right
        var gainL = (1 - stereoSpread) * 0.5;
        var gainR = (1 + stereoSpread) * 0.5;
        for (i = 0; i < targetArrayL.length; i++) {
            targetArrayL[i] = heapFloat32[heapOffsets.targetStart+i] * gainL;
        }
        for (i = 0; i < targetArrayL.length; i++) {
            targetArrayR[i] = heapFloat32[heapOffsets.targetStart+i] * gainR;
        }
    }
};
