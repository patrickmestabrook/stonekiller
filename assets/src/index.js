import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// eslint-disable-next-line
import TimerWorker from 'worker-loader!./metronome.worker.js';

const timerWorker = new TimerWorker();

var unlocked = false;
var isPlaying = false;      // Are we currently playing?
var startTime;              // The start time of the entire sequence.
var current16thNote;        // What note is currently last scheduled?
var tempo = 120.0;          // tempo (in beats per minute)
var lookahead = 25.0;       // How frequently to call scheduling function
                            //(in milliseconds)
var scheduleAheadTime = 0.1;    // How far ahead to schedule audio (sec)
                            // This is calculated from lookahead, and overlaps
                            // with next interval (in case the timer is late)
var nextNoteTime = 0.0;     // when the next note is due.
var noteResolution = 0;     // 0 == 16th, 1 == 8th, 2 == quarter note
var noteLength = 0.05;      // length of "beep" (in seconds)
var canvas,                 // the canvas element
    canvasContext;          // canvasContext is the canvas' context 2D
var last16thNoteDrawn = -1; // the last "box" we drew on the screen
var notesInQueue = [];      // the notes that have been put into the web audio,
                            // and may or may not have played yet. {note, time}

// First, let's shim the requestAnimationFrame API, with a setTimeout fallback
const requestAnimFrame = (function(){
  return  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  function( callback ){
      window.setTimeout(callback, 1000 / 60);
  };
})();


function nextNote() {
  // Advance current note and time by a 16th note...
  var secondsPerBeat = 60.0 / tempo;    // Notice this picks up the CURRENT
                                        // tempo value to calculate beat length.
  nextNoteTime += 0.25 * secondsPerBeat;    // Add beat length to last beat time

  current16thNote++;    // Advance the beat number, wrap to zero
  if (current16thNote == 16) {
      current16thNote = 0;
  }
}

function scheduleNote( beatNumber, time ) {
  // push the note on the queue, even if we're not playing.
  notesInQueue.push( { note: beatNumber, time: time } );

  if ( (noteResolution==1) && (beatNumber%2))
      return; // we're not playing non-8th 16th notes
  if ( (noteResolution==2) && (beatNumber%4))
      return; // we're not playing non-quarter 8th notes

  // create an oscillator
  var osc = audioContext.createOscillator();
  osc.connect( audioContext.destination );
  if (beatNumber % 16 === 0)    // beat 0 == high pitch
      osc.frequency.value = 880.0;
  else if (beatNumber % 4 === 0 )    // quarter notes = medium pitch
      osc.frequency.value = 440.0;
  else                        // other 16th notes = low pitch
      osc.frequency.value = 220.0;

  osc.start( time );
  osc.stop( time + noteLength );
}

function scheduler() {
  // while there are notes that will need to play before the next interval,
  // schedule them and advance the pointer.
  while (nextNoteTime < audioContext.currentTime + scheduleAheadTime ) {
      scheduleNote( current16thNote, nextNoteTime );
      nextNote();
  }
}

function play() {
  if (!unlocked) {
    // play silent buffer to unlock the audio
    var buffer = audioContext.createBuffer(1, 1, 22050);
    var node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.start(0);
    unlocked = true;
  }

  isPlaying = !isPlaying;

  if (isPlaying) { // start playing
      current16thNote = 0;
      nextNoteTime = audioContext.currentTime;
      timerWorker.postMessage("start");
  } else {
      timerWorker.postMessage("stop");
  }
}



const audioContext = new AudioContext();

// Set up the timer worker, which helps provide stability to the metronome
timerWorker.onmessage = function(e) {
    if (e.data === "tick") {
        scheduler();
    } else {
      console.log("message: " + e.data);
    }
};
timerWorker.postMessage({"interval":lookahead});

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
