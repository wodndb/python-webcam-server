# Server

## 환경 설정

이 서버에서 사용하는 라이브러리를 설치하기 위해 다음 명령어를 실행합니다.

```
pip3 install -r requirements.txt
```

또한 미디어파이프에서 사용할 모델을 다운로드받습니다.

- [모델 배포 링크](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker#configurations_options)

## 서버 실행

```
python3 webcam.py
```

## 공부용 코드

- cv_webcam_test.py
  - OpenCV로 웹캠 연결하여 출력하는 테스트.
- mjpeg_http_test.py
  - http로 mjpeg을 전송하여 OpenCV로 받은 웹캠 영상을 스트리밍하는 테스트.
  - 실행 후 브라우저에서 http://localhost:8080/cam 에 접속하여 웹캠 확인 가능.
