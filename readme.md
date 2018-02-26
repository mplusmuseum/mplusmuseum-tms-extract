## alchemia

alchemia is a tool to work with tms-xml files

### Installing

Pull the code down from git then...

    $ gem install compass
    $ yarn install
    $ yarn build

### Before you start; setting up your config file

    $ cp config.json.example config.json

Your config file will now look something like...

    {
      "elasticsearch": {
        "host": "localhost:9200"
      },
      "graphql": {
        "host": "localhost:3000"
      },
      "xml": [
        {
          "file": "[filename].xml",
          "index": "objects",
          "type": "object"
        },
        {
          "file": "[filename2].xml",
          "index": "artists",
          "type": "artist"
        }
      ],
      "onLambda": false,
    }

Point elasticsearch and graphql to your own locations. Then make sure your XML
files are placed in the correct directory. You should have XML files called things like `ExportFromTMS_Objects.xml` and `ExportFromTMS_Artists.xml`, these are the XML files that TMS exports to our XML specifications.

However you get your files they need to be placed into the following directory...

`app/data/xml`

# Note

The `index` and `type` are used by both ElasticSearch to build the indexes and by alchemia's own parsing code. In our current instance the type of `object` will look for XML to JSON parsing code kept in...

`src/cli/tmsxml2json/parsers/object`

...if we were to attempt to import `ExportFromTMS_Artists.xml` with a type of `artist` it would look for the code to parse the XML in...

`src/cli/tmsxml2json/parsers/artist`

...if that code doesn't exist then an error will be thrown.

### Running

Once you have the config set up you convert the XML to JSON and upsert to ElasticCloud in the same step...

    $ node app/cli/tmsxml2json/index.js

The first time you run the import it will convert the XML to JSON, create an index on ElasticSearch (ES), bulk upload the initial data to ES and then grab Artisanal Integers for each item in turn and updated ES. The initial bulk upload will take about 10-20 seconds, but the "backfill" of Integers will take about an hour.

After that, each time you get a new `ExportFromTMS_Objects.xml` file you need to place it into the `app/data/xml` folder and run the above command again.

These are optional parameters that can be passed into the script...

    $ node app/cli/tmsxml2json/index.js forcebulk
      Force the system to do a full bulk upload (useful in combination with skipingest)

    $ node app/cli/tmsxml2json/index.js skipbulk
      Skips a bulk upload.

    $ node app/cli/tmsxml2json/index.js resetindex
      Essentially blows the index away, and therefor all your stored data. *Note* an ID to Artisanal Integer map will still exists, this will not break your Integers.

    $ node app/cli/tmsxml2json/index.js forceingest
      Will make the system spit out .JSON files for each item into the `ingest` folder where
      they will individually be updated into ES.

    $ node app/cli/tmsxml2json/index.js skipingest
      Will make the system _not_ upload any individual .JSON files, even if the data has changed.

# Examples

To basically reset the database, this will clean out the index and do everything all over again. It _won't_ reset the Artisanal Integer, each item will keep its Integer.

    $ node app/cli/tmsxml2json/index.js resetindex forcebulk forceingest

If you change the code that converts the XML to JSON (to add fields for example) then normally the system will spot that _all_ the items have been modified and will update the database one item at a time (about 5-8 minutes run time). This will tell the system to instead update everything in one go with a forced bulk update, and skip the individual file updates.

    $ node app/cli/tmsxml2json/index.js forcebulk skipingest

### Admin web page

There is also an admin page that allows you to inspect items to check for data integrity. To to the initial install run...

```bash
yarn install -g htpasswd
htpasswd -bc htpasswd [username] [password]
cp .env.example .env
```

...to set the auth password. After that run to build and watch for code changes...

    $ yarn run go

...to kick things off, you can update the port number in the `.env` file.

On production the command would be...

    $ yarn run build
    $ node server.js
