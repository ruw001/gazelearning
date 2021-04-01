import numpy as np

filepath = 'res_5.txt'

stage0 = []
stage1 = []

with open(filepath, 'r') as infile:
    lines = infile.readlines()
    for l in lines: 
        if l[-1] == '\n':
            l = l[:-1]
        _, s0, s1 = l.split(', ')
        s0 = float(s0.split(':')[1])
        s1 = float(s1.split(':')[1])
        stage0.append(s0)
        stage1.append(s1)

stage0 = np.array(stage0)
stage1 = np.array(stage1)

print('stage 0 avg: {}'.format(stage0.sum()/len(stage0)))
print('stage 1 avg: {}'.format(stage1.sum()/len(stage1)))
