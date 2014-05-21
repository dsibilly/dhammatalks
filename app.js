/**
app.js
Scrapes the Evening Talks Archive at dhammatalks.org and transforms the list of
MP3 links into a podcast RSS XML feed.

@author Duane Sibilly <duane@sibilly.com>
*/
(function () {
    'use strict';
    
    var cheerio = require('cheerio'), // server-side jQuery-style DOM implementation 
        config = require('./lib/common').config(), // Load our config values from env.json
        fs = require('fs'),
        jade = require('jade'), // Templating keeps you sane!
        path = require('path'),
        podcastFormat = require('./lib/date_utils').podcastFormat, // creates podcast date strings
        request = require('request');
    
    // Grab the Evening Talks Archive from dhammatalks.org...
    request(config.dhammatalksURL + config.talksPath, function (err, res, html) {
        var $,
            jadeLocals = { // locals object for jade
                pretty: config.jadePretty, // For development, we want pretty XML!
                rssURL: config.cdnURL + config.outputFile,
                talks: [] // We'll store the list of talks here
            };
        
        if (err || res.statusCode !== 200) {
            // TODO: Handle this error elegantly...
            return;
        }
        
        $ = cheerio.load(html); // load the DOM for scraping
        
        /*
        As we iterate over the list of MP3 links, the taxonomy of the URLs is
        very helpful. By parsing it, we can (usually) discover the exact date
        of the talk and use that information in the final XML
        */
        $(config.listPath).each(function () {
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
        
        // Using the collected talk data, let's render some XML!
        jade.renderFile(config.xmlTemplate, jadeLocals, function (err, xml) {
            if (err) {
                throw err;
            }
            
            /*
            Here we write the XML to disk. It would be even easier to write this
            to stdout, but since we want a file to upload to Amazon S3 this is
            more straightforward.
            */
            fs.writeFile(config.outputFile, xml, function (err) {
                if (err) {
                    throw err;
                }
                
                console.log('Saved podcast RSS to ' + path.resolve(config.outputFile));
            });
        });
    });
}());