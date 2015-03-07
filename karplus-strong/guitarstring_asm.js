function asmWrapper(channelBuffer, seedNoise, sampleRate, hz, smoothingFactor, velocity, options, string) {
    var targetArrayL = channelBuffer.getChannelData(0);
    var targetArrayR = channelBuffer.getChannelData(1);

    var heapFloat32MinimumSize = seedNoise.length + 
                          targetArrayL.length +
                          targetArrayR.length;
    var heapFloat32Size = getNextValidFloat32HeapLength(heapFloat32MinimumSize);
    var heapFloat32 = new Float32Array(heapFloat32Size);
    var i;
    for (i = 0; i < seedNoise.length; i++) {
        heapFloat32[i] = seedNoise[i];
    }

    // asm.js requires all data in/out of function to
    // be done through heap object
    // from the asm.js spec, it sounds like the heap must be
    // passed in as a plain ArrayBuffer
    // (.buffer is the ArrayBuffer referenced by the Float32Buffer)
    var heapBuffer = heapFloat32.buffer;
    var foreignFunctions = { random: Math.random };
    var asm = asmFunctions(window, foreignFunctions, heapBuffer);

    var heapOffsets = {
        seedStart: 0,
        seedEnd: seedNoise.length - 1,
        targetStart: seedNoise.length,
        targetEnd: seedNoise.length + targetArrayL.length - 1
    };

    asm.renderKarplusStrong(heapOffsets.seedStart,
                            heapOffsets.seedEnd,
                            heapOffsets.targetStart,
                            heapOffsets.targetEnd,
                            sampleRate,
                            hz,
                            velocity,
                            smoothingFactor,
                            options.stringTension,
                            options.pluckDamping,
                            options.characterVariation);

    if (options.body == "simple") {
        asm.simpleBody(heapOffsets.targetStart, heapOffsets.targetEnd);
    }

    asm.fadeTails(heapOffsets.targetStart,
            heapOffsets.targetEnd - heapOffsets.targetStart + 1);

    /*
    asm.renderDecayedSine(heapOffsets,
                          sampleRate,
                          hz,
                          velocity);
    */

    // string.acousticLocation is set individually for each string such that
    // the lowest note has a value of -1 and the highest +1
    var stereoSpread = options.stereoSpread * string.acousticLocation;
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

// http://asmjs.org/spec/latest/#modules
// the byte length must be 2^n for n in [12, 24],
// or for bigger heaps, 2^24 * n for n >= 1
function getNextValidFloat32HeapLength(desiredLengthFloats) {
    var heapLengthBytes;
    var desiredLengthBytes = desiredLengthFloats << 2;

    if (desiredLengthBytes <= Math.pow(2, 12)) {
        heapLengthBytes = Math.pow(2, 12);
    } else if (desiredLengthBytes < Math.pow(2, 24)) {
        heapLengthBytes = Math.pow(2, Math.ceil(Math.log2(desiredLengthBytes)));
    } else {
        throw("Heap length greater than 2^24 bytes not implemented");
    }
    return heapLengthBytes;
}

// standard asm.js block
// stdlib: object through which standard library functions are called
// foreign: object through which external javascript functions are called
// heap: buffer used for all data in/out of function
function asmFunctions(stdlib, foreign, heapBuffer) {
    "use asm";

    // heap is supposed to come in as just an ArrayBuffer
    // so first need to get a Float32 view of it
    var heap = new stdlib.Float32Array(heapBuffer);
    var fround = stdlib.Math.fround;
    var sin = stdlib.Math.sin;
    var pi = stdlib.Math.PI;
    var floor = stdlib.Math.floor;
    var random = foreign.random;

    function lowPass(lastOutput, currentInput, smoothingFactor) {

        // coersion to indicate type of arguments
        // +x represents double
        // we do all the arithmetic using doubles rather than floats,
        // because in the asm.js spec, operations done floats resolve
        // to 'floatish'es, which need to be coerced back into floats,
        // and the code becomes unreadable
        lastOutput = +lastOutput;
        currentInput = +currentInput;
        smoothingFactor = +smoothingFactor;

        var currentOutput = 0.0;
        currentOutput =
            smoothingFactor * currentInput +
            (1.0 - smoothingFactor) * lastOutput;

        return +currentOutput;
    }

    function highPass(lastOutput, lastInput, currentInput, smoothingFactor) {
        lastOutput = +lastOutput;
        lastInput = +lastInput;
        currentInput = +currentInput;
        smoothingFactor = +smoothingFactor;

        var currentOutput = 0.0;
        currentOutput =
            smoothingFactor * lastOutput +
            smoothingFactor * (currentInput - lastInput);

        return +currentOutput;
    }

    // this is copied verbatim from the original ActionScript source
    // haven't figured out how it works yet
    function simpleBody(heapStart, heapEnd) {
        // '|0' declares parameter as int
        // http://asmjs.org/spec/latest/#parameter-type-annotations
        heapStart = heapStart|0;
        heapEnd = heapEnd|0;

        // explicitly initialise all variables so types are declared
        var r00 = 0.0;
        var f00 = 0.0;
        var r10 = 0.0;
        var f10 = 0.0;
        var f0 = 0.0;
        var c0 = 0.0;
        var c1 = 0.0;
        var r0 = 0.0;
        var r1 = 0.0;
        var i = 0;
        var resonatedSample = 0.0;
        var resonatedSamplePostHighPass = 0.0;
        // by making the smoothing factor large, we make the cutoff
        // frequency very low, acting as just an offset remover
        var highPassSmoothingFactor = 0.999;
        var lastOutput = 0.0;
        var lastInput = 0.0;
        
        // +x indicates that x is a double
        // (asm.js Math functions take doubles as arguments)
        c0 = 2.0 * sin(pi * 3.4375 / 44100.0);
        c1 = 2.0 * sin(pi * 6.124928687214833 / 44100.0);
        r0 = 0.98;
        r1 = 0.98;

        // asm.js seems to require byte addressing of the heap...?
        // http://asmjs.org/spec/latest/#validateheapaccess-e
        // yeah, when accessing the heap with an index which is an expression,
        // the total index expression is validated in a way that
        // forces the index to be a byte
        // and apparently '|0' coerces to signed when not in the context
        // of parameters
        // http://asmjs.org/spec/latest/#binary-operators
        for (i = heapStart << 2; (i|0) < (heapEnd << 2); i = (i + 4)|0) {
            r00 = r00 * r0;
            r00 = r00 + (f0 - f00) * c0;
            f00 = f00 + r00;
            f00 = f00 - f00 * f00 * f00 * 0.166666666666666;
            r10 = r10 * r1;
            r10 = r10 + (f0 - f10) * c1;
            f10 = f10 + r10;
            f10 = f10 - f10 * f10 * f10 * 0.166666666666666;
            f0 = +heap[i >> 2];
            resonatedSample = f0 + (f00 + f10) * 2.0;

            // I'm not sure why, but the resonating process plays
            // havok with the DC offset - it jumps around everywhere.
            // We put it back to zero DC offset by adding a high-pass
            // filter with a super low cutoff frequency.
            resonatedSamplePostHighPass = +highPass(
                lastOutput,
                lastInput,
                resonatedSample,
                highPassSmoothingFactor
            );
            heap[i >> 2] = resonatedSamplePostHighPass;

            lastOutput = resonatedSamplePostHighPass;
            lastInput = resonatedSample;
        }
    }
    
    // apply a fade envelope to the end of a buffer
    // to make it end at zero ampltiude
    // (to avoid clicks heard when sample otherwise suddenly
    //  cuts off)
    function fadeTails(heapStart, length) {
        heapStart = heapStart|0;
        length = length|0;

        var heapEnd = 0;
        var tailProportion = 0.0;
        var tailSamples = 0;
        var tailSamplesStart = 0;
        var i = 0;
        var samplesThroughTail = 0;
        var proportionThroughTail = 0.0;
        var gain = 0.0;

        tailProportion = 0.1;
        // we first convert length from an int to an unsigned (>>>0)
        // so that we can convert it a double for the argument of floor()
        // then convert it to a double (+)
        // then convert the double result of floor to a signed with ~~
        // http://asmjs.org/spec/latest/#binary-operators
        // http://asmjs.org/spec/latest/#standard-library
        // http://asmjs.org/spec/latest/#binary-operators
        tailSamples = ~~floor(+(length>>>0) * tailProportion);
        // http://asmjs.org/spec/latest/#additiveexpression
        // the result of an additive addition is an intish,
        // which must be coerced back to an int
        tailSamplesStart = (heapStart + length - tailSamples)|0;

        heapEnd = (heapStart + length)|0;

        // so remember, i represents a byte index,
        // and the heap is a Float32Array (4 bytes)
        for (i = tailSamplesStart << 2, samplesThroughTail = 0;
                (i|0) < (heapEnd << 2);
                i = (i + 4)|0,
                samplesThroughTail = (samplesThroughTail+1)|0) {
            proportionThroughTail =
                    (+(samplesThroughTail>>>0)) / (+(tailSamples>>>0));
            gain = 1.0 - proportionThroughTail;
            heap[i >> 2] = heap[i >> 2] * fround(gain);
        }
    }

    // the "smoothing factor" parameter is the coefficient
    // used on the terms in the low-pass filter
    function renderKarplusStrong(
                                 seedNoiseStart,
                                 seedNoiseEnd,
                                 targetArrayStart,
                                 targetArrayEnd,
                                 sampleRate, hz, velocity,
                                 smoothingFactor, stringTension,
                                 pluckDamping,
                                 characterVariation
                                ) {
        seedNoiseStart = seedNoiseStart|0;
        seedNoiseEnd = seedNoiseEnd|0;
        targetArrayStart = targetArrayStart|0;
        targetArrayEnd = targetArrayEnd|0;
        sampleRate = sampleRate|0;
        hz = hz|0;
        velocity = +velocity;
        smoothingFactor = +smoothingFactor;
        stringTension = +stringTension;
        pluckDamping = +pluckDamping;
        characterVariation = +characterVariation;

        var period = 0.0;
        var periodSamples = 0;
        var sampleCount = 0;
        var lastOutputSample = 0.0;
        var curInputSample = 0.0;
        var noiseSample = 0.0;
        var skipSamplesFromTension = 0;
        var curOutputSample = 0.0;

        // the (byte-addressed) index of the heap as a whole that
        // we get noise samples from
        var heapNoiseIndexBytes = 0;
        // the (Float32-addressed) index of the portion of the heap
        // that we'll be writing to
        var targetIndex = 0;
        // the (byte-addressed) index of the heap as a whole where
        // we'll be writing
        var heapTargetIndexBytes = 0;
        // the (byte-addressed) index of the heap as a whole of
        // the start of the last period of samples
        var lastPeriodStartIndexBytes = 0;
        // the (byte-addressed) index of the heap as a whole from
        // where we'll be taking samples from the last period, after
        // having added the skip from tension
        var lastPeriodInputIndexBytes = 0;

        period = 1.0/(+(hz>>>0));
        periodSamples = ~~floor(period * +(sampleRate>>>0));
        sampleCount = (targetArrayEnd-targetArrayStart+1)|0;

        for (targetIndex = 0;
                (targetIndex|0) < (sampleCount|0);
                targetIndex = (targetIndex + 1)|0) {

            heapTargetIndexBytes = (targetArrayStart + targetIndex) << 2;

            if ((targetIndex|0) < (periodSamples|0)) {
                // for the first period, feed in noise
                // remember, heap index has to be bytes...
                heapNoiseIndexBytes = (seedNoiseStart + targetIndex) << 2;
                noiseSample = +heap[heapNoiseIndexBytes >> 2];
                // create room for character variation noise
                noiseSample = noiseSample * (1.0 - characterVariation);
                // add character variation
                noiseSample = noiseSample +
                    characterVariation * (-1.0 + 2.0 * (+random()));
                curInputSample =
                    +lowPass(curInputSample, noiseSample, pluckDamping);
            } else {
                // for subsequent periods, feed in the output from
                // about one period ago
                lastPeriodStartIndexBytes =
                    (heapTargetIndexBytes - (periodSamples << 2))|0;
                skipSamplesFromTension =
                    ~~floor(stringTension * (+(periodSamples>>>0)));
                lastPeriodInputIndexBytes =
                    (lastPeriodStartIndexBytes +
                        (skipSamplesFromTension << 2))|0;
                curInputSample = +heap[lastPeriodInputIndexBytes >> 2];
            }

            curOutputSample = 
                +lowPass(lastOutputSample, curInputSample, smoothingFactor);
            heap[heapTargetIndexBytes >> 2] = curOutputSample;
            lastOutputSample = curOutputSample;
        }
    }

    /*
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
        var sampleCount = (targetArrayEnd-targetArrayStart+1)|0;

        var targetIndex = 0;
        while(1) {
            var heapTargetIndex = (targetArrayStart + targetIndex)|0;
            var t = Math.fround(Math.fround(targetIndex)/Math.fround(sampleRate));
            heap[heapTargetIndex] = 
                velocity *
                Math.pow(2, -Math.fround(targetIndex) / (Math.fround(sampleCount)/8)) *
                Math.sin(2 * Math.PI * hz * t);
            targetIndex = (targetIndex + 1)|0;
            if (targetIndex == sampleCount) {
                break;
            }
        }
    }
    */

    return {
        renderKarplusStrong: renderKarplusStrong,
        //renderDecayedSine: renderDecayedSine,
        fadeTails: fadeTails,
        simpleBody: simpleBody,
    };
}

