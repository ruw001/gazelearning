from sklearn.datasets import make_circles
from sklearn.neighbors import kneighbors_graph
from sklearn.cluster import KMeans
import numpy as np
import matplotlib.pyplot as plt

# create the data
xmax = 1464
ymax = 794

fixationX = np.array([518.4234619140625, 436.26055908203125, 466.8464050292969, 903.5812377929688, 866.2353515625, 853.828125, 528.1929931640625, 503.2596740722656, 490.3062438964844, 518.14599609375, 937.1088256835938, 861.9296875, 890.0296020507812])
fixationY = np.array([169.35000610351562, 203.0835723876953, 379.60076904296875, 416.49530029296875, 407.3660583496094, 421.0703125, 226.91876220703125, 199.94984436035156, 408.87030029296875, 380.51593017578125, 465.3681945800781, 473.015625, 410.29998779296875])

# fixationX = np.array([349.4298095703125, 391.0443115234375, 283.0989074707031, 616.1245727539062, 948.4091796875, 943.8383178710938, 273.862060546875, 250.80673217773438, 324.3155212402344])
# fixationY = np.array([349.4298095703125, 476.7080078125, 365.1620178222656, 283.1778259277344, 344.8095703125, 335.6615295410156, 32.23957061767578, 166.75479125976562, 147.6881103515625])

fixations = np.hstack([fixationX.reshape(-1,1)/xmax, fixationY.reshape(-1,1)/ymax])

# use the np.exp(nearest neighbor graph as our adjacency matrix
dist = np.sqrt(np.power(fixationX.reshape(-1,1) - fixationX.reshape(1,-1), 2) + np.power(fixationY.reshape(-1,1) - fixationY.reshape(1,-1), 2))

sigmaList = [5,5,5,5,5,5,5,5,5]

plt.figure(figsize=(14,5))
for index, sigma in enumerate(sigmaList):

    A = np.exp(-dist/(2*sigma**2))
    # A = kneighbors_graph(fixations, n_neighbors=5).toarray()

    # create the graph laplacian
    A = A/np.max(A) - np.eye(A.shape[0])
    D = np.diag(A.sum(axis=1)-1)
    L = D-A

    # find the eigenvalues and eigenvectors
    vals, vecs = np.linalg.eig(L)

    # sort
    vecs = vecs[:,np.argsort(vals)]
    vals = vals[np.argsort(vals)]

    # plt.subplot(3,3,index+1)
    # plt.stem(range(1, len(vals)+1), vals, bottom=np.amin(vals))
    # plt.xlim([0-0.5,len(vals)+0.5])

    # plt.subplot(3,3,3+index+1)
    # plt.stem(range(1, len(vals)), np.diff(vals), bottom=np.amin(np.diff(vals)))
    # plt.xlim([0-0.5,len(vals)+0.5])

    # use Fiedler value to find best cut to separate data
    k = np.argmax(np.diff(vals[:vals.shape[0]//2])) + 1 # No more than half the points count classes
    plt.stem([k], [np.diff(vals)[k-1]], linefmt='red', markerfmt='red')
    clusters = KMeans(n_clusters=k).fit(np.real(vecs[:,0:3])).labels_

    print(clusters)

    # plt.subplot(3,3,6+index+1)
    # for i in range(k):
    #     plt.scatter(fixations[clusters==i, 0]*xmax, 794-fixations[clusters==i, 1]*ymax, c=np.random.rand(1,3) )
    # plt.xlim([0,1464])
    # plt.ylim([0,794])
    # plt.xlabel('X, k = {}'.format(k))
    # plt.ylabel('Y')

# plt.show()