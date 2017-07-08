import sys
import simplejson as json
from elasticsearch import Elasticsearch
import ArtisinalInts
import certifi
import math
import time

es = Elasticsearch()

def extract_mediums():

    ## get stats
    query = {
        "query": {
            "match_all" : {}
        },
        "size": 0,
    }

    res = es.search(index="mplusmuseum", doc_type='artworks', body=query)

    rec_start = 0
    rec_total = res['hits']['total']
    pages = math.ceil(rec_total / 1000)

    for i in range(pages):

        query = {
            "query": {
                "match_all" : {}
            },
            "size": 1000,
            "from": rec_start
        }

        res = es.search(index="mplusmuseum", doc_type='artworks', body=query)

        # print the medium for each record
        for artwork in res['hits']['hits']:
            try:
                ## look up by english name in ES
                medium_query = {
                    "query": {
                        "term" : {
                            "en.keyword": str(artwork['_source']['medium']['en'])
                        }
                    },
                }

                time.sleep(2)
                rsp = es.search(index="mplusmuseum", doc_type='mediums', body=medium_query)

                if (len(rsp['hits']['hits']) == 0):
                    # if the record doesn't exist in the index
                    # assign a Brooklyn Int and add it!
                    medium = {}
                    bk_int = ArtisinalInts.get_brooklyn_integer()
                    medium['id'] = bk_int[0]
                    medium.update(artwork['_source']['medium'])

                    contents = json.dumps(medium, indent=4, ensure_ascii=False, encoding='utf-8')
                    update = es.index(index="mplusmuseum", doc_type='mediums', id=medium['id'], body=contents)
                    print(update)

            except KeyError:
                continue

        rec_start = rec_start + 1000




if __name__ == "__main__":
    extract_mediums()
