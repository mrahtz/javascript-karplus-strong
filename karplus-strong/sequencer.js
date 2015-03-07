// Create sound samples for the current part of the strum sequence,
// and queue generation of sound samples of the following part.
// The rhythms parts have as fine a granularity as possible to enable
// adjustment of guitar parameters with real-time feedback.
// (The higher strumGenerationsPerRun, the longer the delay between
//  parameter adjustments and samples created with the new parameters.)
function queueStrums(sequenceN, blockStartTime, chordIndex, precacheTime) {
    var chords = [
        Guitar.C_MAJOR,
        Guitar.G_MAJOR,
        Guitar.A_MINOR,
        Guitar.E_MINOR
    ];

    var playState = document.getElementById("playState").value;
    if (playState == "stopped") {
        return;
    }

    var curStrumStartTime;

    var chord = chords[chordIndex];
    switch(sequenceN % 13) {
        case 0:
            curStrumStartTime = blockStartTime + timeUnit * 0;
            guitar.strumChord(curStrumStartTime,  true,  1.0, chord);
            break;
        case 1:
            curStrumStartTime = blockStartTime + timeUnit * 4;
            guitar.strumChord(curStrumStartTime,  true,  1.0, chord);
            break;
        case 2:
            curStrumStartTime = blockStartTime + timeUnit * 6;
            guitar.strumChord(curStrumStartTime,  false, 0.8, chord);
            break;
        case 3:
            curStrumStartTime = blockStartTime + timeUnit * 10;
            guitar.strumChord(curStrumStartTime, false, 0.8, chord);
            break;
        case 4:
            curStrumStartTime = blockStartTime + timeUnit * 12;
            guitar.strumChord(curStrumStartTime, true,  1.0, chord);
            break;
        case 5:
            curStrumStartTime = blockStartTime + timeUnit * 14;
            guitar.strumChord(curStrumStartTime, false, 0.8, chord);
            break;
        case 6:
            curStrumStartTime = blockStartTime + timeUnit * 16;
            guitar.strumChord(curStrumStartTime, true,  1.0, chord);
            break;
        case 7:
            curStrumStartTime = blockStartTime + timeUnit * 20;
            guitar.strumChord(curStrumStartTime, true,  1.0, chord);
            break;
        case 8:
            curStrumStartTime = blockStartTime + timeUnit * 22;
            guitar.strumChord(curStrumStartTime, false, 0.8, chord);
            break;
        case 9:
            curStrumStartTime = blockStartTime + timeUnit * 26;
            guitar.strumChord(curStrumStartTime, false, 0.8, chord);
            break;
        case 10:
            curStrumStartTime = blockStartTime + timeUnit * 28;
            guitar.strumChord(curStrumStartTime, true,  1.0, chord);
            break;
        case 11:
            curStrumStartTime = blockStartTime + timeUnit * 30;
            guitar.strumChord(curStrumStartTime, false, 0.8, chord);
            break;
        case 12:

            curStrumStartTime = blockStartTime + timeUnit * 31;
            guitar.strings[2].pluck(curStrumStartTime,   0.7, chord[2]);

            curStrumStartTime = blockStartTime + timeUnit * 31.5;
            guitar.strings[1].pluck(curStrumStartTime, 0.7, chord[1]);

            chordIndex = (chordIndex + 1) % 4;
            blockStartTime += timeUnit*32;

            break;
    }
    sequenceN++;

    // if the current actual time is ahead of the time we were
    // supposed to play the just-generated note, then we're getting
    // behind, so increase the precache time
    if (audioCtx.currentTime > curStrumStartTime) {
        precacheTime += 0.1;
    }

    // the dummy source has zero length, and is just used to 
    // call queueStrums() again after a period of time
    var queuerSource = createDummySource(audioCtx);
    queuerSource.onended = function() { 
        queueStrums(sequenceN, blockStartTime, chordIndex, precacheTime);
    };

    // we try to main a constant time between when the strum
    // has finished generated and when it actually plays
    // the next strum will be played at curStrumStartTime; so start
    // generating the one after the next strum at precacheTime before
    var generateAt = curStrumStartTime - precacheTime;
    if (generateAt < 0)
        generateAt = 0;
    queuerSource.start(generateAt);
}

function startGuitarPlaying() {
    var startSequenceN = 0;
    var blockStartTime = audioCtx.currentTime;
    var startChordIndex = 0;
    var precacheTime = 0.3;
    queueStrums(startSequenceN, blockStartTime, startChordIndex, 0.3);
}
