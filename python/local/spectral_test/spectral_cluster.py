from sklearn.datasets import make_circles
from sklearn.neighbors import kneighbors_graph
from sklearn.cluster import KMeans
import numpy as np
import matplotlib.pyplot as plt

# create the data
xmax = 1464 / 100
ymax = 794 / 100

# These are fixations, not raw gaze data.
# fixationX = np.array([518.4234619140625, 436.26055908203125, 466.8464050292969, 903.5812377929688, 866.2353515625, 853.828125, 528.1929931640625, 503.2596740722656, 490.3062438964844, 518.14599609375, 937.1088256835938, 861.9296875, 890.0296020507812])
# fixationY = np.array([169.35000610351562, 203.0835723876953, 379.60076904296875, 416.49530029296875, 407.3660583496094, 421.0703125, 226.91876220703125, 199.94984436035156, 408.87030029296875, 380.51593017578125, 465.3681945800781, 473.015625, 410.29998779296875])

fixationX = np.array([239.67999267578125, 86.60000610351562, 71.69999694824219, 92.89999389648438, 747.7999877929688, 941.022216796875,
                      998.7200317382812, 98.80000305175781, 130, 240.72500610351562, 476.0285949707031, 522.5999755859375, 499.1846618652344])
fixationY = np.array([157.6800079345703, 467.66668701171875, 496.79998779296875, 542.0999755859375, 493.20001220703125, 562.977783203125,
                      90.54666900634766, 51.342857360839844, 533.4000244140625, 495.8499755859375, 383.22857666015625, 342.79998779296875, 297.61541748046875])

# fixationX = np.array([349.4298095703125, 391.0443115234375, 283.0989074707031, 616.1245727539062, 948.4091796875, 943.8383178710938, 273.862060546875, 250.80673217773438, 324.3155212402344])
# fixationY = np.array([349.4298095703125, 476.7080078125, 365.1620178222656, 283.1778259277344, 344.8095703125, 335.6615295410156, 32.23957061767578, 166.75479125976562, 147.6881103515625])

fixations = np.hstack([fixationX.reshape(-1,1)/xmax, fixationY.reshape(-1,1)/ymax])

# use the np.exp(nearest neighbor graph as our adjacency matrix
dist = np.sqrt(np.power(fixationX.reshape(-1,1)/xmax - fixationX.reshape(1,-1)/xmax, 2) + np.power(fixationY.reshape(-1,1)/ymax - fixationY.reshape(1,-1)/ymax, 2))
print(dist)
sigmaList = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 2.5, 3, 3.5, 4] # 0.5, 1
# sigmaList = [5]
# sigmaList = [0.1, 0.2, .3, .4, .5]
betaList = [0, 0.1, 0.5, 1, 2.5, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 300]

def test_beta():
    # plt.figure(figsize=(5, 30))
    for index, beta in enumerate(betaList):
        print('==================={}=================='.format(beta))

        # create the graph laplacian
        # A is the weight/affinity matrix
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
        k = np.argmax(np.diff(vals[:vals.shape[0]//2])) + 1

        print(k)

        plt.stem([k], [np.diff(vals)[k-1]], linefmt='red', markerfmt='red')
        clusters = KMeans(n_clusters=k).fit(np.real(vecs[:, 0:3])).labels_

        print(clusters)

        plt.subplot(4, 4, index+1)
        for i in range(k):
            plt.scatter(fixations[clusters == i, 0]*xmax, 794 -
                        fixations[clusters == i, 1]*ymax, s=5)
        # plt.xlim([0, 1464])
        # plt.ylim([0, 794])
        plt.xlabel('X, k = {}, beta={}'.format(k, beta))
        plt.ylabel('Y')

    plt.tight_layout()
    plt.show()


def test_sigma():
    # plt.figure(figsize=(10, 30))
    for index, sigma in enumerate(sigmaList):
        print('==================={}=================='.format(sigma))

        # create the graph laplacian
        # A is the weight/affinity matrix
        A = np.exp(-dist/(2*sigma**2))
        # A = kneighbors_graph(fixations, n_neighbors=5).toarray()
        D_inv = np.diag(1/A.sum(axis=1))
        L = np.eye(A.shape[0]) - np.matmul(D_inv, A) # L is laplacian

        # find the eigenvalues and eigenvectors
        vals, vecs = np.linalg.eig(L)

        # sort
        vecs = vecs[:,np.argsort(vals)]
        vals = vals[np.argsort(vals)]

        # Some plotting...
        # plt.subplot(3,3,index+1)
        # plt.stem(range(1, len(vals)+1), vals, bottom=np.amin(vals))
        # plt.xlim([0-0.5,len(vals)+0.5])

        # plt.subplot(3,3,3+index+1)
        # plt.stem(range(1, len(vals)), np.diff(vals), bottom=np.amin(np.diff(vals)))
        # plt.xlim([0-0.5,len(vals)+0.5])

        # use Fiedler value to find best cut to separate data
        k = np.argmax(np.diff(vals[:vals.shape[0]//2])) + 1 # No more than half the points count classes

        print(k)

        plt.stem([k], [np.diff(vals)[k-1]], linefmt='red', markerfmt='red')
        clusters = KMeans(n_clusters=k).fit(np.real(vecs[:,0:3])).labels_

        print(clusters)

        plt.subplot(4,4,index+1)
        for i in range(k):
            plt.scatter(fixations[clusters == i, 0]*xmax,
                        794-fixations[clusters == i, 1]*ymax, s=5)
        # plt.xlim([0,1464])
        # plt.ylim([0,794])
        plt.xlabel('X, k = {}, sigma={}'.format(k, sigma))
        plt.ylabel('Y')
    plt.tight_layout()
    plt.show()


# test_beta()
# test_sigma()
