## alchemia

alchemia is a tool to work with tms-xml files

### tldr

    $ cp config.json.example config.json
    $ yarn
    $ yarn run --silent start convert < ExportForDAM_Objects_UCS.xml > objects.json
    $ yarn run start ingest < objects.json

### design

We expect one collection type per XML file, and will create a new index for each collection type.
For example
```xml
  <exportForDAM><objects><object id=123>blah</object><object id=876>bloo</object></objects></exportForDAM>`
```

Will create an elasticsearch index named `objects`, with type `object`.

### Convert tms-xml to json

To convert a tms-xml to json, try

    $ yarn run --silent start convert < ../data/ExportForDAM_Objects_UCS.xml > objects.json

*Note*: the `--silent` is important, because yarn outputs a bit too much info normally

### Ingest json to elasticsearch

Lets say you are happy with the output, maybe ingest it to an elasticsearch instance.
The index will be deleted and recreated, and is named the same as whatever collection is in `<exportForDAM>`.

    $ yarn run start ingest < objects.json

### full help

Using `yarn start` or `yarn start --help` will show the help

    $ yarn start

    Usage: alchemia [options] [command]

    Tools for working with tms-xml and elastic search


    Options:

      -V, --version        output the version number
      -i, --input <path>   file to work with
      -o, --output <path>  file to write to instead of stdout
      -h, --help           output usage information


    Commands:

      convert   Convert TMS-XML to json
      ingest    Ingest json to elasticsearch

