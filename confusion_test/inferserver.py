from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import base64
import numpy as np
import cv2
import os
import mediapipe as mp
import math
import tqdm
from sklearn.svm import OneClassSVM
from sklearn import svm
from joblib import dump, load
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.model_selection import GridSearchCV
from sklearn.svm import SVC
import time
import argparse

CNTR = 0
TOTAL = 1000
FILEPATH = 'data_temp'

POI4AOI = [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159,
           158, 157, 173, 263, 249, 390, 373, 374, 380, 381, 382, 362,
           466, 388, 387, 386, 385, 384, 398, 46, 53, 52, 65, 55, 70, 63, 105,
           66, 107, 276, 283, 282, 295, 285, 300, 293, 334, 296, 336]

if not os.path.exists(FILEPATH):
    # os.rmdir(FILEPATH)
    os.mkdir(FILEPATH)
    print('folder {} not find, have created one.'.format(FILEPATH))

modelPool = {}

def _normalized_to_pixel_coordinates(normalized_x, normalized_y, image_width, image_height):
    """Converts normalized value pair to pixel coordinates."""

    # Checks if the float value is between 0 and 1.
    def is_valid_normalized_value(value: float) -> bool:
        return (value > 0 or math.isclose(0, value)) and (value < 1 or
                                                          math.isclose(1, value))

    if not (is_valid_normalized_value(normalized_x) and
            is_valid_normalized_value(normalized_y)):
        # TODO: Draw coordinates even if it's outside of the image bounds.
        return None
    x_px = min(math.floor(normalized_x * image_width), image_width - 1)
    y_px = min(math.floor(normalized_y * image_height), image_height - 1)
    return x_px, y_px


def getCrop(img, landmarks):
    h, w, _ = img.shape
    pt1, pt2, pt3 = landmarks.landmark[133], landmarks.landmark[362], landmarks.landmark[2]
    matrix = warpFrom(
        _normalized_to_pixel_coordinates(pt1.x, pt1.y, w, h),
        _normalized_to_pixel_coordinates(pt2.x, pt2.y, w, h),
        _normalized_to_pixel_coordinates(pt3.x, pt3.y, w, h),
    )
    dstImg = cv2.warpAffine(img, matrix, (img.shape[1], img.shape[0]))

    left, top, bottom, right = -1, -1, -1, -1

    init = False
    for idx in POI4AOI:
        px = landmarks.landmark[idx]
        try:
            px = _normalized_to_pixel_coordinates(px.x, px.y, w, h)
            px = (matrix @ np.array([px[0], px[1], 1])).astype(np.int)
            if not init:
                left, right = px[0], px[0]
                top, bottom = px[1], px[1]
                init = True
                continue
            if left > px[0]:
                left = px[0]
            if right < px[0]:
                right = px[0]
            if top > px[1]:
                top = px[1]
            if bottom < px[1]:
                bottom = px[1]
        except Exception as e:
            print('ERROR:{}'.format(e))

    # return cv2.rectangle(dstImg, (left, top), (right, bottom), (255, 0, 0), 2)
    return dstImg[top:bottom+1, left:right+1]


def warpFrom(pt1, pt2, pt3):

    srcTri = np.array([[pt1[0], pt1[1]],
                       [pt2[0], pt2[1]],
                       [pt3[0], pt3[1]]]).astype(np.float32)

    dstTri = np.array([[300, 180],
                       [340, 180],
                       [320, 240]]).astype(np.float32)
    matrix = cv2.getAffineTransform(srcTri, dstTri)
    return matrix

