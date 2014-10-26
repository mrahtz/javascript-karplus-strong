"use strict";

var audioCtx;
// webkitAudioContext for Webkit browsers
// AudioContext for Firefox
audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var oscillator = audioCtx.createOscillator();
var gainNode = audioCtx.createGain();
oscillator.connect(gainNode);
gainNode.connect(audioCtx.destination);
console.log("All connected up");

oscillator.type = 0; // sine wave
oscillator.frequency.value = 440;
oscillator.start();
