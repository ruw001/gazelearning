import cv2
import mediapipe as mp
import math
import numpy as np
import os
import tqdm
from sklearn.svm import OneClassSVM, SVC
from joblib import dump, load
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

FACE_CONNECTIONS = [
    # Lips.
    [(61, 146),
    (146, 91),
    (91, 181),
    (181, 84),
    (84, 17),
    (17, 314),
    (314, 405),
    (405, 321),
    (321, 375),
    (375, 291),
    (61, 185),
    (185, 40),
    (40, 39),
    (39, 37),
    (37, 0),
    (0, 267),
    (267, 269),
    (269, 270),
    (270, 409),
    (409, 291),
    (78, 95),
    (95, 88),
    (88, 178),
    (178, 87),
    (87, 14),
    (14, 317),
    (317, 402),
    (402, 318),
    (318, 324),
    (324, 308),
    (78, 191),
    (191, 80),
    (80, 81),
    (81, 82),
    (82, 13),
    (13, 312),
    (312, 311),
    (311, 310),
    (310, 415),
    (415, 308)],

    # Left eye.
    [(33, 7),
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

    # Left eyebrow.
    [(46, 53),
    (53, 52),
    (52, 65),
    (65, 55),
    (70, 63),
    (63, 105),
    (105, 66),
    (66, 107)],

    # Left subbrow
    [(113, 225),
    (225, 224),
    (224, 223), 
    (223,222), 
    (222, 221), 
    (221, 193)],

    # Middle
    [(107, 9), 
    (9, 336), 
    (55, 8), 
    (8, 285), 
    (417, 168),
    (193, 168),
    (133, 243), 
    (243, 244), 
    (244, 245), 
    (245, 122), 
    (122, 6), 
    (6, 351), 
    (351, 465), 
    (465, 464), 
    (464, 463), 
    (463, 362)],

    # Right eye.
    [(263, 249),
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

    # Right eyebrow.
    [(276, 283),
    (283, 282),
    (282, 295),
    (295, 285),
    (300, 293),
    (293, 334),
    (334, 296),
    (296, 336)],

    # Right subbrow
    [(417, 441), 
    (441, 442), 
    (442, 443), 
    (443, 444), 
    (444, 445), 
    (445, 342)],

    # Face oval.
    [(10, 338),
    (338, 297),
    (297, 332),
    (332, 284),
    (284, 251),
    (251, 389),
    (389, 356),
    (356, 454),
    (454, 323),
    (323, 361),
    (361, 288),
    (288, 397),
    (397, 365),
    (365, 379),
    (379, 378),
    (378, 400),
    (400, 377),
    (377, 152),
    (152, 148),
    (148, 176),
    (176, 149),
    (149, 150),
    (150, 136),
    (136, 172),
    (172, 58),
    (58, 132),
    (132, 93),
    (93, 234),
    (234, 127),
    (127, 162),
    (162, 21),
    (21, 54),
    (54, 103),
    (103, 67),
    (67, 109),
    (109, 10)]
]

w_mouth = False

# 118 points w/ mouth
point_of_interest_wmouth = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 
                    291, 185, 40, 39, 37, 0, 267, 269, 270, 409, 
                    78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 
                    308, 191, 80, 81, 82, 13, 312, 311, 310, 415, 
                    33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 
                    161, 160, 159, 158, 157, 173, 46, 53, 52, 65, 
                    55, 70, 63, 105, 66, 107, 113, 225, 224, 223, 
                    222, 221, 193, 9, 336, 8, 285, 417, 168, 243, 
                    244, 245, 122, 6, 351, 465, 464, 463, 362, 263, 
                    249, 390, 373, 374, 380, 381, 382, 466, 388, 387, 
                    386, 385, 384, 398, 276, 283, 282, 295, 300, 293, 
                    334, 296, 441, 442, 443, 444, 445, 342]


if not w_mouth:
    point_of_interest = [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 
                        161, 160, 159, 158, 157, 173, 46, 53, 52, 65, 
                        55, 70, 63, 105, 66, 107, 113, 225, 224, 223, 
                        222, 221, 193, 9, 336, 8, 285, 417, 168, 
                        243, 244, 245, 122, 6, 351, 465, 464, 463, 362, 
                        263, 249, 390, 373, 374, 380, 381, 382, 466, 388, 
                        387, 386, 385, 384, 398, 276, 283, 282, 295, 300, 
                        293, 334, 296, 441, 442, 443, 444, 445, 342]

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
    inputs = []
    labels = []
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
                # print(matrix)
                h, w, _ = image.shape
                try:
                    feature = getPOI(h, w, face_landmarks)
                    inputs.append(feature)
                    labels.append(label)
                except Exception as e:
                    print('FILE:{}, ERROR:{}'.format(f, e))
    print('Data generation done!')    
    face_mesh.close()
    inputs, labels = np.array(inputs), np.array(labels)
    print('input shape:{}, labels shape:{}'.format(inputs.shape, labels.shape))
    return inputs, labels

def classify(inputs, labels, modelname):
    #### using OneClassSVM
    # inputs = np.reshape(inputs, (inputs.shape[0], -1))
    # conf_inputs = inputs[labels == 1].copy()
    # unconf_inputs = inputs[labels == 0].copy()
    # indices = np.arange(conf_inputs.shape[0])
    # np.random.shuffle(indices)
    # conf_inputs = conf_inputs[indices]
    # train_set = conf_inputs[:int(0.7*len(conf_inputs))]
    # test_conf_set = conf_inputs[len(train_set):]
    # clf = OneClassSVM(gamma='auto').fit(train_set)
    # res = clf.predict(test_conf_set)
    # print('Recall: {}'.format((res == 1).sum() / len(res)))

    #### using SVC
    inputs = np.reshape(inputs, (inputs.shape[0], -1))
    indices = np.arange(inputs.shape[0])
    np.random.shuffle(indices)
    inputs = inputs[indices]
    labels = labels[indices]
    traindata = inputs[:int(0.4*len(inputs))]
    trainlabels = labels[:int(0.4*len(labels))]
    testdata = inputs[len(traindata):]
    testlabels = labels[len(trainlabels):]
    clf = svm.SVC()
    clf.fit(traindata, trainlabels)
    res = clf.predict(testdata)
    print('Accuracy: {}'.format((res == testlabels).sum() / len(res)))
    dump(clf, modelname)


def facemesh_online_exp(retrain, model_dir):
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        min_detection_confidence=0.5)
    cap = cv2.VideoCapture(0)

    try:
        clf = load(os.path.join(model_dir, 'model.joblib'))
    except:
        clf = None
    # pca = load(os.path.join(model_dir, 'pca.joblib'))

    if retrain:
        response = input('Ready to collect neutral face?')
        if response != 'y':
            print('Thanks :)')
            return
        count = 0
        total = 400
        inputs = []
        labels = []
    collect = 0  # 0: neutral, 1: confused
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
            feature = getPOI(image, face_landmarks)
            if collect < 2 and retrain:
                inputs.append(np.reshape(feature, (-1)))
                labels.append(collect)
                count += 1
                # print(count)
                image = cv2.putText(image, str(
                    count), (50, 20), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
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
                        clf = SVC()
                        print(inputs.shape)
                        clf = clf.fit(inputs, labels)
                        print('SVM train done in {}s'.format(time.time() - t0))

                        dump(clf, os.path.join(model_dir, 'model.joblib'))

            else:
                pred = clf.predict(np.reshape(feature, (1,-1)))
                res = 'Confused' if pred[0] == 1 else 'Neutral'
                image = cv2.putText(image, res, (50, 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            cv2.imshow('confusion detection', image)
        if cv2.waitKey(5) & 0xFF == 27:
            break

    face_mesh.close()
    cap.release()




def facemesh_online_testing():
    # For webcam input:
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=1,
        min_detection_confidence=0.5)
    # drawing_spec = mp_drawing.DrawingSpec(thickness=1, circle_radius=1)
    cap = cv2.VideoCapture(0)
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
            h, w, _ = image.shape
            # feature = np.reshape(getPOI(h, w, face_landmarks), (1,-1))
            # res = clf.predict(feature)
            drawLandmarks(image, face_landmarks)
        cv2.imshow('MediaPipe FaceMesh', image)
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


def warpFrom(pt1, pt2, pt3):

    srcTri = np.array([[pt1[0], pt1[1]],
                       [pt2[0], pt2[1]],
                       [pt3[0], pt3[1]]]).astype(np.float32)

    dstTri = np.array([[300, 180],
                       [340, 180],
                       [320, 240]]).astype(np.float32)
    dstTri = np.array([[140, 180],
                       [180, 180],
                       [160, 240]]).astype(np.float32)
    matrix = cv2.getAffineTransform(srcTri, dstTri)
    return matrix


def getPOI(image, landmarks):
    h, w, _ = image.shape
    pt1, pt2, pt3 = landmarks.landmark[133], landmarks.landmark[362], landmarks.landmark[2]
    matrix = warpFrom(
        _normalized_to_pixel_coordinates(pt1.x, pt1.y, w, h),
        _normalized_to_pixel_coordinates(pt2.x, pt2.y, w, h),
        _normalized_to_pixel_coordinates(pt3.x, pt3.y, w, h),
    )
    point_list = []
    all_point = range(0, len(landmarks.landmark))
    for idx in point_of_interest:
        pt = landmarks.landmark[idx]
        pt = _normalized_to_pixel_coordinates(pt.x, pt.y, w, h)
        pt = matrix @ np.array([pt[0], pt[1], 1])
        point_list.append(pt)
    return np.array(point_list)



def drawLandmarks(img, landmarks):
    h, w, _ = img.shape
    # idx_to_coordinates = {}
    try:
        pt1, pt2, pt3 = landmarks.landmark[133], landmarks.landmark[362], landmarks.landmark[2]
        matrix = warpFrom(
            _normalized_to_pixel_coordinates(pt1.x, pt1.y, w, h),
            _normalized_to_pixel_coordinates(pt2.x, pt2.y, w, h),
            _normalized_to_pixel_coordinates(pt3.x, pt3.y, w, h),
        )
    except Exception as e:
        print(e)
    # for part in FACE_CONNECTIONS[:-1]:
    #     for pair in part:
    #         px1, px2 = landmarks.landmark[pair[0]], landmarks.landmark[pair[1]]
    #         try:
    #             px1 = _normalized_to_pixel_coordinates(px1.x, px1.y, w, h)
    #             px2 = _normalized_to_pixel_coordinates(px2.x, px2.y, w, h)
    #             cv2.circle(img, tuple(px1), 1, (0, 0, 255), -1)
    #             cv2.circle(img, tuple(px2), 1, (0, 0, 255), -1)
    #             cv2.line(img, tuple(px1), tuple(px2), (0, 0, 255), 1)
                
    #             px1 = (matrix @ np.array([px1[0], px1[1], 1])).astype(np.int)
    #             px2 = (matrix @ np.array([px2[0], px2[1], 1])).astype(np.int)
    #             cv2.circle(img, tuple(px1), 1, (0, 0, 255), -1)
    #             cv2.circle(img, tuple(px2), 1, (0, 0, 255), -1)
    #             cv2.line(img, tuple(px1), tuple(px2), (0, 0, 255), 1)
    #         except Exception as e:
    #             print(e)

    for pt in landmarks.landmark:
        try:
            pt = _normalized_to_pixel_coordinates(pt.x, pt.y, w, h)
            cv2.circle(img, tuple(pt), 1, (0, 0, 255), -1)
            pt = (matrix @ np.array([pt[0], pt[1], 1])).astype(np.int)
            cv2.circle(img, tuple(pt), 1, (0, 0, 255), -1)
        except Exception as e:
            print(e)


    # for idx, landmark in enumerate(landmarks.landmark):
    #     if landmark.visibility < 0 or landmark.presence < 0:
    #         continue
    #     landmark_px = _normalized_to_pixel_coordinates(landmark.x, landmark.y, w, h)
    #     cv2.circle(img, landmark_px, 1, (0, 0, 255), -1)
    return img



# facemesh_online()

def findKeypoints():
    point_list = []
    for part in FACE_CONNECTIONS[1:-1]:
        for pair in part:
            # print(pair)
            p1, p2 = pair
            if p1 not in point_list:
                point_list.append(p1)
            if p2 not in point_list:
                point_list.append(p2)
    print(point_list)

# findKeypoints()

# inputs, labels = facemesh_local_data_gen('dataset_dyh')
# classify(inputs, labels, os.path.join('dataset_dyh', 'model.joblib'))
# facemesh_online_testing(os.path.join('dataset_rw', 'model.joblib'))

# facemesh_online_exp(True, 'dataset_rw')
facemesh_online_testing()
