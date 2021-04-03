import cv2
import mediapipe as mp
import math
import numpy as np
import os
import tqdm
from sklearn.svm import OneClassSVM
from sklearn import svm
from joblib import dump, load
from sklearn.decomposition import PCA
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.model_selection import GridSearchCV
from sklearn.linear_model import SGDClassifier
from sklearn.svm import SVC
import time

mp_drawing = mp.solutions.drawing_utils
mp_face_mesh = mp.solutions.face_mesh

'''
https://github.com/google/mediapipe/blob/master/mediapipe/python/solutions/face_mesh.py 
Check this link for grouping and facelandmark format

'''

PART_CONNECTION = {
    'left eye': [(33, 7),
                 (7, 163),
                 (163, 144),
                 (144, 145),
                 (145, 153),
                 (153, 154),
                 (154, 155),
                 (155, 133),
                 (33, 246),
                 (246, 161),
                 (161, 160),
                 (160, 159),
                 (159, 158),
                 (158, 157),
                 (157, 173),
                 (173, 133)],
    'right eye': [(263, 249),
                  (249, 390),
                  (390, 373),
                  (373, 374),
                  (374, 380),
                  (380, 381),
                  (381, 382),
                  (382, 362),
                  (263, 466),
                  (466, 388),
                  (388, 387),
                  (387, 386),
                  (386, 385),
                  (385, 384),
                  (384, 398),
                  (398, 362)],
    'left eyebrow': [(46, 53),
                     (53, 52),
                     (52, 65),
                     (65, 55),
                     (70, 63),
                     (63, 105),
                     (105, 66),
                     (66, 107)],
    'right eyebrow': [(276, 283),
                      (283, 282),
                      (282, 295),
                      (295, 285),
                      (300, 293),
                      (293, 334),
                      (334, 296),
                      (296, 336)],
}

POI4AOI = [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 
            158, 157, 173, 263, 249, 390, 373, 374, 380, 381, 382, 362,
           466, 388, 387, 386, 385, 384, 398, 46, 53, 52, 65, 55, 70, 63, 105, 
           66, 107, 276, 283, 282, 295, 285, 300, 293, 334, 296, 336]


def facemesh_local_data_gen(dataset_dir):
    # For static images:
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        min_detection_confidence=0.5)
    conf_set = [os.path.join(dataset_dir, 'confused', f)
                for f in os.listdir(os.path.join(dataset_dir, 'confused'))]
    unconf_set = [os.path.join(dataset_dir, 'not_confused', f)
                  for f in os.listdir(os.path.join(dataset_dir, 'not_confused'))]

    imgset = [unconf_set, conf_set]
    if not os.path.exists(os.path.join(dataset_dir, 'crop')):
        os.mkdir(os.path.join(dataset_dir, 'crop'))
    for label in range(len(imgset)):
        print('Generating data for label {}...'.format(label))
        for f in tqdm.tqdm(imgset[label]):
            image = cv2.imread(f)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image = cv2.resize(image, (640, 360))
            results = face_mesh.process(image)
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            if results.multi_face_landmarks:
                face_landmarks = results.multi_face_landmarks[0]
                try:
                    dstImg = getCrop(image, face_landmarks)
                    im_name = f.split('/')[-1]
                    # cv2.imshow('test', cv2.cvtColor(dstImg, cv2.COLOR_BGR2GRAY))
                    cv2.imwrite(os.path.join(dataset_dir, 'crop', '{}_{}'.format(label, im_name)), dstImg)
                except Exception as e:
                    print('FILE:{}, ERROR:{}'.format(f, e))
    print('Data generation done!')
    face_mesh.close()


