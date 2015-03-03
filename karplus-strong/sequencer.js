// create zero-length dummy source used to queue next part of rhythm
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
// (The higher strumGenerationsPerRun, the longer the delay between
//  parameter adjustments and samples created with the new parameters.)
function queueSequence(sequenceN, blockStartTime, chordIndex) {
    console.log("Sequence number " + sequenceN);

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
    var strumGenerationsPerRun = 1;

    while (strumGenerationsPerRun > 0) {
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
        strumGenerationsPerRun--;
    }

    // the dummy source has zero length, and is just used to 
    // call queueSequence() again after a period of time
    var queuerSource = createDummySource(audioCtx);
    queuerSource.onended = function() { 
        queueSequence(sequenceN, blockStartTime, chordIndex);
    };
    // we set the next strum to be generated at the same time as the
    // current strum begins playing to allow enough time for the next
    // strum to be generated before it comes time to play it
    queuerSource.start(curStrumStartTime);
}

function getAudioContext() {
    var constructor;
    var error;
    if ('AudioContext' in window) {
        // Firefox, Chrome
        constructor = window.AudioContext;
    } else if ('webkitAudioContext' in window) {
        // Safari
        constructor = window.webkitAudioContext;
    } else {
        // uh-oh; browser doesn't suport Web Audio?
        var guitarErrorText = document.getElementById("guitarErrorText");
        guitarErrorText.innerHTML =
            "<b>Error: unable to get audio context. " +
            "Does your browser support Web Audio?</b>";
        return null;
    }

    var audioContext = new constructor();
    return audioContext;
}

var guitar;
var audioCtx = getAudioContext();
if (audioCtx !== null) {
    // now that we've verified Web Audio support, we can show the panel
    var guitarPanel = document.getElementById("guitarPanel");
    guitarPanel.style.display = 'block';
    guitar = new Guitar(audioCtx);
}

function startGuitarPlaying() {
    var startSequenceN = 0;
    var blockStartTime = audioCtx.currentTime;
    var startChordIndex = 0;
    queueSequence(startSequenceN, blockStartTime, startChordIndex);
}
