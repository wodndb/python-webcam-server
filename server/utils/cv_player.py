import cv2
from aiortc import (
    VideoStreamTrack,
)
from av import VideoFrame


# ref: https://github.com/aiortc/aiortc/issues/447
# TODO: prevent holding up event loop and calculate timing information accurately.
class CvStreamTrack(VideoStreamTrack):
    """
    A video track that returns an animated flag.
    """

    def __init__(self):
        super().__init__()  # don't forget this!

        video = cv2.VideoCapture(0)
        video.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
        video.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)

        self.video = video

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        res, img = self.video.read()
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        frame.pts = pts
        frame.time_base = time_base
        return frame
