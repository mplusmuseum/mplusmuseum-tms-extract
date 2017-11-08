# mplusmuseum-tms-extract

Tools for extracting data from TMS

## Getting Started

Copy `config/default.json.example` to `config/default.json`. For now, you don't need to edit anything.

Run `npm install -g` to install the `mplus` package globally.

## Usage

Run `mplus` to read the help.

### `mplus harvest`

### `mplus index`

##### Outdated Below!

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
