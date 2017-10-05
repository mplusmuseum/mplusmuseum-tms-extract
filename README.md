# mplusmuseum-tms-extract

Tools for extracting data from TMS

[bin/process-artworks-xml.py](bin/process-artworks-xml.py) extracts the data in the TMS-XML file and saves or updates the data in elasticsearch

[src/tmsxml2json.js](src/tmsxml2json.js)

    tmsxml2json

    takes a TMS-XML file and converts it to json via stdin/stdout

    usage:

      yarn start < ../data/ExportForDAM_Objects_UCS.xml
