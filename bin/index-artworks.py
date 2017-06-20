import simplejson as json
from elasticsearch import Elasticsearch
import glob
import os

es = Elasticsearch() # defaults to localhost:9200

# load docs from json files

files = glob.glob("../data/artworks/*.json")

for f in files:
    basename = os.path.basename(f)
    basename = os.path.splitext(basename)[0]

    print("Indexing: " +basename)

    infile = open(f, "r")
    contents = infile.read()


    res = es.index(index="mplusmuseum", doc_type='artworks', id=basename, body=contents)

    print(res)
