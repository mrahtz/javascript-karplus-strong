"use strict";

// https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer

var audioCtx;
// webkitAudioContext for Webkit browsers
// AudioContext for Firefox
audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var channels = 1;
// a 1-second buffer
var frameCount = audioCtx.sampleRate;
var buffer = audioCtx.createBuffer(channels, frameCount, audioCtx.sampleRate);
// get the actual array for the data for the first channel
var bufferChannelData = buffer.getChannelData(0);
for (var i = 0; i < frameCount; i++) {
    // Math.random returns a value between 0 and 1
    // audio buffers use a range of -1 to 1
    bufferChannelData[i] = -1 + Math.random()*2;
}
var bufferSource = audioCtx.createBufferSource();
bufferSource.buffer = buffer;
bufferSource.connect(audioCtx.destination);
bufferSource.start();
