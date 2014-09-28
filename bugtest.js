var audioCtx = new window.webkitAudioContext();
var bufferSource;

function foo() {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.connect(audioCtx.destination);
    bufferSource.buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate) 
    bufferSource.onended = function() { fdsfdsf };
    bufferSource.start();
    //console.log(bufferSource.onended);
    console.log("started bufferSource");
}

foo();
