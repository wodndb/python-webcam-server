"use client";

import { useRef, useState } from "react";

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [checked, setChecked] = useState<boolean>(false);
  var pc: RTCPeerConnection | null = null;

  function negotiate() {
    if (pc === null) return;
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    return pc
      .createOffer()
      .then(function (offer) {
        return pc?.setLocalDescription(offer);
      })
      .then(function () {
        // wait for ICE gathering to complete
        return new Promise<void>((resolve) => {
          if (pc?.iceGatheringState === "complete") {
            resolve();
          } else {
            const checkState = () => {
              if (pc?.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve();
              }
            };
            pc?.addEventListener("icegatheringstatechange", checkState);
          }
        });
      })
      .then(function () {
        var offer = pc?.localDescription;
        return fetch("http://localhost:3000/api/offer", {
          body: JSON.stringify({
            sdp: offer?.sdp,
            type: offer?.type,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      })
      .then(function (response) {
        return response.json();
      })
      .then(function (answer) {
        return pc?.setRemoteDescription(answer);
      })
      .catch(function (e) {
        alert(e);
      });
  }

  function start() {
    var config: RTCConfiguration & { sdpSemantics: string } = {
      sdpSemantics: "unified-plan",
    };

    if (checked) {
      config.iceServers = [{ urls: ["stun:stun.l.google.com:19302"] }];
    }

    pc = new RTCPeerConnection(config);

    // connect audio / video
    pc.addEventListener("track", function (evt) {
      if (!videoRef.current) return;

      if (evt.track.kind == "video") {
        videoRef.current.srcObject = evt.streams[0];
      } else {
        videoRef.current.srcObject = evt.streams[0];
      }
    });

    //document.getElementById("start").style.display = "none";
    negotiate();
    //document.getElementById("stop").style.display = "inline-block";
  }

  function stop() {
    //document.getElementById("stop").style.display = "none";

    // close peer connection
    setTimeout(function () {
      pc?.close();
    }, 500);
  }

  return (
    <main>
      <div className="mb-[8px]">
        <input
          id="use-stun"
          type="checkbox"
          checked={checked}
          onChange={() => setChecked((value) => !value)}
        />
        <label htmlFor="use-stun">Use STUN server</label>
      </div>
      <button id="start" onClick={start}>
        Start
      </button>
      <button id="stop" className="px-[16px] py-[8px]" onClick={stop}>
        Stop
      </button>

      <div id="media">
        <h2>Media</h2>

        <audio ref={audioRef} autoPlay />
        <video ref={videoRef} id="video" autoPlay playsInline />
      </div>
    </main>
  );
}