def classify(dataset_dir, model_dir):
    
    image_files = [os.path.join(dataset_dir, f) for f in os.listdir(dataset_dir)]
    inputs = []
    labels = []

    for f in image_files:
        if '.jpg' not in f:
            continue
        img = cv2.imread(f, cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, (100, 50))
        # cv2.imshow('test', img)
        # cv2.waitKey(0)
        label = int(f.split('/')[-1].split('_')[0])
        inputs.append(img)
        labels.append(label)
    inputs = np.array(inputs)
    labels = np.array(labels)
    inputs = np.reshape(inputs, (inputs.shape[0], -1))
    
    X_train, X_test, y_train, y_test = train_test_split(
        inputs, labels, test_size=0.6, random_state=42)
    
    t0 = time.time()
    n_component = 25
    pca = PCA(n_component, svd_solver='randomized', whiten=True).fit(X_train)
    print('PCA fit done in {}s'.format(time.time() - t0))

    t0 = time.time()
    X_train_pca = pca.transform(X_train)
    X_test_pca = pca.transform(X_test)
    print('PCA transform done in {}s'.format(time.time() - t0))

    t0 = time.time()
    param_grid = {'C': [1e3, 5e3, 1e4, 5e4, 1e5],
                  'gamma': [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.1], }
    # clf = GridSearchCV(
    #     SVC(kernel='rbf', class_weight='balanced'), param_grid
    # )
    clf = SVC()
    print(X_train_pca.shape)
    print(y_train.shape)
    clf = clf.fit(X_train_pca, y_train)
    print('SVM train done in {}s'.format(time.time() - t0))
    # print("Best estimator found by grid search:")
    # print(clf.best_estimator_)
   
    t0 = time.time()
    y_pred = clf.predict(X_test_pca)
    print("testing done in {}s".format(time.time() - t0))

    dump(clf, os.path.join(model_dir, 'model_pca.joblib'))
    dump(pca, os.path.join(model_dir, 'pca.joblib'))

    print(classification_report(y_test, y_pred))


def facemesh_online_exp(retrain, model_dir):
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        min_detection_confidence=0.5)
    cap = cv2.VideoCapture(0)
    
    try:
        clf = load(os.path.join(model_dir, 'model_pca.joblib'))
        pca = load(os.path.join(model_dir, 'pca.joblib'))
    except:
        clf = None
        pca = None

    tag = ['Neutral ', 'Confused ']

    if retrain:
        response = input('Ready to collect neutral face?')
        if response != 'y':
            print('Thanks :)')
            return
        count = 0
        total = 1200
        inputs = []
        labels = []
    collect = 0 # 0: neutral, 1: confused
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break
        # Flip the image horizontally for a later selfie-view display, and convert
        # the BGR image to RGB.
        image = cv2.cvtColor(cv2.flip(image, 1), cv2.COLOR_BGR2RGB)
        image = cv2.resize(image, (640, 360))
        # print(image.shape)        
        # To improve performance, optionally mark the image as not writeable to
        # pass by reference.
        image.flags.writeable = False
        results = face_mesh.process(image)

        # Draw the face mesh annotations on the image.
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]

            # print(matrix)
            cropped = getCrop(image, face_landmarks)
            img = cv2.cvtColor(cv2.resize(cropped, (100, 50)), cv2.COLOR_BGR2GRAY)
            if collect < 2 and retrain:
                inputs.append(np.reshape(img, (-1)))
                labels.append(collect)
                count += 1
                # print(count)
                image = cv2.putText(image, tag[collect] + str(count), (50,50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                if count > total:
                    collect += 1
                    count = 0
                    if collect == 1:
                        response = input('Ready to collect CONFUSED face?')
                        if response != 'y':
                            print('Thanks :)')
                            return
                    elif collect == 2:
                        # data collection done!
                        inputs = np.array(inputs)
                        labels = np.array(labels)

                        t0 = time.time()
                        n_component = 150
                        pca = PCA(n_component, svd_solver='randomized', whiten=True).fit(inputs)
                        print('PCA fit done in {}s'.format(time.time() - t0))

                        t0 = time.time()
                        X_train_pca = pca.transform(inputs)
                        print('PCA transform done in {}s'.format(time.time() - t0))

                        t0 = time.time()
                        # clf = SVC()
                        clf = SGDClassifier()
                        print(X_train_pca.shape)
                        clf = clf.fit(X_train_pca, labels)
                        print('SVM train done in {}s'.format(time.time() - t0))

                        dump(clf, os.path.join(model_dir, 'model_pca.joblib'))
                        dump(pca, os.path.join(model_dir, 'pca.joblib'))

            else: 
                feature = np.reshape(img, (1, -1))
                reduced_feature = pca.transform(feature)
                pred = clf.predict(reduced_feature)
                res = tag[pred[0]]
                image = cv2.putText(image, res, (50, 50),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            cv2.imshow('confusion detection', image)
        if cv2.waitKey(5) & 0xFF == 27:
            break

    face_mesh.close()
    cap.release()


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


def findKeypoints():
    point_list = []
    for k, part in PART_CONNECTION.items():
        for pair in part:
            # print(pair)
            p1, p2 = pair
            if p1 not in point_list:
                point_list.append(p1)
            if p2 not in point_list:
                point_list.append(p2)
    print(point_list, len(point_list))

# findKeypoints()


# facemesh_online_exp(False, 'dataset_rw/evening_models1208')
# facemesh_online_exp(False, 'dataset_rw/evening_models')
# classify('dataset_dyh/crop', 'dataset_rw')
facemesh_online_exp(True, 'data/')
