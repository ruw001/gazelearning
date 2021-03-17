import json
import numpy as np
import os
import math
from joblib import dump, load
import time
import argparse
import flask
from flask import Flask, redirect, render_template, request
from threading import Thread
import logging
from sklearn.datasets import make_circles
from sklearn.neighbors import kneighbors_graph
from sklearn.cluster import KMeans

app = Flask(__name__)


@app.route('/', methods=['GET'])
def index():
    """ The home page has a list of prior translations and a form to
        ask for a new translation.
    """

    return "<h1>GazeLearning Server: There's nothing you can find here!< /h1 >"


def spectral_clustering(fx, fy):
    dist = np.sqrt(np.power(fx.reshape(-1, 1) - fx.reshape(1, -1),
                            2) + np.power(fy.reshape(-1, 1) - fy.reshape(1, -1), 2))
    sigma = 0.75
    A = np.exp(-dist/(2*sigma**2))
    D_inv = np.diag(1/A.sum(axis=1))
    L = np.eye(A.shape[0]) - np.matmul(D_inv, A)  # L is laplacian

    # find the eigenvalues and eigenvectors
    vals, vecs = np.linalg.eig(L)

    # sort
    vecs = vecs[:, np.argsort(vals)]
    vals = vals[np.argsort(vals)]

    # use Fiedler value to find best cut to separate data
    # No more than half the points count classes
    k = np.argmax(np.diff(vals[:vals.shape[0]//2])) + 1

    clusters = KMeans(n_clusters=k).fit(np.real(vecs[:, 0:3])).labels_

    print(clusters)

    return list(clusters)

@app.route('/clustering', methods=['POST'])
def clustering_response():
    data = request.data  # .decode('utf-8')
    data = json.loads(data)
    print(data)
    # print(data)
    fx = np.array(data['x'])
    fy = np.array(data['y'])

    clusters = spectral_clustering(fx, fy)
    
    resp = flask.Response()
    resp.set_data(json.dumps({'body': {'result': clusters}}))
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "x-api-key,Content-Type"
    resp.headers['Content-Type'] = 'application/json'
    return resp


if __name__ == '__main__':
    # parser = argparse.ArgumentParser()
    # parser.add_argument("-p", "--portid", type=int, default=0,
    #                     help="port id")
    # args = parser.parse_args()

    # PORT = 8000 + args.portid
    PORT = 8000
    # This is used when running locally only. When deploying to Google App
    # Engine, a webserver process such as Gunicorn will serve the app. This
    # can be configured by adding an `entrypoint` to app.yaml.
    # Flask's development server will automatically serve static files in
    # the "static" directory. See:
    # http://flask.pocoo.org/docs/1.0/quickstart/#static-files. Once deployed,
    # App Engine itself will serve those files as configured in app.yaml.
    app.run(host='0.0.0.0', port=PORT, debug=True, threaded=True)
