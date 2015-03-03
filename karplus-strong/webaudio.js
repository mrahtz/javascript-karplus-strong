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
