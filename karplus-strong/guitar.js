// JavaScript's class definitions are just functions
// the function itself serves as the constructor for the class
function Guitar(audioCtx, audioDestination) {
    // 'strings' becomes a 'property'
    // (an instance variable)
    this.strings = [
        // arguments are:
        // - audio context
        // - string number
        // - octave
        // - semitone
        new GuitarString(audioCtx, audioDestination, 0, 2, 4),   // E2
        new GuitarString(audioCtx, audioDestination, 1, 2, 9),   // A2
        new GuitarString(audioCtx, audioDestination, 2, 3, 2),   // D3
        new GuitarString(audioCtx, audioDestination, 3, 3, 7),   // G3
        new GuitarString(audioCtx, audioDestination, 4, 3, 11),  // B3
        new GuitarString(audioCtx, audioDestination, 5, 4, 4)    // E4
    ];
}

// each fret represents an increase in pitch by one semitone
// (logarithmically, one-twelth of an octave)
// -1: don't pluck that string
Guitar.C_MAJOR = [-1,  3, 2, 0, 0, 0];
Guitar.G_MAJOR = [ 3,  2, 0, 0, 0, 3];
Guitar.A_MINOR = [ 0,  0, 2, 2, 0, 0];
Guitar.E_MINOR = [ 0,  2, 2, 0, 3, 0];

// to add a class method in JavaScript,
// we add a function property to the class's 'prototype' property
Guitar.prototype.strumChord = function(time, downstroke, velocity, chord) {
    var pluckOrder;
    if (downstroke === true) {
        pluckOrder = [0, 1, 2, 3, 4, 5];
    } else {
        pluckOrder = [5, 4, 3, 2, 1, 0];
    }

    for (var i = 0; i < 6; i++) {
        var stringNumber = pluckOrder[i];
        if (chord[stringNumber] != -1) {
            this.strings[stringNumber].pluck(time, velocity, chord[stringNumber]);
        }
        time += Math.random()/128;
    }

};

var guitar;
var audioCtx = getAudioContext();
if (audioCtx !== null) {
    // now that we've verified Web Audio support, we can show the panel
    var guitarPanel = document.getElementById("guitarPanel");
    guitarPanel.style.display = 'block';

    var compressor = audioCtx.createDynamicsCompressor();
    // chosen experimentally
    compressor.threshold.value = -24;
    // beyond the threshold, the output will only increase by 1/20th of
    // a dB for every increase in the input of 1DB
    compressor.ratio.value = 20;
    // apply the reduction as soon as the signal goes above threshold
    compressor.attack.value = 0;
    // and keep it there for a good while
    compressor.release.value = 1;
    compressor.connect(audioCtx.destination);
    guitar = new Guitar(audioCtx, compressor);
}
