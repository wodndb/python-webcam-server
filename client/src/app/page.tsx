"use client";

import { useRef, useState } from "react";

type RtcLogs = {
  dataChannel: string;
  iceConnection: string;
  iceGathering: string;
  signaling: string;
};

type VideoTransform = "none" | "edges" | "cartoon" | "rotate";

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useDataChannel, setUseDataChannel] = useState<boolean>(false);
  const [useAudio, setUseAudio] = useState<boolean>(false);
  const [useVideo, setUseVideo] = useState<boolean>(false);
  const [useStun, setUseStun] = useState<boolean>(false);
  const [audioCodec, setAudioCodec] = useState<string>("default");
  const [videoCodec, setVideoCodec] = useState<string>("default");
  const [offerSdpInfo, setOfferSdpInfo] = useState<string>("");
  const [answerSdpInfo, setAnswerSdpInfo] = useState<string>("");
  const [videoTransform, setVideoTransform] = useState<VideoTransform>("none");
  const [dataChannelParams, setDataChannelParams] = useState<string>("{}");
  const [videoResolution, setVideoResolution] = useState<string>("");
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [logs, setLogs] = useState<RtcLogs>({
    dataChannel: "",
    iceConnection: "",
    iceGathering: "",
    signaling: "",
  });

  var dc: RTCDataChannel | null = null;
  var dcInterval: NodeJS.Timeout | null = null;

  function createPeerConnection() {
    var config: RTCConfiguration & { sdpSemantics: string } = {
      sdpSemantics: "unified-plan",
    };

    if (useStun) {
      config.iceServers = [{ urls: ["stun:stun.l.google.com:19302"] }];
    }

    const pc = new RTCPeerConnection(config);

    // register some listeners to help debugging
    pc.addEventListener(
      "icegatheringstatechange",
      () => {
        setLogs((logs) => ({
          ...logs,
          iceGathering: logs.iceGathering + " -> " + pc.iceGatheringState,
        }));
      },
      false
    );

    pc.addEventListener(
      "iceconnectionstatechange",
      () => {
        setLogs((logs) => ({
          ...logs,
          iceConnectionLog: logs.iceConnection + " -> " + pc.iceConnectionState,
        }));
      },
      false
    );

    pc.addEventListener(
      "signalingstatechange",
      () => {
        setLogs((logs) => ({
          ...logs,
          signalingLog: logs.signaling + " -> " + pc.signalingState,
        }));
      },
      false
    );

    // connect audio / video
    pc.addEventListener("track", (evt) => {
      if (!videoRef.current) return;

      if (evt.track.kind == "video") {
        videoRef.current.srcObject = evt.streams[0];
      } else {
        videoRef.current.srcObject = evt.streams[0];
      }
    });

    return pc;
  }

  function negotiate() {
    const pc = pcRef.current;
    if (pc === null) return;
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    return pc
      .createOffer()
      .then((offer) => {
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        console.log("Generate new promise");
        // wait for ICE gathering to complete
        return new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const checkState = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", checkState);
          }
        });
      })
      .then(() => {
        var offer = pc?.localDescription;

        console.log(offer);
        if (!offer) return;

        if (audioCodec !== "default") {
          offer = {
            ...offer,
            sdp: sdpFilterCodec("audio", audioCodec, offer.sdp),
          };
        }

        if (videoCodec !== "default") {
          offer = {
            ...offer,
            sdp: sdpFilterCodec("video", videoCodec, offer.sdp),
          };
        }

        console.log("before fetch");

        setOfferSdpInfo(offer.sdp);
        return fetch("http://localhost:3000/api/offer", {
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
            video_transform: videoTransform,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      })
      .then(function (response) {
        return response?.json();
      })
      .then(function (answer) {
        setAnswerSdpInfo(answer.sdp);
        return pc?.setRemoteDescription(answer);
      })
      .catch(function (e) {
        alert(e);
      });
  }

  function start() {
    pcRef.current = createPeerConnection();
    var time_start: number | null = null;

    function current_stamp() {
      if (time_start === null) {
        time_start = new Date().getTime();
        return 0;
      } else {
        return new Date().getTime() - time_start;
      }
    }

    if (useDataChannel) {
      var parameters = JSON.parse(dataChannelParams);

      dc = pcRef.current.createDataChannel("chat", parameters);
      dc.onclose = () => {
        if (dcInterval === null) return;
        clearInterval(dcInterval);
        setLogs((logs) => ({
          ...logs,
          dataChannel: logs.dataChannel + "- close\n",
        }));
      };
      dc.onopen = () => {
        setLogs((logs) => ({
          ...logs,
          dataChannel: logs.dataChannel + "- open\n",
        }));
        dcInterval = setInterval(() => {
          var message = "ping " + current_stamp();
          setLogs((logs) => ({
            ...logs,
            dataChannel: logs.dataChannel + "> " + message + "\n",
          }));
          dc?.send(message);
        }, 1000);
      };
      dc.onmessage = (evt) => {
        setLogs((logs) => ({
          ...logs,
          dataChannel: logs.dataChannel + "< " + evt.data + "\n",
        }));

        if (evt.data.substring(0, 4) === "pong") {
          var elapsed_ms =
            current_stamp() - parseInt(evt.data.substring(5), 10);
          setLogs((logs) => ({
            ...logs,
            dataChannel: logs.dataChannel + " RTT " + elapsed_ms + " ms\n",
          }));
        }
      };
    }

    var constraints: {
      audio: boolean;
      video: boolean | { width: number; height: number };
    } = {
      audio: useAudio,
      video: false,
    };

    if (useVideo) {
      var resolution = videoResolution;
      if (resolution) {
        const [width, height] = resolution.split("x");
        constraints.video = {
          width: parseInt(width, 0),
          height: parseInt(height, 0),
        };
      } else {
        constraints.video = true;
      }
    }

    negotiate();
  }

  function stop() {
    //document.getElementById("stop").style.display = "none";

    // close peer connection
    setTimeout(() => {
      pcRef.current?.close();
      console.log("Try to close peer connection");
    }, 500);
  }

  function turnOff() {
    fetch("http://localhost:3000/api/turnoff", {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    pcRef.current = null;
  }

  return (
    <main>
      <h2>Options</h2>
      <div className="mb-[8px]">
        <input
          id="use-datachannel"
          checked={useDataChannel}
          type="checkbox"
          onChange={() => setUseDataChannel((value) => !value)}
        />
        <label htmlFor="use-datachannel">Use datachannel</label>
        <select
          id="datachannel-parameters"
          value={dataChannelParams}
          onChange={(e) => setDataChannelParams(e.target.value)}
        >
          <option value='{"ordered": true}'>Ordered, reliable</option>
          <option value='{"ordered": false, "maxRetransmits": 0}'>
            Unordered, no retransmissions
          </option>
          <option value='{"ordered": false, "maxPacketLifetime": 500}'>
            Unordered, 500ms lifetime
          </option>
        </select>
      </div>
      <div className="mb-[8px]">
        <input
          id="use-audio"
          checked={useAudio}
          type="checkbox"
          onChange={() => setUseAudio((value) => !value)}
        />
        <label htmlFor="use-audio">Use audio</label>
        <select
          id="audio-codec"
          value={audioCodec}
          onChange={(e) => setAudioCodec(e.target.value)}
        >
          <option value="default">Default codecs</option>
          <option value="opus/48000/2">Opus</option>
          <option value="PCMU/8000">PCMU</option>
          <option value="PCMA/8000">PCMA</option>
        </select>
      </div>
      <div className="mb-[8px]">
        <input
          id="use-video"
          checked={useVideo}
          type="checkbox"
          onChange={() => setUseVideo((value) => !value)}
        />
        <label htmlFor="use-video">Use video</label>
        <select
          id="video-resolution"
          value={videoResolution}
          onChange={(e) => setVideoResolution(e.target.value)}
        >
          <option value="">Default resolution</option>
          <option value="320x240">320x240</option>
          <option value="640x480">640x480</option>
          <option value="960x540">960x540</option>
          <option value="1280x720">1280x720</option>
        </select>
        <select
          id="video-transform"
          value={videoTransform}
          onChange={(e) => setVideoTransform(e.target.value as VideoTransform)}
        >
          <option value="none">No transform</option>
          <option value="edges">Edge detection</option>
          <option value="cartoon">Cartoon effect</option>
          <option value="rotate">Rotate</option>
        </select>
        <select
          id="video-codec"
          value={videoCodec}
          onChange={(e) => setVideoCodec(e.target.value)}
        >
          <option value="default">Default codecs</option>
          <option value="VP8/90000">VP8</option>
          <option value="H264/90000">H264</option>
        </select>
      </div>
      <div className="mb-[8px]">
        <input
          id="use-stun"
          type="checkbox"
          checked={useStun}
          onChange={() => setUseStun((value) => !value)}
        />
        <label htmlFor="use-stun">Use STUN server</label>
      </div>
      <button id="start" className="px-[16px] py-[8px]" onClick={start}>
        Start
      </button>
      <button id="stop" className="px-[16px] py-[8px]" onClick={stop}>
        Stop
      </button>
      <button id="turnoff" className="px-[16px] py-[8px]" onClick={turnOff}>
        Turn off
      </button>

      <h2>State</h2>
      <p>
        ICE gathering state:
        <span id="ice-gathering-state">{logs.iceGathering}</span>
      </p>
      <p>
        ICE connection state:
        <span id="ice-connection-state">{logs.iceConnection}</span>
      </p>
      <p>
        Signaling state: <span id="signaling-state">{logs.signaling}</span>
      </p>

      <div id="media">
        <h2>Media</h2>

        <audio ref={audioRef} autoPlay />
        <video
          ref={videoRef}
          id="video"
          autoPlay
          playsInline
          className="w-full max-w-[1280px]"
        />
      </div>

      <h2>Data channel</h2>
      <pre id="data-channel" className="h-[200px]"></pre>

      <h2>SDP</h2>

      <h3>Offer</h3>
      <pre id="offer-sdp">{offerSdpInfo}</pre>

      <h3>Answer</h3>
      <pre id="answer-sdp" className="overflow-x-hidden overflow-y-auto">
        {answerSdpInfo}
      </pre>
    </main>
  );
}

function sdpFilterCodec(
  kind: "audio" | "video",
  codec: string,
  realSdp: string
) {
  var allowed = [];
  var rtxRegex = new RegExp("a=fmtp:(\\d+) apt=(\\d+)\r$");
  var codecRegex = new RegExp("a=rtpmap:([0-9]+) " + escapeRegExp(codec));
  var videoRegex = new RegExp("(m=" + kind + " .*?)( ([0-9]+))*\\s*$");

  var lines = realSdp.split("\n");

  var isKind = false;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("m=" + kind + " ")) {
      isKind = true;
    } else if (lines[i].startsWith("m=")) {
      isKind = false;
    }

    if (isKind) {
      var match = lines[i].match(codecRegex);
      if (match) {
        allowed.push(parseInt(match[1]));
      }

      match = lines[i].match(rtxRegex);
      if (match && allowed.includes(parseInt(match[2]))) {
        allowed.push(parseInt(match[1]));
      }
    }
  }

  var skipRegex = "a=(fmtp|rtcp-fb|rtpmap):([0-9]+)";
  var sdp = "";

  isKind = false;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("m=" + kind + " ")) {
      isKind = true;
    } else if (lines[i].startsWith("m=")) {
      isKind = false;
    }

    if (isKind) {
      var skipMatch = lines[i].match(skipRegex);
      if (skipMatch && !allowed.includes(parseInt(skipMatch[2]))) {
        continue;
      } else if (lines[i].match(videoRegex)) {
        sdp += lines[i].replace(videoRegex, "$1 " + allowed.join(" ")) + "\n";
      } else {
        sdp += lines[i] + "\n";
      }
    } else {
      sdp += lines[i] + "\n";
    }
  }

  return sdp;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
