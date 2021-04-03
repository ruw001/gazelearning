import requests
import cv2 
import os
import time
import base64
import json
from threading import Thread

import random
import asyncio
import aiohttp

host = 'cogteach.com/detection' # '172.20.16.10' # '137.110.115.9'
# host = '127.0.0.1:8000/detection'
protocol = 'https' if 'com' in host else 'http'
PORT = 8000
N_SERVER = 10

img_folder = 'dataset_rw/not_confused/'  # 'dataset_rw/'

labels = [0, 1] # ['not_confused', 'confused']

def getImage(count, label):
    filename = '{}.jpg'.format(count)
    filename = os.path.join(img_folder, filename)
    with open(filename, "rb") as img_file:
        imgb64 = base64.b64encode(img_file.read())
    return "test," + imgb64.decode('utf-8')

IMG = getImage(190, labels[1])

def sendRequest(pID):
    port = PORT + pID % N_SERVER
    url = 'https://{}'.format(host)
    pID = 'user_' + str(pID).zfill(2)
    stage = 0  # 0: collect data; 1: inference,
    idx = 0 # 0: nc, 1: c
    count = 0
    total = 1000
    count_request = 0
    latency = [0,0]
    while True:
        if idx < 2 and stage < 1:
            # img = getImage(count, labels[idx])
            data = {'img': IMG, 'stage': stage, 'label': idx, 'username': pID, 'frameId': count}
            # print(data)
            start = time.time()
            res = requests.post(url, data=json.dumps(data))
            latency[stage] += time.time() - start
            # print(res)
            count += 1
            if count == total:
                idx += 1
                count = 0
            # time.sleep(0.001)
        else:
            stage = 1
            idx = 1
            # img = getImage(count, labels[idx])
            data = {'img': IMG, 'stage': stage, 'label': idx, 'username': pID, 'frameId': count}
            start = time.time()
            res = requests.post(url, data=json.dumps(data))
            latency[stage] += time.time() - start
            # print(res)
            time.sleep(1)
        print('pID:{}, count: {}, stage: {}'.format(pID, count_request, stage))
        count_request += 1
        if count_request == total * 2 + 25:
            break
    res = 'pID: {}, Total latency: {}, Stage0 Latency: {}, Stage1 Latency: {}'\
            .format(pID,
            (latency[0] + latency[1])/count_request, 
            latency[0] / (2 * total),
            latency[1] / (count_request - 2 * total))
    with open('res.txt', 'a') as outfile:
        outfile.write(res + '\n')

async def postAsync(url, session, total, config):
    count = 1
    start = time.time()
    while count <= total: # count = 1 ... total, inclusive
        data = {'img': IMG,
            'frameId': count
        }
        data.update(config)
        async with session.post(url, data=json.dumps(data)) as resp:
            resp = await resp.json()
            frameId = resp['body']['frameId']
            if frameId == 1:
                res_first = time.time()
            
            if frameId == total:
                res_last = time.time()

            print('{} response {} @ {}'.format(config['username'], frameId, time.time()-start))
        count += 1
    end = time.time()

    return start, end, res_first, res_last

async def sendRequestAsync(pID):
    print('sendRequestAsync {}'.format(pID))

    url = '{}://{}'.format(protocol, host)
    pID = 'user_' + str(pID).zfill(2)
    total = 1000
    latency = [0,0]

    async with aiohttp.ClientSession() as session:
        # Collecting nc faces
        print('Non-confusion phase.')
        config = {
            'stage': 0,
            'label': 0,
            'username': pID 
        }
        phase1_start, phase1_end, phase1_res_first, phase1_res_last = await postAsync(url, session, total, config)

        # Mimic interval between colllections
        t_sleep = random.randint(0, 10)
        print('{} is sleeping for {} seconds.'.format(pID, t_sleep))
        time.sleep(t_sleep)

        # Collecting c faces
        print('Confusion phase.')
        config = {
            'stage': 0,
            'label': 1,
            'username': pID 
        }
        phase2_start, phase2_end, phase2_res_first, phase2_res_last = await postAsync(url, session, total, config)

    res = 'pID: {},\n'.format(pID) + \
        'NC PHASE: phase1_start: {}, phase1_end: {}, diff:{}, res_first:{}, res_last: {}, diff {}\n'.format(
            phase1_start, phase1_end, phase1_end - phase1_start,
            phase1_res_first, phase1_res_last, phase1_res_last - phase1_res_first,
        ) + \
        'C PHASE: phase2_start: {}, phase2_end: {}, diff:{}, res_first:{}, res_last: {}, diff {}\n'.format(
            phase2_start, phase2_end, phase2_end - phase2_start,
            phase2_res_first, phase2_res_last, phase2_res_last - phase2_res_first,
        )

    with open('res.txt', 'a') as outfile:
        outfile.write(res + '\n')

if __name__ == '__main__':
    asynchronization = True
    threaded = True

    n_client = 10

    print('{} clients are under testing...'.format(n_client))
    with open('res.txt', 'a') as outfile:
        outfile.write(str(n_client) + '\n')

    if threaded:
        request_threads = []
        for i in range(n_client):
            request_threads.append(
                Thread(
                    target=sendRequest if not asynchronization else asyncio.run
                    , args=(i, ) if not asynchronization else [sendRequestAsync(i)]
            ))

        for i in range(n_client):
            request_threads[i].start()
            time.sleep(1.5)
    else:
        sendRequest('user_00')
# test = getImage(0, labels[0])
# print(test)
