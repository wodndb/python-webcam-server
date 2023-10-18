import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from .draw_landmarks import draw_landmarks_on_image

base_options = python.BaseOptions(model_asset_path="utils/pose_landmarker_heavy.task")
options = vision.PoseLandmarkerOptions(
    base_options=base_options, output_segmentation_masks=False
)
detector = vision.PoseLandmarker.create_from_options(options)


def img_to_cartoon(img):
    # prepare color
    img_color = cv2.pyrDown(cv2.pyrDown(img))
    for _ in range(6):
        img_color = cv2.bilateralFilter(img_color, 9, 9, 7)
    img_color = cv2.pyrUp(cv2.pyrUp(img_color))

    # prepare edges
    img_edges = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    img_edges = cv2.adaptiveThreshold(
        cv2.medianBlur(img_edges, 7),
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        9,
        2,
    )
    img_edges = cv2.cvtColor(img_edges, cv2.COLOR_GRAY2RGB)

    # combine color and edges
    img = cv2.bitwise_and(img_color, img_edges)

    return img


def img_filter(img, filter_type):
    if filter_type == "cartoon":
        return img_to_cartoon(img)
    elif filter_type == "edges":
        return cv2.cvtColor(cv2.Canny(img, 100, 200), cv2.COLOR_GRAY2BGR)
    elif filter_type == "rotate":
        # rotate image
        rows, cols, _ = img.shape
        M = cv2.getRotationMatrix2D((cols / 2, rows / 2), frame.time * 45, 1)
        return cv2.warpAffine(img, M, (cols, rows))
    elif filter_type == "mediapipe":
        mpImg = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
        detection_result = detector.detect(mpImg)
        return draw_landmarks_on_image(mpImg.numpy_view(), detection_result)
    else:
        return img
