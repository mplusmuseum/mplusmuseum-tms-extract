
import sys
import simplejson as json
from bs4 import BeautifulSoup
from elasticsearch import Elasticsearch
import ArtisinalInts
import certifi

es = Elasticsearch()

def formatAuthor(auth):

    author = {}

    author['tms_id'] = auth['id']

    try:
        author['birthyear_yearformed'] = auth.birthyear_yearformed.text
    except AttributeError:
        print("Object doesn't have a birthyear_yearformed")

    try:
        author['deathyear'] = auth.deathyear.text
    except AttributeError:
        print("Object doesn't have a deathyear")

    try:
        author['type'] = auth.type.text
    except AttributeError:
        print("Object doesn't have a type")

    # names...
    names = auth.find_all('name')

    author['names'] = []

    for n in names:
        name = {}
        # name['id'] = n['id'] - this is confusing...
        name['lang'] = n['lang']
        name['firstname'] = n.firstname.text
        name['lastname'] = n.lastname.text
        name['institution'] = n.institution.text
        name['alphasort'] = n.alphasort.text
        name['displayname'] = n.displayname.text

        author['names'].append(name)

    # places...
    places = auth.find_all('place')

    author['places'] = []

    for p in places:
        place = {}
        place['type'] = p['type']

        placenames = p.find_all('placename')

        place['placename'] = {}

        for placename in placenames:
            place['placename'][placename['lang']] = placename.text

        placenamesearch = p.find_all('placenamesearch')
        place['placenamesearch'] = {}

        for placename in placenamesearch:
            place['placenamesearch'][placename['lang']] = placename.text

        nation = p.find_all('nation')
        place['nation'] = {}

        for nat in nation:
            place['nation'][nat['lang']] = nat.text

        continent = p.find_all('continent')
        place['continent'] = {}

        for cont in continent:
            place['continent'][cont['lang']] = cont.text


        author['places'].append(place)

    # bios...
    bios = auth.find_all('bio')

    author['bios'] = []

    for b in bios:
        bio = {}
        bio['lang'] = b['lang']
        bio['text'] = b.text

        author['bios'].append(bio)

    return author


def parseAuthors(file):

    infile = open(file, "rb")
    contents = infile.read()
    soup = BeautifulSoup(contents,'xml')

    authors = soup.find_all('author')
    print(len(authors))

    for a in authors:

        # look up object in ES by tms_id
        query = {
	       "query": {
		         "query_string": {
                    "query": a['id'],
                    "fields": ["tms_id"]
                  }
	        }
        }

        res = es.search(index="mplusmuseum", doc_type='authors', body=query)

        author = {}

        if res['hits']['total'] == 0:
            print("no record, create one")
            rsp = ArtisinalInts.get_brooklyn_integer()
            author['id'] = rsp[0]
            author.update(formatAuthor(a))
            contents = json.dumps(author, indent=4, ensure_ascii=False, encoding='utf-8')
            update = es.index(index="mplusmuseum", doc_type='authors', id=author['id'], body=contents)
        else:
            print("found a record, updating")
            author['id'] = res['hits']['hits'][0]['_id']
            author.update(formatAuthor(a))
            contents = json.dumps(author, indent=4, ensure_ascii=False, encoding='utf-8')
            update = es.index(index="mplusmuseum", doc_type='authors', id=author['id'], body=contents)

        print(update)




if __name__ == "__main__":
    parseAuthors(sys.argv[1])
