import sys
import simplejson as json
from elasticsearch import Elasticsearch
import ArtisinalInts
import certifi
import math
import time

es = Elasticsearch()

def extract_places():

    ## get stats
    query = {
        "query": {
            "match_all" : {}
        },
        "size": 0,
    }

    res = es.search(index="mplusmuseum", doc_type='authors', body=query)

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

        res = es.search(index="mplusmuseum", doc_type='authors', body=query)

        for author in res['hits']['hits']:
            try:
                for place in author['_source']['places']:

                    ## look up by english name in ES
                    place_query = {
                        "query": {
                            "term" : {
                                "placename.en.keyword": str(place['placename']['en'])
                            }
                        },
                    }

                    # need to pause here and let ES catch up...
                    time.sleep(2)
                    rsp = es.search(index="mplusmuseum", doc_type='places', body=place_query)

                    if (len(rsp['hits']['hits']) == 0):
                        # if the record doesn't exist in the index
                        # assign a Brooklyn Int and add it!
                        new_place = {}
                        bk_int = ArtisinalInts.get_brooklyn_integer()
                        new_place['id'] = bk_int[0]
                        new_place.update(place)
                        del new_place['type']

                        contents = json.dumps(new_place, indent=4, ensure_ascii=False, encoding='utf-8')
                        update = es.index(index="mplusmuseum", doc_type='places', id=new_place['id'], body=contents)
                        print(update)

            except KeyError:
                continue

        rec_start = rec_start + 1000




if __name__ == "__main__":
    extract_places()
