// === Guitar ===

// JavaScript's class definitions are just functions
// the function itself serves as the constructor for the class
function Guitar(audioCtx) {
    // 'strings' becomes a 'property'
    // (an instance variable)
    this.strings = [
        new GuitarString(audioCtx, 0, 2, 4),   // E2
        new GuitarString(audioCtx, 1, 2, 9),   // A2
        new GuitarString(audioCtx, 2, 3, 2),   // D3
        new GuitarString(audioCtx, 3, 3, 7),   // G3
        new GuitarString(audioCtx, 4, 3, 11),  // B3
        new GuitarString(audioCtx, 5, 4, 4)    // E4
    ];
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
    var pluckOrder;
    if (downstroke === true) {
        pluckOrder = [0, 1, 2, 3, 4, 5];
    } else {
        pluckOrder = [5, 4, 3, 2, 1, 0];
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
