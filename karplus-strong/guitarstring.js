// this was derived experimentally to match Andre Michelle's
// I've no idea how it works out as this...
// it doesn't seem to appear in the ActionScript code anywhere...
var timeUnit = 0.12;

function GuitarString(audioCtx, stringN, octave, semitone) {
    this.audioCtx = audioCtx;

    // work from A0 as a reference,
    // since it has a nice round frequency
    var a0_hz = 27.5;
    // an increase in octave by 1 doubles the frequency
    // each octave is divided into 12 semitones
    // the scale goes C0, C0#, D0, D0#, E0, F0, F0#, G0, G0#, A0, A0#, B0
    // so go back 9 semitones to get to C0
    var c0_hz = a0_hz * Math.pow(2, -9/12);
    this.basicHz = c0_hz * Math.pow(2, octave+semitone/12);
    this.basicHz = this.basicHz.toFixed(2);

    var basicPeriod = 1/this.basicHz;
    var basicPeriodSamples = Math.round(basicPeriod * audioCtx.sampleRate);
    this.seedNoise = generateSeedNoise(65535, basicPeriodSamples);

    // this is only used in a magical calculation of filter coefficients
    this.semitoneIndex = octave*12 + semitone - 9;

    // ranges from -1 for first string to +1 for last
    this.acousticLocation = (stringN - 2.5) * 0.4;

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


GuitarString.prototype.pluck = function(startTime, velocity, tab) {
    console.log(this.basicHz + " Hz string being plucked" +
                " with tab " + tab +
                " with velocity " + velocity +
                " at beat " + (startTime/timeUnit).toFixed(2) + 
                ", actual time " + this.audioCtx.currentTime);

    // create the buffer we're going to write into
    var channels = 2;
    var sampleRate = audioCtx.sampleRate;
    // 1 second buffer
    var sampleCount = 1.0 * sampleRate;
    var buffer = this.audioCtx.createBuffer(channels, sampleCount, sampleRate);

    var options = getControlsValues();
    var smoothingFactor = calculateSmoothingFactor(this, tab, options);
    // 'tab' represents which fret is held while plucking
    // each fret represents an increase in pitch by one semitone
    // (logarithmically, one-twelth of an octave)
    var hz = this.basicHz * Math.pow(2, tab/12);

    asmWrapper(
            buffer,
            this.seedNoise,
            sampleRate,
            hz,
            smoothingFactor,
            velocity,
            options,
            this.acousticLocation
    );

    // create an audio source node fed from the buffer we've just written
    var bufferSource = this.audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);

    bufferSource.start(startTime);
};
