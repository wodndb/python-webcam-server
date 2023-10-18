import asyncio
import fractions
import time
import cv2
from aiortc import MediaStreamTrack

from typing import Tuple, Union
from av import VideoFrame
from .img_proc import img_filter


class MediaStreamError(Exception):
    pass


# ref: https://github.com/aiortc/aiortc/issues/447
# TODO: prevent holding up event loop and calculate timing information accurately.


class CvStreamTrack(MediaStreamTrack):
    """
    A video track stream camera from cv.
    """

    kind = "video"

    _start: float
    _timestamp: int

    def __init__(self):
        super().__init__()  # don't forget this!

        video = cv2.VideoCapture(0)
        video.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        video.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        self.video = video

    async def next_timestamp(self) -> Tuple[int, fractions.Fraction]:
        # https://stackoverflow.com/questions/43845905/why-rtps-timestamp-for-video-payload-use-a-90-khz-clock-rate
        VIDEO_CLOCK_RATE = 90000
        VIDEO_PTIME = 1 / 30  # 30fps
        VIDEO_TIME_BASE = fractions.Fraction(1, VIDEO_CLOCK_RATE)

        if self.readyState != "live":
            raise MediaStreamError
        if hasattr(self, "_timestamp"):
            self._timestamp += int(VIDEO_PTIME * VIDEO_CLOCK_RATE)
            wait = self._start + (self._timestamp / VIDEO_CLOCK_RATE) - time.time()
            await asyncio.sleep(wait)
        else:
            self._start = time.time()
            self._timestamp = 0
        return self._timestamp, VIDEO_TIME_BASE

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        res, img = self.video.read()
        img = img_filter(img, "mediapipe")
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame

    def turn_off(self):
        self.video.release()
