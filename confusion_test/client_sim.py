import requests
import cv2 
import os
import time
import base64
import json
from threading import Thread

# '127.0.0.1' #'172.20.16.10' # '137.110.115.9'
# '34.68.142.133'  # '34.94.7.7'  # 'https://gazelearning-apis.wl.r.appspot.com'
host = '34.69.132.236'
PORT = 8000
N_SERVER = 1
TOTAL = 200

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
    port = PORT + pID % N_SERVER
    # url = 'http://{}:{}'.format(host, port)
    url = 'http://{}:{}/detection'.format(host, port)
    # url = 'https://mlserver-302123.uc.r.appspot.com/detection'
    pID = 'user_' + str(pID).zfill(2)
    stage = 0  # 0: collect data; 1: inference,
    idx = 0 # 0: collect c, 1: collect nc
    label_idx = [1, 0]  # 1: cofused label, 0: neutral label
    count = 0
    total = TOTAL // 2
    count_request = 0
    latency = [0,0]
    while True:
        if idx < 2 and stage < 1:
            # img = getImage(count, labels[idx])
            data = {'img': IMG, 'stage': stage, 'label': label_idx[idx],
                    'username': pID, 'frameId': total-count}  
            # print(data)
            start = time.time()
            res = requests.post(url, data=json.dumps(data))
            latency[stage] += time.time() - start
            print(res.content)
            count += 1
            if count == total:
                idx += 1
                count = 0
            # time.sleep(0)
        else:
            stage = 1
            idx = 1
            # img = getImage(count, labels[idx])
            start = time.time()
            data = {'img': IMG, 'stage': stage, 'label': label_idx[idx],
                    'username': pID, 'frameId': -1}
            res = requests.post(url, data=json.dumps(data))
            latency[stage] += time.time() - start
            print(res.content)
            time.sleep(1)
        print('pID:{}, count: {}, stage: {}'.format(pID, count_request, stage))
        count_request += 1
        if count_request == total * 2 + 25:
            break
    res = 'pID: {}, Stage0 Latency:{}, Stage1 Latency:{}'\
            .format(pID, 
            latency[0] / (2 * total),
            latency[1] / (count_request - 2 * total))
    with open('res.txt', 'a') as outfile:
        outfile.write(res + '\n')

threaded = True
num_threads = 5
if threaded:
    request_threads = []
    for i in range(num_threads):
        request_threads.append(Thread(target=sendRequest, args=(i, )))

    for i in range(num_threads):
        request_threads[i].start()
        time.sleep(1.5)
else:
    sendRequest(0)
# test = getImage(0, labels[0])
# print(test)
