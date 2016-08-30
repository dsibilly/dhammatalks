/**
common.js
A set of common useful code for use across a project. Commonly used to bootstrap
applications with settings for development and production environments.
*/
(function () {
    'use strict';

    // Import the config vars in env.json
    var env = require('../env.json');

    exports.config = function () {
        var nodeEnv = process.env.NODE_ENV || 'development';

        if (env.all) {
            // Merge global config values into config object!
            env[nodeEnv] = Object.assign(env[nodeEnv], env.all);
        }

        return env[nodeEnv];
    };
}());
