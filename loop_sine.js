"use strict";

// https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer

var audioCtx;
// webkitAudioContext for Webkit browsers
// AudioContext for Firefox
audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var BUFFER_LEN = 2;
var channels = 1;
// a 1-second buffer
var frameCount = BUFFER_LEN * audioCtx.sampleRate;
var buffer = audioCtx.createBuffer(channels, frameCount, audioCtx.sampleRate);

function getBuffer(hz) {
    var frameCount = BUFFER_LEN * audioCtx.sampleRate;
    var buffer = audioCtx.createBuffer(channels, frameCount, audioCtx.sampleRate);
    // get the actual array for the data for the first channel
    var bufferChannelData = buffer.getChannelData(0);
    var frameCount = buffer.length;
    for (var i = 0; i < frameCount; i++) {
        bufferChannelData[i] = Math.sin(2 * Math.PI * hz * (i/buffer.sampleRate));
    }
    return buffer;
}
function createBufferSource() {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.connect(audioCtx.destination);
    return bufferSource;
}

var currentlyPlaying = false;

// start a clip now
// start a clip at now+1 second
// | clip1 | clip2 |
// 0       1       2    time from now
// once clip1 has ended, clip2 will begin playing
// at that point, schedule clip3

var c = 0;
function logFoo() {
    console.log("foo " + c++);
}

function Queue() {
    this.queueArray = [];
    this.currentBufferSource = null;
    this.lastIndex = 0;
}

Queue.prototype.addItem = function(buffer) {
    var lastItem = this.queueArray[this.queueArray.length-1];

    this.queueArray.push({
        index: this.lastIndex,
        buffer: buffer,
    });
    this.lastIndex++;
}

Queue.prototype.processHead = function() {
    var queue = this;
    var item = this.queueArray.shift();
    if (item == null) {
        return;
    }

    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = item.buffer;
    bufferSource.connect(audioCtx.destination);
    bufferSource.onended = function() { queue.processHead() };
    console.log(item);
    bufferSource.start(item.startTime);
    this.currentBufferSource = bufferSource;
}

var queue = new Queue();
queue.addItem(getBuffer(440));
queue.addItem(getBuffer(440));
queue.addItem(getBuffer(440));
queue.processHead();
