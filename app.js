/**
app.js
Scrapes the Evening Talks Archive at dhammatalks.org and transforms the list of
MP3 links into a podcast RSS XML feed.

@author Duane Sibilly <duane@sibilly.com>
*/

'use strict';

/* eslint no-process-env: 0 */

var async = require('async'),
    aws = require('aws-sdk'),
    bunyan = require('bunyan'),
    cheerio = require('cheerio'), // server-side jQuery-style DOM implementation
    config = require('./lib/common').config(), // Load our config values from env.json
    crc32 = require('crc32'),
    env = process.env.NODE_ENV || 'development',
    fs = require('fs'),
    job,
    log = bunyan.createLogger({
        name: 'dhammatalks'
    }),
    path = require('path'),
    podcastFormat = require('./lib/date_utils').podcastFormat, // creates podcast date strings
    pug = require('pug'),  // Templating keeps you sane!
    request = require('request'),
    schedule = require('node-schedule'),
    start,
    stop,
    url = require('url');

job = function () {
    var uri = url.format({
        host: config.dhammatalksHost,
        pathname: config.talksPath,
        protocol: 'http',
        slashes: true
    });

    // Grab the Evening Talks Archive from dhammatalks.org...
    log.info({ url: uri }, 'Requesting evening talks page');
    start = new Date().getTime();

    async.waterfall([
        function getTalksPage (callback) {
            request(uri, function (error, response, html) {
                stop = new Date().getTime();

                if (error || response.statusCode !== 200) {
                    // TODO: Handle this error elegantly...
                    if (error) {
                        callback(error);
                    } else {
                        callback(new Error('HTTP Error Code ' + response.statusCode + ' encountered'));
                    }
                    return;
                }

                log.info({
                    elapsedTime: (stop - start) / 1000
                }, 'Page retrieved successfully');

                callback(null, {
                    html: html
                });
            });
        },

        function verifyChecksum (options, callback) {
            fs.exists(config.crcFile, function checksumExistsCallback (exists) {
                var crc = {
                        new: crc32(options.html),
                        old: null
                    },
                    updateChecksumCallback = function (error) {
                        if (error) {
                            callback(error, options);
                            return;
                        }

                        log.info({
                            path: config.crcFile
                        }, 'Checksum saved');
                        callback(null, options);
                    };

                if (!exists) {
                    // Write new CRC to file
                    log.info('No checksum exists; saving new checksum');
                    fs.writeFile(config.crcFile, crc.new, updateChecksumCallback);
                } else {
                    // Compare new CRC with old CRC
                    log.info('Checksum exists; comparing new data');
                    fs.readFile(config.crcFile, 'utf8', function readFileCallback (error, checksum) {
                        if (error) {
                            callback(error, options);
                            return;
                        }

                        crc.old = checksum;
                        if (crc.old === crc.new) {
                            // Nothing has changed
                            callback(new Error('No changes detected; Exiting...'), options);
                            return;
                        }

                        // Update the CRC file before generating the new feed.
                        log.info(crc, 'Changes detected; saving new checksum');
                        fs.writeFile(config.crcFile, crc.new, updateChecksumCallback);
                    });
                }
            });
        },

        function generatePodcastFeed (options, callback) {
            var pugLocals = {
                    pretty: config.pugPretty,
                    rssURL: url.format({
                        host: config.cdnHost,
                        pathname: path.join(config.rssPath, config.outputFile),
                        protocol: 'http',
                        slashes: true
                    }),
                    talks: []
                },
                $ = cheerio.load(options.html); // load the DOM for scraping

            log.info({
                url: pugLocals.rssUrl
            }, 'Generating new podcast feed');

            /*
            As we iterate over the list of MP3 links, the taxonomy of the URLs is
            very helpful. By parsing it, we can (usually) discover the exact date
            of the talk and use that information in the final XML
            */
            log.info('Parsing HTML for talks');
            $(config.listPath).filter(function () {
                // Some of the links are to PDFs; we only want MP3s
                return $(this).attr('href').substr(-3) === 'mp3';
            }).each(function talkParser () {
                var rePattern = new RegExp(/^(?:\d*\.)?\d+/),
                    talkName = $(this).text().trim(),
                    talkPath = $(this).attr('href'),
                    talkPaths = talkPath.indexOf('/') === 0 ? talkPath.substr(1).split('/') : talkPath.split('/'), // Split path into elements
                    talkYear = parseInt(talkPaths[1].substr(1), 10),
                    talkMonth = parseInt(talkPaths[2].substr(2, 2), 10),
                    talkDay = parseInt(talkPaths[2].substr(4, 2), 10),
                    date = isNaN(talkDay) ?
                        new Date(talkYear, talkMonth - 1, 1) :
                        new Date(talkYear, talkMonth - 1, talkDay);

                if (rePattern.test(talkName)) {
                    // Trim the starting numbers (dates) off the names
                    talkName = talkName.substr(3).trim();
                }

                // Append each talk as an object to the talks array
                pugLocals.talks.push({
                    title: talkName,
                    enclosureURL: url.format({
                        host: config.dhammatalksHost,
                        pathname: talkPath,
                        protocol: 'http',
                        slashes: true
                    }),
                    pubDate: podcastFormat(date)
                });
            });

            log.info({
                talks: pugLocals.talks.length
            }, 'Talks processed');

            log.info('Rendering podcast feed XML');
            // Using the collected talk data, let's render some XML!
            pug.renderFile(config.xmlTemplate, pugLocals, function renderCallback (error, xml) {
                if (error) {
                    callback(error, options);
                    return;
                }

                options.xml = xml;

                /*
                Here we write the XML to disk. It would be even easier to write this
                to stdout, but since we want a file to upload to Amazon S3 this is
                more straightforward.
                */
                log.info('Writing XML to disk');
                fs.writeFile(config.outputFile, xml, function xmlWriteCallback (error) {
                    if (error) {
                        callback(error, options);
                        return;
                    }

                    log.info({ path: path.resolve(config.outputFile) }, 'Saved podcast feed');
                    options.file = config.outputFile;
                    callback(null, options);
                });
            });
        },

        function uploadToS3 (options, callback) {
            if (env === 'development') {
                // Don't upload anything in development!
                log.warn('Development Mode: skipping S3 upload');
                callback();
                return;
            }

            aws.config.update({
                accessKeyId: config.s3.options.accessKeyId,
                secretAccessKey: config.s3.options.secretAccessKey
            });

            var s3 = new aws.S3();

            log.info('Uploading feed to S3');
            s3.putObject({
                ACL: 'public-read',
                Body: options.xml,
                Bucket: config.s3.bucket,
                ContentType: 'application/xml',
                Key: [config.s3.objectPath, options.file].join('/')
            }, function (error, response) {
                if (error) {
                    callback(error);
                    return;
                }

                log.info(response);
                callback();
            });
        }
    ], function (error) {
        if (error) {
            log.error(error);
            return;
        }
    });
};

log.info({
    interval: '6h'
}, 'Starting dhammatalks updater');
schedule.scheduleJob('0 0 */6 * * *', job);
