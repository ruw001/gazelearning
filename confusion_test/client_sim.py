import requests
import cv2 
import os
import time
import base64
import json
from threading import Thread

url = 'http://172.20.3.61:8000'

img_folder = 'dataset_rw/'

labels = ['not_confused', 'confused']

def getImage(count, label):
    filename = str(count).zfill(3) + '.jpg'
    filename = os.path.join(img_folder, label, filename)
    with open(filename, "rb") as img_file:
        imgb64 = base64.b64encode(img_file.read())
    return "test," + imgb64.decode('utf-8')

IMG = getImage(0, labels[0])

def sendRequest(pID):
    stage = 0  # 0: collect data; 1: inference,
    idx = 0 # 0: nc, 1: c
    count = 0
    total = 1000
    count_request = 0
    latency = [0,0]
    while True:
        if idx < 2 and stage < 1:
            # img = getImage(count, labels[idx])
            data = {'img': IMG, 'stage': stage, 'label': idx, 'username': pID}
            # print(data)
            start = time.time()
            res = requests.post(url, data=json.dumps(data))
            latency[stage] += time.time() - start
            # print(res)
            count += 1
            if count == total:
                idx += 1
                count = 0
            time.sleep(0.03)
        else:
            stage = 1
            idx = 1
            # img = getImage(count, labels[idx])
            data = {'img': IMG, 'stage': stage, 'label': idx, 'username': pID}
            start = time.time()
            res = requests.post(url, data=data)
            latency[stage] += time.time() - start
            # print(res)
            time.sleep(1)
        count_request += 1
        if count_request == total * 2 + 100:
            break
    print('pID: {}, Total latency: {}, Stage0 Latency: {}, Stage1 Latency: {}'
        .format((pID,
                 latency[0] + latency[1])/count_request, 
                 latency[0] / (2 * total),
                 latency[1] / (count_request - 2 * total)))

request_threads = []
for i in range(30):
    request_threads.append(Thread(target=sendRequest, args=('user_' + str(i).zfill(2), )))

for i in range(30):
    request_threads[i].start()

# test = getImage(0, labels[0])
# print(test)
