
import sys
import simplejson as json
from bs4 import BeautifulSoup

def parseArtworks(file):

    infile = open(file, "rb")
    contents = infile.read()
    soup = BeautifulSoup(contents,'xml')

    objects = soup.find_all('object')
    print(len(objects))

    for obj in objects:

        artwork = {}

        try:
            artwork['id'] = obj['id']
        except AttributeError:
            print("Object doesn't have an ID")

        try:
            artwork['objectnumber'] = obj.objectnumber.text
        except AttributeError:
            print("Object doesn't have an objectnumber")

        try:
            artwork['dated'] = obj.dated.text
        except AttributeError:
            print("Object doesn't have a dated field")

        try:
            artwork['datebegin'] = obj.datebegin.text
        except AttributeError:
            print("Object doesn't have a beginning date")

        try:
            artwork['dateend'] = obj.dateend.text
        except AttributeError:
            print("Object doesn't have a end date")

        # objectstatus with nested languages...
        try:
            status = obj.objectstatus.find_all('objectstatus')
            artwork['objectstatus'] = {}

            for s in status:
                artwork['objectstatus'][s['lang']] = s.text
        except AttributeError:
            print("Object doesn't have an objectstatus")

        # titles with nested languages...
        try:
            title = obj.titles.find_all('title')
            artwork['title'] = {}

            for t in title:
                artwork['title'][t['lang']] = t.text
        except AttributeError:
            print("Object doesn't have a title")

        # creditlines with nested languages...
        try:
            creditline = obj.creditlines.find_all('creditline')
            artwork['creditline'] = {}

            for c in creditline:
                artwork['creditline'][c['lang']] = c.text
        except AttributeError:
            print("Object doesn't have a creditline")

        # medium with nested languages...
        try:
            medium = obj.mediums.find_all('medium')
            artwork['medium'] = {}

            for m in medium:
                artwork['medium'][m['lang']] = m.text
        except AttributeError:
            print("Object doesn't have a medium")

        # dimensions with nested languages...
        try:
            dimensions = obj.dimensions.find_all('dimensions')
            artwork['dimensions'] = {}

            for d in dimensions:
                artwork['dimensions'][d['lang']] = d.text
        except AttributeError:
            print("Object doesn't have dimensions")

        # categories
        categories = obj.areacategories.find_all('areacategory')
        artwork['categories'] = []

        for c in categories:
            category = c.find_all('areacat')
            cat = {"rank":c['rank'],"type":c['type']}
            cat['name'] = []

            for a in category:
                cat['name'].append({a['lang']:a.text})

            artwork['categories'].append(cat)

        #write the json object to disk
        filename = artwork['id'] + '.json'
        f = open(filename, 'w')
        f.write(json.dumps(artwork, indent=4, ensure_ascii=False, encoding='utf-8'))
        f.close

        print(json.dumps(artwork, indent=4, ensure_ascii=False, encoding='utf-8'))

if __name__ == "__main__":
    parseArtworks(sys.argv[1])
