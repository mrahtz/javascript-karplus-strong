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
