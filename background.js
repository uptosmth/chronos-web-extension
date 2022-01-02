/*
    Copyright (C) 2021 Viacheslav Tykhanovskyi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var DEBUG = 0;
var BUFFER = [];
var RECORDING_PERIOD_MILLI = 5000;
var FLUSHING_PERIOD_MILLI = 30000;
var IS_ACTIVE = false;

function flushHeartbeats() {
  var url = "http://localhost:10203/heartbeats/browser";

  if (BUFFER.length == 0) {
    DEBUG && console.log('nothing to flush');

    return;
  }

  DEBUG && console.log('flushing: ' + BUFFER.length);

  try {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

    xhr.onload = function() {
        if (xhr.status == 200) {
          DEBUG && console.log('flushed successfully');

          BUFFER = [];
        }
    };

    xhr.send(JSON.stringify(BUFFER));
  } catch (e) {
    DEBUG && console.log('flushing error: ' + e);
  }
}

function recordActivity() {
  if (IS_ACTIVE) {
    DEBUG && console.log('recording activity');

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0 && !tabs[0].url.match(/^(?:about|chrome):/)) {
        var tab = tabs[0];

        DEBUG && console.log('appending heartbeat: ' + tab.title + ' ' + tab.url);

        BUFFER.push({
          timestamp: new Date().valueOf(),
          title: tab.title,
          url: tab.url
        });
      }
    });
  } else {
    DEBUG && console.log('not recording: not active');
  }
}

function onTabChanged(activeInfo) {
  DEBUG && console.log('tab changed');

  recordActivity();
}

function scheduleRecordingAlarm() {
  DEBUG && console.log('schedule recording alarm');

  chrome.alarms.create("recording", {"when": Date.now() + RECORDING_PERIOD_MILLI});
}

function scheduleFlushingAlarm() {
  DEBUG && console.log('schedule flushing alarm');

  chrome.alarms.create("flushing", {"when": Date.now() + FLUSHING_PERIOD_MILLI});
}

function onAlarm(alarm) {
  DEBUG && console.log(alarm.name + ' alarm');

  if (alarm.name == 'flushing') {
      flushHeartbeats();

      scheduleFlushingAlarm();
  }
  else if (alarm.name == 'recording') {
      recordActivity();

      scheduleRecordingAlarm();
  }
}

function onFocusChanged(windowId) {
  DEBUG && console.log('window focus changed: ' + windowId);

  if (windowId == -1) {
    IS_ACTIVE = false;
  }
  else {
    IS_ACTIVE = true;

    recordActivity();
  }

  flushHeartbeats();
}

function start() {
  DEBUG && console.log('start watcher');

  chrome.tabs.onActivated.addListener(recordActivity);
  chrome.alarms.onAlarm.addListener(onAlarm);
  chrome.windows.onFocusChanged.addListener(onFocusChanged);

  scheduleRecordingAlarm();
  scheduleFlushingAlarm();
}

(function() {
  DEBUG && console.log('init');

  start();
})();
