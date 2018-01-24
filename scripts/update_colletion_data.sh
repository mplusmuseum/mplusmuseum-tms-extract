#!/bin/bash

export XML_IMPORT=/usr/local/mplusmuseum/data/ExportForMPlus_Objects_UCS.xml
export JSON_EXPORT=/usr/local/mplusmuseum/data/ExportForMPlus_Objects_UCS.xml

yarn run --silent start convert < $XML_IMPORT > $JSON_EXPORT &&
yarn run start ingest < $JSON_EXPORT

unset XML_IMPORT
unset JSON_EXPORT
