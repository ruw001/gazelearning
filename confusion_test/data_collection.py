import numpy as np
import cv2
import time
import os

img_folder = 'confused'


cap = cv2.VideoCapture(0)
if not cap.isOpened():
    cap.open(0)

if not os.path.exists(img_folder):
    os.mkdir(img_folder)

count = 0
total = 500

while count < total:
    ret, img = cap.read()
    if img is None:
        print('Empty frame')
        time.sleep(0.5)
        continue
    cv2.imshow('img', img)
    # cv2.waitKey(0)
    cv2.imwrite(os.path.join(img_folder, str(count).zfill(3) + '.jpg'), img)
    k = cv2.waitKey(30) & 0xff
    if k == 27:
        break
    count += 1
    print(count)
    time.sleep(0.1)
cap.release()
cv2.destroyAllWindows()