class StatePredictor:

    def __init__(self, usrname):
        self.facemesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            min_detection_confidence=0.5)
        self.inputs = []
        self.labels = []
        self.clf = None
        self.pca = None
        self.username = usrname
        self.retrain_interval = 1000 # TODO: incremental training!
        self.dir = os.path.join(FILEPATH, self.username)
        if not os.path.exists(self.dir):
            os.mkdir(self.dir)
        elif os.path.exists(os.path.join(self.dir, 'pca.joblib')):
            self.clf = load(os.path.join(self.dir, 'model_pca.joblib'))
            self.pca = load(os.path.join(self.dir, 'pca.joblib'))

    
    def addData(self, img, label, incre=False):
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img.flags.writeable = False
        results = self.facemesh.process(img)
        img.flags.writeable = True
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            # print(matrix)
            cropped = getCrop(img, face_landmarks)
            img = cv2.cvtColor(cv2.resize(
                cropped, (100, 50)), cv2.COLOR_BGR2GRAY)
            if not incre:
                self.inputs.append(np.reshape(img, (-1)))
                self.labels.append(label)
            # TODO: svm incremental learning 
    
    def train(self):
        inputs = np.array(self.inputs)
        labels = np.array(self.labels)

        t0 = time.time()
        n_component = 150
        self.pca = PCA(n_component, svd_solver='auto',
                  whiten=True).fit(inputs)
        print('PCA fit done in {}s'.format(time.time() - t0))

        t0 = time.time()
        X_train_pca = self.pca.transform(inputs)
        print('PCA transform done in {}s'.format(
            time.time() - t0))

        t0 = time.time()
        self.clf = SVC()
        print(X_train_pca.shape)
        self.clf = self.clf.fit(X_train_pca, labels)
        print('SVM train done in {}s'.format(time.time() - t0))
    
        dump(self.clf, os.path.join(self.dir, 'model_pca.joblib'))
        dump(self.pca, os.path.join(self.dir, 'pca.joblib'))

    
    def confusionDetection(self, img):
        if self.clf is None:
            self.train()
        tag = ['Neutral', 'Confused']
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img.flags.writeable = False
        results = self.facemesh.process(img)
        img.flags.writeable = True
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            # print(matrix)
            cropped = getCrop(img, face_landmarks)
            img = cv2.cvtColor(cv2.resize(
                cropped, (100, 50)), cv2.COLOR_BGR2GRAY)
            feature = np.reshape(img, (1, -1))
            reduced_feature = self.pca.transform(feature)
            pred = self.clf.predict(reduced_feature)
            res = tag[pred[0]]
            return res
        return 'N/A'



class ConfusionDetectionRequestHandler(BaseHTTPRequestHandler):
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def send_json(self, d):
        self.wfile.write(bytes(json.dumps(d), "utf8"))

    def _send_cors_headers(self):
        """ Sets headers required for CORS """
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers",
                       "x-api-key,Content-Type")

    def do_GET(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write("received GET request")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        global CNTR, TOTAL, FILEPATH
        '''Reads post request body'''
        content_len = int(self.headers.get('content-length', 0))
        post_body = self.rfile.read(content_len)
        # print(post_body)
        data = json.loads(post_body)
        img_bytes = base64.b64decode(data['img'].split(',')[1])
        im_arr = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(im_arr, flags=cv2.IMREAD_COLOR)
        stage = data['stage']
        username = data['username']
        if username not in modelPool:
            modelPool[username] = StatePredictor(username)
        
        result = 'success'
        print(username, 'stage', stage)
        try:
            if stage == 0:
                modelPool[username].addData(img, data['label'])
            elif stage == 1:
                result = modelPool[username].confusionDetection(img)
            else:
                modelPool[username].addData(img, data['label'], incre=True)
        except Exception as e:
            result = 'ERROR'
            print('ERROR:{}'.format(e))
        self.send_response(200)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.send_json({
            'method': self.command,
            'path': self.path,
            # 'real_path': parsed_path.query,
            # 'query': parsed_path.query,
            'request_version': self.request_version,
            'protocol_version': self.protocol_version,
            'body': {'result': result},
        })


parser = argparse.ArgumentParser()
parser.add_argument("-p", "--portid", type=int, default=0,
                    help="port id")
args = parser.parse_args()

host = ''

PORT = 8000 + args.portid
print('Serving on port {}...'.format(PORT))

HTTPServer((host, PORT), ConfusionDetectionRequestHandler).serve_forever()


