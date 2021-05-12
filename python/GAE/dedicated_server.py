import json
import numpy as np
import os
import math
from joblib import dump, load
import time
import argparse
import flask
from flask import Flask, redirect, render_template, request
import threading
from threading import Thread
import logging
from logging.config import dictConfig
from sklearn.datasets import make_circles
from sklearn.neighbors import kneighbors_graph
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import datetime
import time
from timeloop import Timeloop
from datetime import timedelta

STUDENT = 1
TEACHER = 2
FILEPATH = '/mnt/fileserver'
# FILEPATH = '/mnt/d/mnt/fileserver'

def getFilename():
    count = 0
    today = datetime.date.today()
    logpath = os.path.join(FILEPATH, 'logs', str(today))
    if not os.path.exists(logpath):
        os.makedirs(logpath)
    else :
        for filename in os.listdir(logpath):
            if ('py' in filename and 'd' in filename):
                count += 1
    return os.path.join(logpath, 'dedicated-py-{}.log'.format(count))

class InternalFilter():
    def filter(self, record):
        if 'dedicated' in record.module:
            record.module = 'Dedicated'
        return 0 if 'internal' in record.module else 1

dictConfig({
    'version': 1,
    'formatters': {'default': {
        'format': '[%(asctime)s] [%(module)s] [%(levelname)s] %(message)s',
        'datefmt': '%Y-%m-%d %H:%M:%S'
    }},
    'filters': {'no-internal': {
        '()': InternalFilter # Specify filter class with key '()'
    }},
    'handlers': {'wsgi': {
        'class': 'logging.StreamHandler',
        'stream': 'ext://flask.logging.wsgi_errors_stream',
        'formatter': 'default',
        'filters': ['no-internal']
    },'file' : {
        'class': 'logging.FileHandler',
        'filename': getFilename(),
        'formatter': 'default',
        'filters': ['no-internal']
    }},
    'root': {
        'level': 'INFO',
        'handlers': ['wsgi', 'file']
    }
})

all_fixations = {}
all_saccades = {}
all_cognitive = {}
last_seen = {}
tl = Timeloop()

app = Flask(__name__)

@app.route('/', methods=['GET'])
def index():
    """ The home page has a list of prior translations and a form to
        ask for a new translation.
    """
    return '<h1> Dedicated server (python) is on. </h1>'


@app.route('/gazeData/teacher', methods=['GET'])
def teacher_get():
    return '<h1>Dedicated server, page /gazeData/teacher</h1>'


def spectral_clustering(fx, fy):
    if fx.shape[0] == 0:
        return []

    dist = np.sqrt(np.power(fx.reshape(-1, 1) - fx.reshape(1, -1),
                            2) + np.power(fy.reshape(-1, 1) - fy.reshape(1, -1), 2))

    beta = 25
    A = np.exp(-beta * dist / dist.std())
    # A = kneighbors_graph(fixations, n_neighbors=5).toarray()
    D_inv = np.diag(1/A.sum(axis=1))
    L = np.eye(A.shape[0]) - np.matmul(D_inv, A)  # L is laplacian

    # find the eigenvalues and eigenvectors
    vals, vecs = np.linalg.eig(L)

    # sort
    vecs = vecs[:, np.argsort(vals)]
    vals = vals[np.argsort(vals)]

    # use Fiedler value to find best cut to separate data
    # No more than half the points count classes
    k = np.argmax(np.diff(vals[:vals.shape[0]//2+1])) + 1

    # app.logger.debug('max k', vals.shape[0]//2+1)
    app.logger.info('optimal K (Fiedler):', k)

    X = np.real(vecs[:, 0:3])

    best_k = 0
    best_cluster = []
    best_sil = -1

    max_k = X.shape[0]

    points = np.stack([fx, fy], axis=-1)

    app.logger.info('max k', max_k)
    for k in range(2, max_k):
        # labels = KMeans(n_clusters=k).fit(X).labels_
        labels = KMeans(n_clusters=k).fit(points).labels_
        sil = silhouette_score(points, labels)
        if sil >= best_sil:
            best_sil = sil
            best_k = k
            best_cluster = labels
        # app.logger.debug(k, sil, labels)

    app.logger.info('sil best:', best_k, best_sil, best_cluster)

    return [int(c) for c in best_cluster]

@app.route('/gazeData/teacher', methods=['POST'])
def teacher_post():
    data = request.data  # .decode('utf-8')
    body = json.loads(data)
    role = int(body['role'])
    app.logger.info('==============================')
    app.logger.info('Received POST from {}'.format(
        'student' if role == 1 else 'teacher'))

    try:
        if role == TEACHER:
            fixationX = []
            fixationY = []

            fixationFlat = []
            saccadeFlat = []
            cognitiveFlat = []

            for k,v in all_fixations.items():
                for fix in v:
                    fixationFlat.append(fix)
            
            for k,v in all_saccades.items():
                for sac in v:
                    saccadeFlat.append(sac)

            for k,v in all_cognitive.items():
                indexed_cog = {'stuNum': k}
                indexed_cog.update(v)
                cognitiveFlat.append(indexed_cog)
            app.logger.debug('cognitiveFlat : {}'.format(cognitiveFlat))

            fixationX = np.array([fix['x_per'] for fix in fixationFlat])
            fixationY = np.array([fix['y_per'] for fix in fixationFlat])

            app.logger.debug('Fixations to cluster: {}'.format(len(fixationX)))

            resp = flask.Response()
            resp.set_data(json.dumps(
                {
                    'fixations': fixationFlat,
                    'saccades': saccadeFlat,
                    'cognitives': cognitiveFlat,
                    'result': spectral_clustering(fixationX, fixationY)
                }
            ))
            resp.headers['Access-Control-Allow-Origin'] = '*'
            resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "x-api-key,Content-Type"
            resp.headers['Content-Type'] = 'application/json'
            return resp
        else:
            stuNum = int(body['role'])
            app.logger.info('Student number : {}'.format(stuNum))

            all_fixations[stuNum] = body['fixations']
            all_saccades[stuNum] = body['saccades']
            all_cognitive[stuNum] = body['cognitive']

            app.logger.info('Receive {} fixations at {}'.format(
                len(all_fixations), time.time()))

            resp = flask.Response()
            resp.set_data(json.dumps(
                {
                    'result': 'Fixations and saccades are logged @ {}'.format(time.time())
                }
            ))
            last_seen[stuNum] = time.time()
            resp.headers['Access-Control-Allow-Origin'] = '*'
            resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "x-api-key,Content-Type"
            resp.headers['Content-Type'] = 'application/json'
            return resp
    except Exception as e:
        app.logger.error(e)
        resp = flask.Response()
        resp.set_data(json.dumps(
            {
                'error': str(e)
            }
        ))
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "x-api-key,Content-Type"
        resp.headers['Content-Type'] = 'application/json'
        return resp


@tl.job(interval=timedelta(seconds=5))
def remove_obs_entries():
    # print('here!', time.time())
    for name, ts in last_seen.items():
        if time.time() - ts > 5:
            del all_fixations[name]
            del all_saccades[name]


if __name__ == '__main__':

    PORT = 9000
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    # Flask's development server will automatically serve static files in
    # the "static" directory. See:
    # http://flask.pocoo.org/docs/1.0/quickstart/#static-files. Once deployed,
    # App Engine itself will serve those files as configured in app.yaml.
    tl.start()
    try:
        app.run(host='0.0.0.0', port=PORT, debug=False, threaded=True)
    except KeyboardInterrupt:
        tl.stop()

