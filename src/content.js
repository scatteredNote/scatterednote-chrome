/*global chrome*/
/* src/content.js */
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Frame, { FrameContextConsumer } from 'react-frame-component';


import App from "./App";

import { createPortal } from 'react-dom'

import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import weakMemoize from '@emotion/weak-memoize'

// literally copied from Mitchell's codesandbox
// https://github.com/emotion-js/emotion/issues/760#issuecomment-404353706
let memoizedCreateCacheWithContainer = weakMemoize(container => {
  let newCache = createCache({ container });
  return newCache;
});


/* render Emotion style to iframe's head element */
function EmotionProvider({ children, $head }) {
  return (
    <CacheProvider value={memoizedCreateCacheWithContainer($head)}>
      {children}
    </CacheProvider>
  )
}

/* hack-ish: force iframe to update */
function useForceUpdate() {
  const [_, setValue] = useState()
  return () => setValue(0)
}

/* rudimentary Iframe component with Portal */
export function Iframe({ children, ...props }) {
  const iFrameRef = useRef(null)
  const [$iFrameBody, setIframeBody] = useState(null)
  const [$iFrameHead, setIframeHead] = useState(null)
  const forceUpdate = useForceUpdate()

  useEffect(function () {
    if (!iFrameRef.current) return

    const $iframe = iFrameRef.current
    $iframe.addEventListener('load', onLoad)

    function onLoad() {
      // TODO can probably attach these to ref itself?
      setIframeBody($iframe.contentDocument.body)
      setIframeHead($iframe.contentDocument.head)

      // force update, otherwise portal children won't show up
      forceUpdate()
    }

    return function () {
      // eslint-disable-next-line no-restricted-globals
      $iframe.removeEventListener('load', onload)
    }
  })

  return (<iframe {...props} title="s" ref={iFrameRef} style={{
    backgroundColor: "rgb(15 23 42 / 1)",
    color: "rgb(148 163 184 /1)"
  }
  }>
    {$iFrameBody && $iFrameHead && createPortal((
      <EmotionProvider $head={$iFrameHead}>{children}</EmotionProvider>
    ), $iFrameBody)}
  </iframe>)
}


function Main() {

  return (
    <Iframe title='sn'>
      <header>
        <link type="text/css" rel="stylesheet" href={chrome.runtime.getURL("/static/css/content.css")} ></link>
        <link
          href="https://unpkg.com/tailwindcss@^2.0.1/dist/tailwind.min.css"
          rel="stylesheet"
        />
      </header>
      <div >
        <App document={document} window={window} isExt={true} />
      </div>

    </Iframe>
  )
}

const app = document.createElement('div');
app.style = {
  backgroundColor: "rgb(15 23 42 / 1)",
  color: "rgb(148 163 184 /1)"
}
app.id = "my-extension-root";

document.body.appendChild(app);
ReactDOM.render(<Main />, app);

app.style.display = "none";

let youtubeLeftControls, youtubePlayer;
let currentVideo

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.message === "clicked_browser_action") {
      toggle();
    }
    else if (request.message === "PLAY") {
      youtubePlayer.currentTime = request.data;
    }
  }
);

function toggle() {
  if (app.style.display === "none") {
    app.style.display = "block";
  } else {
    app.style.display = "none";
  }
}

const getTime = t => {
  var date = new Date(0);
  date.setSeconds(t);

  return date.toISOString().substr(11, 8);
};


const newVideoLoaded = async () => {
  //https://www.youtube.com/watch?v=0n809nd4Zu4&list=PLfnRxwCsEORQ9jTYt5QMk4ebr96DsCzCr&index=1&t=195s
  const bookmarkBtnExists = document.getElementsByClassName("bookmark-btn")[0];


  if (!bookmarkBtnExists) {
    const bookmarkBtn = document.createElement("img");
    bookmarkBtn.src = chrome.runtime.getURL("/media/logo.png");

    bookmarkBtn.className = "ytp-button " + "bookmark-btn";
    bookmarkBtn.title = "Click to bookmark current timestamp";
    bookmarkBtn.style.width = "39px";
    bookmarkBtn.style.height = "26px";
    bookmarkBtn.style.marginTop = "14px";
    bookmarkBtn.style.backgroundColor = "white";
    youtubeLeftControls = document.getElementsByClassName("ytp-left-controls")[0];
    youtubePlayer = document.getElementsByClassName('video-stream')[0];

    bookmarkBtn.addEventListener("click", () => {

      const link = window.location.href.split("?")[1]
      const urlParameters = new URLSearchParams(link);

      const currentTime = youtubePlayer.currentTime;
      const newBookmark = {
        timestamp: currentTime,
        link: `https://youtu.be/${urlParameters.get("v")}?t=${Math.floor(currentTime)}`,
      };

      chrome.runtime.sendMessage({ message: "youtube", data: newBookmark })
      if (app.style.display === "none") {
        app.style.display = "block";
      }
    });

    youtubeLeftControls.appendChild(bookmarkBtn);

  }
};

if (window.location.href.includes('youtube.com/watch?v=')) {
  console.log("YOUTUBE VIDEO DETECTED")
  newVideoLoaded();

}
