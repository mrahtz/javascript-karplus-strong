function asmFunctions(stdlib, foreign, heapBuffer) {
    "use asm";

    // heap is supposed to come in as just an ArrayBuffer
    // so first need to get a Float32 of it
    var heap = new Float32Array(heapBuffer);

    function lowPass(lastOutput, currentInput, smoothingFactor) {
        var currentOutput = smoothingFactor * currentInput +
            (1 - smoothingFactor) * lastOutput;
        return currentOutput;
    }
    
    // apply a fade envelope to the end of a buffer
    // to make it end at zero ampltiude
    // (to avoid clicks heard when sample otherwise suddenly
    //  cuts off)
    function fadeTails(heapStart, length) {
        var tailProportion = 0.1;
        var tailSamples = Math.round(length * tailProportion);
        var tailSamplesStart = heapStart + length - tailSamples;

        for (var i = tailSamplesStart, samplesThroughTail = 0;
                i < heapStart + length;
                i++, samplesThroughTail++) {
            var proportionOfTail = samplesThroughTail / tailSamples;
            heap[i] *= (1 - proportionOfTail);
        }
    }

    // the "smoothing factor" parameter is the coefficient
    // used on the terms in the low-pass filter
    function renderKarplusStrong(heapOffsets,
                                 sampleRate, hz, velocity,
                                 smoothingFactor, stringTension,
                                 pluckDamping,
                                 characterVariation
                                ) {
        // coersion to indicate type of arguments
        // ORing with 0 indicates type int
        var seedNoiseStart = heapOffsets.seedStart|0;
        var seedNoiseEnd = heapOffsets.seedEnd|0;
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
        var curInputSample = 0;

        for (targetIndex = 0;
                targetIndex < frameCount;
                targetIndex++) {
            var heapTargetIndex = (targetArrayStart + targetIndex)|0;
            if (targetIndex < periodSamples) {
                // for the first period, feed in noise
                var heapNoiseIndex = (seedNoiseStart + targetIndex)|0;
                var noiseSample = Math.fround(heap[heapNoiseIndex]);
                // create room for character variation noise
                noiseSample *= (1 - characterVariation);
                // add character variation
                noiseSample += characterVariation * (-1 + 2*Math.random());
                curInputSample = lowPass(curInputSample, noiseSample, pluckDamping);
            } else {
                // for subsequent periods, feed in the output from
                // about one period ago
                var lastPeriodIndex = heapTargetIndex - periodSamples;
                var skipFromTension = Math.round(stringTension * periodSamples);
                var inputIndex = lastPeriodIndex + skipFromTension;
                curInputSample = Math.fround(heap[inputIndex]);
            }

            // output is low-pass filtered version of input
            var curOutputSample = lowPass(lastOutputSample, curInputSample, smoothingFactor);
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
             renderDecayedSine: renderDecayedSine,
             fadeTails: fadeTails };
}

