# dhammatalks 0.2.0

**dhammatalks** is a simple JavaScript website scraper that transforms the Evening Talks Archive at [dhammatalks.org](http://dhammatalks.org/mp3_index.html) into a podcast RSS XML feed.

## Usage
```
$ npm start

> dhammatalks@0.0.1 start /path/to/dhammatalks
> NODE_ENV=production node app.js

Saved podcast RSS to /path/to/dhammatalks/evening.xml
```

## Config
Config parameters are in env.json, and available to app.js via the config object.

## Dependencies
**dhammatalks** uses the following npm modules:

- [bunyan](https://github.com/trentm/node-bunyan) for JSON logging
- [cheerio](https://github.com/cheeriojs/cheerio) for jQuery-style DOM implementation
- [crc32](https://github.com/mikepulaski/node-crc32) for string-safe checksums
- [jade](https://github.com/visionmedia/jade) for templating
- [request](https://github.com/mikeal/request) for simple HTTP requests

## License
**dhammatalks** is distributed under the MIT License. See LICENSE for details.
