# mplusmuseum-tms-extract

Tools for extracting data from TMS

## Getting Started

Copy `config/default.json.example` to `config/default.json`. You don't need to edit anything, but you can.

Run `npm install -g` to install the `mplus` package globally.

Copy [`config/default.json.example`](/config/default.json.example) to a new file `config/default.json`. Adjust config variables as needed.

## Usage

Run `mplus` to read the help.

Run `mplus harvest -h` or `mplus index -h` to read command-specific help.

### mplus index

To create a new index, without ingesting any of the data:
```
$ mplus index --create <index_name>
```

Right now, it's important to create an index with the name that you set in your config file under `elasticsearch.index`. (We should set this up better.)

To delete an index:
```
$ mplus index --drop <index_name>
```

Check to see whether the index has been created or deleted successfully with this query against your ES instance:
```
http://localhost:9200/_cat/indices?v
```

## Outdated Below!

[bin/process-artworks-xml.py](bin/process-artworks-xml.py) extracts the data in the TMS-XML file and saves or updates the data in elasticsearch


## alchemia

alchemia is a tool to work with tms-xml files, which lives in the [src/](src/) directory

    cd src


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

    $ yarn start injest < objects.json
