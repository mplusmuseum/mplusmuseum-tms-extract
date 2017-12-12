## alchemia

alchemia is a tool to work with tms-xml files

### tldr

    $ cp config.json.example config.json
    $ yarn
    $ yarn run --silent convert < ExportForDAM_Objects_UCS.xml > objects.json
    $ yarn run start ingest < objects.json

### elasticsearch

macOS only allows 256 open files at once, lets give elasticsearch more:

    $ launchctl limit maxfiles 64000 524288
    $ ES_JAVA_OPTS="-XX:-MaxFDLimit" elasticsearch

### help

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

To use a command, just `yarn start [command]`.

### Convert tms-xml to json

To convert a tms-xml to json, try

    $ yarn start --silent convert < ../data/ExportForDAM_Objects_UCS.xml > objects.json

*Note*: the `--silent` is important, because yarn outputs a bit too much info normally

### Ingest json to elasticsearch

Lets say you are happy with the output, maybe ingest it to an elasticsearch instance

    $ yarn start ingest < objects.json
