# OpenCV에서 웹캠 영상을 불러와서 확인해보는 테스트
import cv2

webcam = cv2.VideoCapture(0)

if not webcam.isOpened():
    print("⛔️ Webcam is not opened. Exit :(")
    exit()

while webcam.isOpened():
    status, frame = webcam.read()

    if status:
        cv2.imshow("test", frame)

    if cv2.waitKey(33) == ord("q"):
        print("Exit")
        break

webcam.release()
cv2.destroyAllWindows()
