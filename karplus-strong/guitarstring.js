// this was derived experimentally to match Andre Michelle's
// TODO
// * currently sounds strange when characterVariation = 0

// I've no idea how it works out as this...
// it doesn't seem to appear in the code anywhere
var timeUnit = 0.12;

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

};
