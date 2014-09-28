function String(audioCtx, octave, semitone) {
    this.audioCtx = audioCtx;
    this.basicHz = String.C0_HZ * Math.pow(2, octave+semitone/12);
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
    console.log(this.basicHz + " Hz string being plucked" +
                " with velocity " + velocity +
                " at time " + time);

    var bufferSource = this.audioCtx.createBufferSource();
    var channels = 1;
    // 1 second buffer
    var frameCount = audioCtx.sampleRate;
    var sampleRate = audioCtx.sampleRate;
    var buffer = this.audioCtx.createBuffer(channels, frameCount, sampleRate);
    var bufferChannelData = buffer.getChannelData(0);
    renderDecayedSine(bufferChannelData, sampleRate, this.basicHz);
    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);
    bufferSource.start(time);

    function renderDecayedSine(targetArray, sampleRate, hz) {
        var frameCount = targetArray.length;
        for (var i = 0; i < frameCount; i++) {
            bufferChannelData[i] =
                velocity *
                Math.pow(2, -i/(frameCount/8)) *
                Math.sin(2 * Math.PI * hz * i/sampleRate);
        }
    }
}

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

// webkitAudioContext for Webkit browsers
// AudioContext for Firefox
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var guitar = new Guitar(audioCtx);
var startTime = audioCtx.currentTime;
/*for (i = 0; i < 6; i++) {
    guitar.strings[i].pluck(startTime + i);
}*/


var timeUnit = 1/8;
guitar.strum(timeUnit * 0,      true,  1.0);
guitar.strum(timeUnit * 4,      true,  1.0);
guitar.strum(timeUnit * 6,      false, 0.8);
guitar.strum(timeUnit * 10,     false, 0.8);
guitar.strum(timeUnit * 12,     true,  1.0);
guitar.strum(timeUnit * 14,     false, 0.8);
guitar.strum(1 + timeUnit * 0,  true,  1.0);
guitar.strum(1 + timeUnit * 4,  true,  1.0);
guitar.strum(1 + timeUnit * 6,  false, 0.8);
guitar.strum(1 + timeUnit * 10, false, 0.8);
guitar.strum(1 + timeUnit * 12, true,  1.0);
guitar.strum(1 + timeUnit * 14, false, 0.8);
guitar.pluck(1 + timeUnit * 15,   2, 0.7);
guitar.pluck(1 + timeUnit * 15.5, 1, 0.7);
