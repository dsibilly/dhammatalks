/**
app.js
Scrapes the Evening Talks Archive at dhammatalks.org and transforms the list of
MP3 links into a podcast RSS XML feed.

@author Duane Sibilly <duane@sibilly.com>
*/
(function () {
    'use strict';

    var bunyan = require('bunyan'),
        cheerio = require('cheerio'), // server-side jQuery-style DOM implementation
        config = require('./lib/common').config(), // Load our config values from env.json
        crc32 = require('crc32'),
        fs = require('fs'),
        jade = require('jade'), // Templating keeps you sane!
        log = bunyan.createLogger({ name: 'dhammatalks' }),
        path = require('path'),
        podcastFormat = require('./lib/date_utils').podcastFormat, // creates podcast date strings
        request = require('request');

    // Grab the Evening Talks Archive from dhammatalks.org...
    log.info({ url: config.dhammatalksURL + config.talksPath }, 'Requesting evening talks page');
    request(config.dhammatalksURL + config.talksPath, function requestCallback (err, res, data) {
        var generatePodcastFeed = function (html, config) {
                var jadeLocals = {
                        pretty: config.jadePretty,
                        rssURL: config.cdnURL + config.outputFile,
                        talks: []
                    },
                    $ = cheerio.load(html); // load the DOM for scraping

                log.info('Generating new podcast feed');

                /*
                As we iterate over the list of MP3 links, the taxonomy of the URLs is
                very helpful. By parsing it, we can (usually) discover the exact date
                of the talk and use that information in the final XML
                */
                log.info('Parsing HTML for talks');
                $(config.listPath).each(function talkParser () {
                    var rePattern = new RegExp(/^(?:\d*\.)?\d+/),
                        talkName = $(this).text().trim(),
                        talkPath =  $(this).attr('href').substr(1),
                        talkPaths = talkPath.split('/'), // Split path into elements
                        talkYear = parseInt(talkPaths[1].substr(1), 10),
                        talkMonth = parseInt(talkPaths[2].substr(2, 2), 10),
                        talkDay = parseInt(talkPaths[2].substr(4, 2), 10),
                        date = isNaN(talkDay) ?
                            new Date(talkYear, talkMonth - 1, 1) :
                            new Date(talkYear, talkMonth - 1, talkDay);

                    if (talkPath.substr(-3) !== 'mp3') {
                        return; // Some of the links are to PDFs; we only want MP3s
                    }

                    if (rePattern.test(talkName)) {
                        // Trim the starting numbers (dates) off the names
                        talkName = talkName.substr(3).trim();
                    }

                    // Append each talk as an object to the talks array
                    jadeLocals.talks.push({
                        title: talkName,
                        enclosureURL: encodeURI(config.dhammatalksURL + talkPath),
                        pubDate: podcastFormat(date)
                    });
                });

                log.info({
                    talks: jadeLocals.talks.length
                }, 'Talks processed');

                log.info('Rendering podcast feed XML');
                // Using the collected talk data, let's render some XML!
                jade.renderFile(config.xmlTemplate, jadeLocals, function renderCallback (err, xml) {
                    if (err) {
                        log.error(err);
                        throw err;
                    }

                    /*
                    Here we write the XML to disk. It would be even easier to write this
                    to stdout, but since we want a file to upload to Amazon S3 this is
                    more straightforward.
                    */
                    log.info('Writing XML to disk');
                    fs.writeFile(config.outputFile, xml, function xmlWriteCallback (err) {
                        if (err) {
                            log.error(err);
                            throw err;
                        }

                        log.info({ path: path.resolve(config.outputFile) }, 'Saved podcast feed');
                    });
                });
            };

        if (err || res.statusCode !== 200) {
            // TODO: Handle this error elegantly...
            if (err) {
                log.error(err);
                throw err;
            } else {
                log.error({ statusCode: res.statusCode }, 'HTTP Error Code encountered');
            }
            return;
        }

        // Compare last run with this one
        fs.exists(config.crcFile, function checksumExistsCallback (exists) {
            var crc = {
                    new: crc32(data),
                    old: null
                },
                updateChecksumCallback = function (error) {
                    if (error) {
                        log.error(error);
                        throw error;
                    }

                    log.info({
                        path: config.crcFile
                    }, 'Checksum saved');
                    generatePodcastFeed(data, config);
                };

            if (! exists) {
                // Write new CRC to file
                log.info('No checksum exists; saving new checksum');
                fs.writeFile(config.crcFile, crc.new, updateChecksumCallback);
            } else {
                // Compare new CRC with old CRC
                log.info('Checksum exists; comparing new data');
                fs.readFile(config.crcFile, 'utf8', function readFileCallback (error, data) {
                    if (error) {
                        log.error(error);
                        throw error;
                    }

                    crc.old = data;
                    if (crc.old === crc.new) {
                        // Nothing has changed
                        log.info(crc, 'No changes detected; Exiting');
                    } else {
                        // Update the CRC file before generating the new feed.
                        log.info(crc, 'Changes detected; saving new checksum');
                        fs.writeFile(config.crcFile, crc.new, updateChecksumCallback);
                    }
                });
            }
        });
    });
}());
