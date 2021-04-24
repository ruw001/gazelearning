import multiprocessing

bind = '0.0.0.0:8000'
# workers = multiprocessing.cpu_count() * 3 + 1
workers = 2
print('{} workers start!'.format(workers))
# See http://docs.gunicorn.org/en/stable/settings.html#worker-class
worker_class = 'gevent'
# worker_tmp_dir = '/dev/shm'  # See https://github.com/benoitc/gunicorn/pull/1873/files
